/**
 * @module ranking 排行榜云对象
 * @description 提供"热门榜"数据查询：
 *   - 维度（type）：
 *       realtime  实时榜（= 今日累计，每小时整点更新一次，不定榜）
 *       day       日榜（= 昨日定档结果；今天凌晨 00:00 把昨天的最终数据"定档"展示）
 *       week      周榜
 *       month     月榜
 *       all       历史榜（roles.hot_count 总榜）
 *   - 性别（gender）：0 全部 / 1 男 / 2 女
 *   - 取 TOP 50
 *
 * 数据来源：
 *   - realtime/day → roles_hot_period（period_type='day'，分别取今天/昨天的 day key）
 *     注：日榜对用户呈现的"今日已定档榜单"，其实就是昨日的累计数据快照——前端在 0 点之后
 *     看到的是 [昨天 00:00 ~ 23:59:59] 的最终排名，是天然冻结的，不必额外做定时任务
 *   - week/month         → roles_hot_period（period_type='week'/'month'）
 *   - all                → roles.hot_count（总榜）
 *
 * 设计要点：
 *   1. roles_hot_period 表完全独立，删除该云函数 + 该表 + ranking 页面即可下线，
 *      不会对其他业务造成任何残留（除 talk 云函数中的上报逻辑可保留为冗余写入）。
 *   2. 性能策略：云函数实例级 1 分钟内存缓存（type+gender 共 20 个键），
 *      命中后零 DB 查询。Why: 排行榜对绝对实时性不敏感，但对响应速度敏感。
 *   3. period 表用 gender 冗余字段，避免每次查询都要 join 回 roles 表过滤性别。
 *   4. 查到 TOP N 后用 in 回查 roles 拿展示字段（avatar/name 等）；不下发 prompt/hide_prompt 等敏感数据。
 */

const { getDayKey, getWeekKey, getMonthKey } = require('./period-key.js')

const db = uniCloud.database()

const ROLES_COLL = 'roles'
const USERS_COLL = 'users'
/* 🧪 测试时切到 'roles_hot_period_test'，正式上线切回 'roles_hot_period'。
 * 必须和 talk/utils/ranking-report.js 顶部的 PERIOD_COLL 保持一致。 */
const PERIOD_COLL = 'roles_hot_period'

const CACHE_SIZE = 100              // 单次入缓存的 TOP N（覆盖大多数翻页）
const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 50
const CACHE_TTL = 60 * 1000         // 默认 60 秒（day/week/month/all）
/* realtime 例外：业务定义"实时榜每小时更新一次"，缓存按"到下一个整点"过期，
 * 保证 1 小时内所有用户看到同一份榜单快照（数据冻结），到点统一刷新。 */

/* 回查 roles 时仅取展示需要的字段
 * Why 对象格式：uniCloud.database()（NoSQL 风格）的 .field() 只接受对象 { field: true }，
 *   传字符串会触发 SDK 内部把字符串当数组迭代赋值，抛 "Cannot assign to read only property '0' of string"。
 *   注意：字符串形式 'a,b,c' 仅适用于 <unicloud-db> 组件 / JQL（databaseForJQL）。
 *
 * ⚠️ 不下发 user_name：roles.user_name 在创建时硬编码为 '我'（详见 role/index.obj.js 创建逻辑），
 *    那是聊天上下文里"AI 称呼用户"的占位符，不是创作者昵称；前端展示的"@作者"取自
 *    users.nickname（按 creator_id 批量回查），见下方 USERS_FIELDS。 */
const ROLES_FIELDS = {
	name: true,
	avatar: true,
	avatar_long: true,
	gender: true,
	tag_list: true,
	hot_count: true,
	today_hot_count: true,
	talk_count: true,
	like_count: true,
	creator_id: true,
	high_quality: true
}

/* 回查 users 时仅取昵称（其他字段含敏感信息：openid、unionid、手机号、cb_num 等，
 * 严禁下发到客户端） */
const USERS_FIELDS = { nickname: true }

const VALID_TYPES = ['realtime', 'day', 'week', 'month', 'all']

/**
 * 把对外的 type 映射为 period 表的 (period_type, period_key)
 *
 * Why 拆出一层映射：前端"实时榜/日榜"是业务语义，底层都是 day 维度的 period 数据，
 *   仅 period_key 不同。把语义和底层字段解耦，方便后续新增"前 7 日榜"等衍生维度时不改表。
 *
 * 注意 type='day' 的语义：用户看到的"日榜"其实是**昨日的累计快照**——
 *   "今天的日榜是今天凌晨定档的" 等价于 "今天展示昨天的最终累计"。
 *   所以 period_key 取 date-1d 的 day key，而不是今天的 day key（今天的数据归实时榜）。
 */
/* 当前北京时间小时数，用于实时榜"凌晨第一小时退化为昨日榜"判定 */
function getBeijingHour (date = new Date()) {
	return new Date(date.getTime() + 8 * 3600 * 1000).getUTCHours()
}

function resolvePeriod (type, date = new Date()) {
	if (type === 'realtime') {
		/* 凌晨 00:00~00:59 今日 period 表几乎为空，用户打开会看到空榜——
		 * 这一小时直接退化为"昨日 day key"，等价于借日榜的数据过渡；
		 * 1:00 整点后缓存随 expireAt 自然失效，切回今日 key，正常实时累计。
		 * 缓存键含 periodKey，两份数据互不干扰。 */
		if (getBeijingHour(date) === 0) {
			const y = new Date(date.getTime() - 86400000)
			return { period_type: 'day', period_key: getDayKey(y) }
		}
		return { period_type: 'day', period_key: getDayKey(date) }
	}
	/* day / week / month 三档语义统一为"展示最近一次已定档的稳定数据"——
	 *   day  → 昨天定档（昨日 day_key）
	 *   week → 上周定档（上周 week_key）
	 *   month→ 上月定档（上月 month_key）
	 * 倒计时统一表示"距离下一次定档"（次日 00:00 / 本周日末 / 本月末）。
	 * Why 不查"本周/本月正在累积"：会跟实时榜雷同（都还在累加），且周初/月初看起来像空榜。 */
	if (type === 'day') {
		const y = new Date(date.getTime() - 86400000)
		return { period_type: 'day', period_key: getDayKey(y) }
	}
	if (type === 'week') {
		/* 往前推 7 天必定落在上一 ISO 周内 */
		const lastWeek = new Date(date.getTime() - 7 * 86400000)
		return { period_type: 'week', period_key: getWeekKey(lastWeek) }
	}
	if (type === 'month') {
		/* 北京月份 -1，由 Date 自己处理跨年（1 月 -> 上年 12 月）。
		 * setUTCMonth 时把 day 锁到 15 是为了避开 31 号上溢（如 3/31 → 3/3 of 上月）的边界 */
		const beijing = new Date(date.getTime() + 8 * 3600 * 1000)
		beijing.setUTCDate(15)
		beijing.setUTCMonth(beijing.getUTCMonth() - 1)
		const lastMonth = new Date(beijing.getTime() - 8 * 3600 * 1000)
		return { period_type: 'month', period_key: getMonthKey(lastMonth) }
	}
	return { period_type: '', period_key: '' }
}

/* 实例级缓存：{ [cacheKey]: { ts, expireAt, data } }
 * ts       存入时间（仅用于返回给前端展示"updateTime"）
 * expireAt 过期时间戳；命中条件 now < expireAt
 *
 * Why 用 expireAt 而非固定 TTL：realtime 类型的过期点要对齐"下一个整点"，
 * 不同类型 TTL 不同；统一用绝对过期时间最清晰，也便于清理逻辑统一。 */
const _cache = {}

/**
 * 计算缓存条目的过期时间戳
 *   realtime → 下一个整点（北京时区不影响"过下一个整点"的绝对时间判定，故按本地时间算即可）
 *   其他类型 → now + 60s
 */
function nextExpireAt (type, now = Date.now()) {
	if (type === 'realtime') {
		const d = new Date(now)
		d.setHours(d.getHours() + 1, 0, 0, 0)
		return d.getTime()
	}
	return now + CACHE_TTL
}

/**
 * @function queryFullList 查询当前周期 TOP CACHE_SIZE 的完整列表（DB 查询）
 *
 * Why 抽成模块级函数而不是云对象方法：
 *   uniCloud 云对象内部跨方法 `this.xxx()` 调用在不同运行环境（本地调试 / 阿里云 / 腾讯云）
 *   下表现不一致，且 `_` 开头方法会被运行时判定为"私有"导致挂不到 this 上，
 *   出现 `this._queryFullList is not a function`。模块级函数最稳。
 */
async function queryFullList ({ type, gender, periodType, periodKey }) {
	if (type === 'all') {
		/* 历史总榜：直接查 roles 表 */
		const where = { show: true }
		if (gender) where.gender = gender
		const { data } = await db.collection(ROLES_COLL)
			.where(where)
			.field(ROLES_FIELDS)
			.orderBy('hot_count', 'desc')
			.limit(CACHE_SIZE)
			.get()
		const rolesList = (data || []).filter(item => (item.hot_count || 0) > 0)
		await attachCreatorNames(rolesList)
		return rolesList
	}

	/* 周期榜：从 period 表查 TOP N → 回查 roles 拿展示信息 */
	const periodWhere = { period_type: periodType, period_key: periodKey }
	if (gender) periodWhere.gender = gender

	const { data: periodList } = await db.collection(PERIOD_COLL)
		.where(periodWhere)
		.orderBy('hot_count', 'desc')
		.limit(CACHE_SIZE)
		.get()

	if (!periodList || !periodList.length) return []

	const roleIds = periodList.map(p => p.role_id)
	const hotMap = {}
	periodList.forEach(p => { hotMap[p.role_id] = p.hot_count })

	/* 回查 roles 表拿展示信息（show=true 过滤掉已下架角色） */
	const { data: rolesData } = await db.collection(ROLES_COLL)
		.where({ _id: db.command.in(roleIds), show: true })
		.field(ROLES_FIELDS)
		.get()

	/* 把热度合并进 roles 数据，并按 period 的顺序重排（roles 的 in 查询不保证顺序） */
	const rolesMap = {}
	rolesData.forEach(r => { rolesMap[r._id] = r })

	const merged = roleIds
		.map(id => {
			const role = rolesMap[id]
			if (!role) return null              // 角色被下架则在榜单剔除
			return { ...role, period_hot_count: hotMap[id] || 0 }
		})
		.filter(Boolean)

	await attachCreatorNames(merged)
	return merged
}

/**
 * @function attachCreatorNames 批量为榜单角色挂上"作者昵称"（in-place）
 *
 * Why 单独抽函数 + in-place：两个查询分支（all / period）都要做完全相同的事，
 *   抽出来避免重复代码；in-place 直接改 list 元素，省一次 map 分配。
 *
 * Why 不复用 roles 字段：role.user_name 是创建时硬编码的 '我'（聊天上下文用），
 *   role.nickname 是创建时冗余写入的"作者昵称"快照（schema 里没声明，存在性不可靠，
 *   且用户改昵称后会过期）。统一以 users.nickname 为准，roles 上的冗余字段仅作 fallback。
 *
 * 性能：榜单最多 50 条 → 至多 50 个 creator_id，去重后通常 30~40，一次 in 查询即可，开销可忽略。
 * 容错：users 查询失败不抛错（榜单不应因作者名查不到就整个挂掉），降级用空串。
 */
async function attachCreatorNames (list) {
	if (!list || !list.length) return

	const creatorIds = [...new Set(list.map(r => r.creator_id).filter(Boolean))]
	if (!creatorIds.length) {
		list.forEach(r => { r.creator_name = r.nickname || '' })
		return
	}

	let nicknameMap = {}
	try {
		const { data: users } = await db.collection(USERS_COLL)
			.where({ _id: db.command.in(creatorIds) })
			.field(USERS_FIELDS)
			.get()
		;(users || []).forEach(u => { nicknameMap[u._id] = u.nickname || '' })
	} catch (e) {
		console.error('[ranking] attachCreatorNames users lookup failed:', e && e.message)
	}

	list.forEach(r => {
		/* 优先 users 实时昵称；缺失或查询失败则 fallback 到 role 上的冗余 nickname（如果有），最后空串。
		 * Why 兜底：用户注销 / users 表数据脏 时仍能展示一个稍旧的昵称而不是空白 @ */
		r.creator_name = nicknameMap[r.creator_id] || r.nickname || ''
	})
}

module.exports = {

	/**
	 * @function getList 获取排行榜列表（支持滚动分页）
	 * @param { Object } params
	 * @param { String } params.type     维度：realtime | day | week | month | all，默认 realtime
	 * @param { Number } params.gender   性别：0 全部（默认）/ 1 男 / 2 女
	 * @param { Number } params.page     页码，从 1 开始，默认 1
	 * @param { Number } params.pageSize 每页数量，默认 20，最大 50
	 *
	 * @returns { object } {
	 *   errMsg,
	 *   data: { list, total, page, pageSize, hasMore, type, gender, periodKey, updateTime, fromCache }
	 * }
	 *
	 * 缓存策略：缓存维度 type + gender + periodKey，缓存的是 TOP CACHE_SIZE 全量列表，
	 * 分页只在内存切片，避免每页都打 DB（同一周期内最多 1 次 DB 查询命中所有页）
	 */
	async getList ({ type = 'realtime', gender = 0, page = 1, pageSize = PAGE_SIZE_DEFAULT } = {}) {
		try {
			if (!VALID_TYPES.includes(type)) type = 'realtime'
			gender = Number(gender) || 0
			if (![0, 1, 2].includes(gender)) gender = 0;
			page = Math.max(1, Number(page) || 1)
			pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(pageSize) || PAGE_SIZE_DEFAULT))

			const { period_type: periodType, period_key: periodKey } = resolvePeriod(type)
			const cacheKey = `${ type }_${ gender }_${ periodKey }`
			const now = Date.now()

			let fullList
			let cacheTs = now
			let fromCache = false

			/* 命中缓存（按 expireAt 判断） */
			const cached = _cache[cacheKey]
			if (cached && now < cached.expireAt) {
				fullList = cached.data
				cacheTs = cached.ts
				fromCache = true
			} else {
				fullList = await queryFullList({ type, gender, periodType, periodKey })
				_cache[cacheKey] = {
					ts: now,
					expireAt: nextExpireAt(type, now),
					data: fullList
				}

				/* 顺手清理已过期的旧条目，防止 period_key 变化（跨天/跨周/跨月）后旧键堆积 */
				Object.keys(_cache).forEach(k => {
					if (_cache[k].expireAt <= now) delete _cache[k]
				})
			}

			const total = fullList.length
			const start = (page - 1) * pageSize
			const end = start + pageSize
			const list = fullList.slice(start, end)
			const hasMore = end < total

			return {
				data: {
					list,
					total,
					page,
					pageSize,
					hasMore,
					type,
					gender,
					periodKey,
					updateTime: cacheTs,
					fromCache
				},
				errMsg: '获取成功'
			}
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function clearCache 清空内存缓存（运维/调试用）
	 */
	async clearCache () {
		Object.keys(_cache).forEach(k => delete _cache[k])
		return { data: true, errMsg: '缓存已清空' }
	}

}
