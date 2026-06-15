/**
 * @module ranking-report 排行榜热度上报工具
 *
 * 在聊天累加热度时同步把热度上报到 roles_hot_period 表的 3 个维度
 * （day/week/month），用 upsert 累加。
 *
 * 历史遗留：早期同时写入 hour 维度供"小时榜"消费，后业务侧把"实时榜"语义
 * 改为"今日累计每分钟刷新"，hour 维度不再被任何榜单消费，故从写入路径剔除，
 * 减少每次聊天 1 次的 period 写。已存在的 hour 旧数据保留即可，无业务影响。
 *
 * Why 独立模块：
 *   1. 上报逻辑与排行榜功能强相关，与"聊天累加角色热度"的主流程解耦，
 *      未来下线排行榜时只需删掉本文件 + 调用点（3 处一行 require/调用即可）。
 *   2. 周期键算法与 ranking 云函数保持一致（该算法稳定，重复成本低）。
 *
 * 失败策略：
 *   period 表上报失败 **不抛错**、不阻断聊天主流程。
 *   原因：榜单数据少计可接受，但聊天不能因此挂掉。
 *
 * 调用约定：
 *   ⚠️ 调用方**必须 await** 本函数。
 *   serverless 云函数 return 后未完成的异步 IO 会被立即终止，fire-and-forget 会直接丢任务，
 *   早期版本踩过此坑导致 roles_hot_period 表始终为空（详见 md/排行榜.md §9.4）。
 */

/* 🧪 测试时切到 'roles_hot_period_test'，正式上线切回 'roles_hot_period'。
 * 必须和 ranking/index.obj.js 顶部的 PERIOD_COLL 保持一致。 */
const PERIOD_COLL = 'roles_hot_period'

const BEIJING_OFFSET_MS = 8 * 3600 * 1000

function toBeijing (date) { return new Date(date.getTime() + BEIJING_OFFSET_MS) }
const pad2 = n => String(n).padStart(2, '0')

function getDayKey (date) {
	const d = toBeijing(date)
	return `${ d.getUTCFullYear() }-${ pad2(d.getUTCMonth() + 1) }-${ pad2(d.getUTCDate()) }`
}
function getMonthKey (date) {
	const d = toBeijing(date)
	return `${ d.getUTCFullYear() }-${ pad2(d.getUTCMonth() + 1) }`
}
function getWeekKey (date) {
	const d = toBeijing(date)
	const dayOfWeek = d.getUTCDay() || 7
	d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
	const isoYear = d.getUTCFullYear()
	const yearStart = new Date(Date.UTC(isoYear, 0, 1))
	const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
	return `${ isoYear }-W${ pad2(weekNo) }`
}

/**
 * @function reportHot 把一次热度累加上报到 4 个周期维度
 * @param { Object } db uniCloud.database() 实例
 * @param { Object } params
 * @param { String } params.role_id 角色 ID
 * @param { Number } params.gender 角色性别（冗余写入便于查询过滤）；不传则自动从 roles 查一次
 * @param { Number } params.add 累加值
 * @returns { Promise<void> } 不抛错，失败仅打日志
 */
async function reportHot (db, { role_id, gender, add = 1 } = {}) {
	if (!role_id || !add) return

	try {
		/* 缺失 gender 时自动从 roles 查一次（避免侵入调用方）。
		 * Why: 调用方拿不到 gender 的场景多（如 addRoleHot 只传 role_id），
		 * 让本模块自闭环，对外只暴露 role_id 即可使用。
		 *
		 * ⚠️ 不要用 db.collection('roles').doc(id).field({gender:true}).get()：
		 * uniCloud-aliyun cf-database（NoSQL）官方文档从未示例 .doc().field() 链式，
		 * 实测在部分运行环境会抛错（且被外层 try-catch 静默吞掉，导致 gender 永远等于 0，
		 * 进而让性别筛选榜单缺数据）。安全做法：用 .where({_id}) 走 NoSQL 的官方推荐链式。 */
		if (gender === undefined || gender === null) {
			try {
				const { data } = await db.collection('roles')
					.where({ _id: role_id })
					.field({ gender: true })
					.limit(1)
					.get()
				gender = (data && data[0] && data[0].gender) || 0
			} catch (e) {
				/* 即使降级 fallback，也必须留原始错误日志：
				 * 静默吞错的 try-catch 是 uniCloud 调试最大杀手——上一版 .doc().field() 链式
				 * 在这里被静默吃掉，让 gender 永远等于 0、性别筛选榜单缺数据，排查极其痛苦。 */
				console.error('[ranking-report] lookup gender failed:', role_id, e && e.message)
				gender = 0
			}
		}

		const now = new Date()
		const ts = now.getTime()

		const periods = [
			{ period_type: 'day',   period_key: getDayKey(now) },
			{ period_type: 'week',  period_key: getWeekKey(now) },
			{ period_type: 'month', period_key: getMonthKey(now) }
		]

		const coll = db.collection(PERIOD_COLL)

		/* 3 个维度并发 upsert
		 * Why 手写 upsert：uniCloud-aliyun 的 collection.where().update() **不支持** options.upsert，
		 *   传 { upsert: true } 会被静默忽略，导致首次写入 where 命中 0 条时也不会创建记录，
		 *   表永远是空的（这正是早期版本榜单无数据的根因）。
		 * 实现：先 update，未命中则 add；并发场景下 add 撞唯一索引（idx_upsert_unique）退化为 update。 */
		await Promise.all(periods.map(p =>
			upsertPeriod(db, coll, p, { role_id, gender, add, ts }).catch(e => {
				console.error('[ranking-report] period upsert failed', p.period_type, p.period_key, role_id, e && e.message)
			})
		))
	} catch (e) {
		// 兜底：任何异常都吞掉，不影响聊天主流程
		console.error('[ranking-report] reportHot failed:', e.message)
	}
}

/**
 * @function upsertPeriod 单个维度的 upsert（先 update，没命中则 add，并发冲突退化回 update）
 * @private
 */
async function upsertPeriod (db, coll, p, { role_id, gender, add, ts }) {
	const where = { period_type: p.period_type, period_key: p.period_key, role_id }

	const r = await coll.where(where).update({
		hot_count: db.command.inc(add),
		update_time: ts
	})

	/* uniCloud-aliyun update 返回 { updated: N }；命中即返回 */
	if (r && r.updated > 0) return

	/* where 没命中 → 首次写入：add 一条
	 * Why 显式带 create_time：schema 里 create_time 用了 forceDefaultValue: { $env: now }，
	 * 但该机制**仅 JQL（databaseForJQL）路径生效**，本模块用 uniCloud.database() 直写，
	 * 不显式带就会让新记录 create_time 为空，后续做归档/冷热分离会失数据基础。 */
	try {
		await coll.add({
			role_id,
			period_type: p.period_type,
			period_key: p.period_key,
			gender,
			hot_count: add,
			update_time: ts,
			create_time: ts
		})
	} catch (e) {
		/* 并发场景：两个请求同时走到 add，被 idx_upsert_unique 唯一索引拦截一个 → 退化为 update
		 * Why 用 message 匹配：uniCloud-aliyun 不同版本错误 code 不一致，message 里通常含 "duplicate key" 字样 */
		const msg = (e && e.message) || ''
		if (/duplicate key|E11000|unique/i.test(msg)) {
			await coll.where(where).update({
				hot_count: db.command.inc(add),
				update_time: ts
			})
		} else {
			throw e
		}
	}
}

module.exports = { reportHot }
