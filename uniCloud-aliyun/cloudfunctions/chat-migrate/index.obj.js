/**
 * @module chat-migrate 聊天搬迁·灰度上报（P0 可插拔）
 *
 * 用途：新版本开屏收敛同步（搬迁=复制不删除）跑完后，客户端异步上报一次结果 →
 *       灰度期看「需搬迁用户的成功率」决定继续放量还是云控急停（chatSplit:{enabled:false}）。
 *
 * 边界与安全：
 *   - 只写自己的新表 chat_migrate_reports（每用户一条 upsert，openid 唯一索引兜底并发）；不碰任何现有表。
 *   - 鉴权同 invite：本地 HMAC-SHA256 验签自签 JWT 取 openid（不信客户端身份、不跨对象调用）。
 *   - 入参白名单 + clamp 收敛（绝不整包透传——采贝审计教训）。
 *   - 删除本对象 + 表即可整体下线，主流程零依赖（客户端调用是 fire-and-forget + 全 try-catch）。
 */

const crypto = require('crypto')
const { AppSecret, statsKey } = require('./config.js')

const db = uniCloud.database()
const dbCmd = db.command
const reportsDb = db.collection('chat_migrate_reports')

/* ---------------- 鉴权：本地验 JWT(HS256)（同 invite 模板，零依赖） ---------------- */
function b64urlToStr (s) {
	s = String(s || '').replace(/-/g, '+').replace(/_/g, '/')
	while (s.length % 4) s += '='
	return Buffer.from(s, 'base64').toString('utf8')
}
function verifyToken (token) {
	if (!token || typeof token !== 'string') return {}
	const parts = token.split('.')
	if (parts.length !== 3) return {}
	const [h, p, sig] = parts
	const expect = crypto.createHmac('sha256', AppSecret).update(h + '.' + p).digest('base64')
		.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
	/* 定长 + 逐字符异或的恒定时间比较，防时序侧信道 */
	if (sig.length !== expect.length) return {}
	let diff = 0
	for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i)
	if (diff !== 0) return {}
	try {
		const payload = JSON.parse(b64urlToStr(p))
		if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return {} // 过期
		return payload
	} catch (e) {
		return {}
	}
}

/* ---------------- 入参收敛（白名单字段 + 数值 clamp + 字符串截断） ---------------- */
function clampInt (v, min, max) {
	v = parseInt(v, 10)
	if (isNaN(v)) return 0
	return Math.max(min, Math.min(max, v))
}
function cleanStr (v, n) {
	return String(v == null ? '' : v).slice(0, n)
}
/* 时间筛选统一构造 update_date 条件：优先 fromMs/toMs 显式区间（后台自定义日期组件），否则 sinceMinutes 滚动窗（预设 5/60/180/今天）。返回 null 表示不筛。 */
function timeCond (params) {
	const from = parseInt(params.fromMs, 10)
	const to = parseInt(params.toMs, 10)
	if (from > 0 || to > 0) {
		const conds = []
		if (from > 0) conds.push(dbCmd.gte(from))
		if (to > 0) conds.push(dbCmd.lte(to))
		return conds.length === 2 ? dbCmd.and(conds) : conds[0]
	}
	const since = parseInt(params.sinceMinutes, 10)
	if (since > 0) return dbCmd.gt(Date.now() - since * 60000)
	return null
}

module.exports = {
	/**
	 * @function report 上报一次搬迁结果（客户端开屏异步调用，同用户 upsert 覆盖为最新状态）
	 * @param { Object } params { token, uid, done, total, migrated, updated, skipped, failed, appVersion, env, platform, system, model }
	 * @returns { Object } { errMsg: 'ok' | '未登录' | <错误信息> }
	 */
	async report (params = {}) {
		try {
			const { openid } = verifyToken(params.token)
			if (!openid) return { errMsg: '未登录' }

			const now = Date.now()
			const doc = {
				uid: cleanStr(params.uid, 40),
				done: params.done === true,
				total: clampInt(params.total, 0, 100000),
				migrated: clampInt(params.migrated, 0, 100000),
				updated: clampInt(params.updated, 0, 100000),
				skipped: clampInt(params.skipped, 0, 100000),
				failed: clampInt(params.failed, 0, 100000),
				fail_reason: cleanStr(params.failReason, 200), // 首个写失败原因文本（撞容量顶报错），供后台监控定位
				app_version: cleanStr(params.appVersion, 32),
				env: cleanStr(params.env, 16),
				platform: cleanStr(params.platform, 16),
				system: cleanStr(params.system, 64),
				model: cleanStr(params.model, 64),
				update_date: now
			}

			/* upsert：先 update（常态），首报 add；并发首报撞唯一索引 → 退回 update 幂等收敛 */
			const upd = await reportsDb.where({ openid }).update({ ...doc, attempts: dbCmd.inc(1) })
			if (!upd.updated) {
				try {
					await reportsDb.add({ openid, ...doc, attempts: 1, create_date: now })
				} catch (e) {
					await reportsDb.where({ openid }).update({ ...doc, attempts: dbCmd.inc(1) })
				}
			}
			return { errMsg: 'ok' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function stats 灰度看板（HBuilderX/uniCloud 控制台「运行云对象方法」，参数 {"key":"<config.statsKey>"}）
	 * @returns { Object } data 按 版本+环境 分组：users 新版用户数 / need 需搬迁(total>0) / ok 成功 / fail 失败 / rate 成功率
	 */
	/**
	 * @function recent 上报明细（运维/后台监控页用，同 statsKey 口令）：看每个用户的搬迁结果/版本/机型/失败原因
	 * @param { Object } params {
	 *   key, limit? (1-200, 默认50), sinceMinutes? (时间窗:5/60/180/1440…),
	 *   status? ('all'|'success'|'fail'|'need' 状态筛选), env? (环境:release/trial/develop), version? (版本号)
	 * }
	 */
	async recent (params = {}) {
		try {
			if (!statsKey || String(params.key) !== statsKey) return { errMsg: 'forbidden' }
			const limit = Math.max(1, Math.min(200, parseInt(params.limit, 10) || 50))
			const where = {}
			/* 时间窗：fromMs/toMs 自定义区间优先，否则 sinceMinutes 预设滚动窗 */
			const tc = timeCond(params)
			if (tc) where.update_date = tc
			/* status 状态筛选：success=已搬完 / fail=需搬迁但没搬完 / need=有旧数据需搬迁 */
			if (params.status === 'success') where.done = true
			else if (params.status === 'fail') { where.done = false; where.total = dbCmd.gt(0) }
			else if (params.status === 'need') where.total = dbCmd.gt(0)
			if (params.env) where.env = cleanStr(params.env, 16)
			if (params.version) where.app_version = cleanStr(params.version, 32)
			const r = await reportsDb.where(where).orderBy('update_date', 'desc').limit(limit)
				.field({ uid: true, openid: true, done: true, total: true, migrated: true, updated: true, skipped: true, failed: true, fail_reason: true, attempts: true, app_version: true, env: true, platform: true, system: true, model: true, create_date: true, update_date: true })
				.get()
			return { errMsg: 'ok', data: (r && r.data) || [] }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	async stats (params = {}) {
		try {
			if (!statsKey || String(params.key) !== statsKey) return { errMsg: 'forbidden' }

			const $ = db.command.aggregate
			let pipe = reportsDb.aggregate()
			/* 统计窗口=最近 N 分钟/自定义区间内有上报的用户；不传=全量。
			   注：表为"每用户一行快照"（upsert），时间筛选语义=「窗口内活跃用户的最新状态」，正合灰度看盘。 */
			const tc = timeCond(params)
			if (tc) pipe = pipe.match({ update_date: tc })
			const r = await pipe
				.group({
					_id: { v: '$app_version', env: '$env' },
					users: $.sum(1),
					need: $.sum($.cond({ if: $.gt(['$total', 0]), then: 1, else: 0 })),
					ok: $.sum($.cond({ if: $.and([$.gt(['$total', 0]), $.eq(['$done', true])]), then: 1, else: 0 })),
					fail: $.sum($.cond({ if: $.and([$.gt(['$total', 0]), $.eq(['$done', false])]), then: 1, else: 0 }))
				})
				.end()

			const rows = (r && r.data ? r.data : []).map(g => ({
				version: (g._id && g._id.v) || '(未知)',
				env: (g._id && g._id.env) || '',
				users: g.users,
				need: g.need,
				ok: g.ok,
				fail: g.fail,
				rate: g.need ? (Math.round(g.ok / g.need * 1000) / 10) + '%' : '—'
			}))
			return { errMsg: 'ok', data: rows }
		} catch ({ message }) {
			return { errMsg: message }
		}
	}
}
