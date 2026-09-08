/**
 * drama-admin · 小剧场后台监控云对象(一期,2026-09-08 黎令开工;蓝图 md/待优化/11、任务书 11a)
 * ─────────────────────────────────────────────────────────────────────────
 * 职责:给后台管理系统(talk-ai-admin,H5)读小剧场数据 + 窄口写回。
 *   ② 自由本列表 / 详情 / 人工转私  → listScripts / getScript / reviewScript
 *      (09-09 黎定流程:创建时 AI 初审定公开/私有;后台只对被举报的、日审判不合规的人工再看一遍,决定要不要转私;没有「通过/拒绝」)
 *   ③ 举报列表 / 处理              → listReports / handleReport
 *   ⑥ 错误面板                     → listErrors
 *   ④ 钱账日报 + 「发放 ≤ 实收 50%」不变式 → dailyMoney
 * 设计原则:
 *   - 写口窄限:只写 drama_scripts.audit_status / visibility(+ audit_note / audit_by / audit_time 留痕)
 *     与 drama_reports.status / handler / handle_time / handle_note;其余表只读;绝不删记录。
 *     每次人工处置另追加一条 drama_events{ev:'admin_review', src:'be'} 留痕(与 talk-drama logEv 同形)。
 *   - 鉴权复用后台假登录:与 pay-manual 同一套 HMAC token,config.js 是照抄副本(不跨云函数 require,
 *     换密钥两边一起换);_before 验签,操作人落 this.operator,写进 audit_by / handler。
 *   - 面板不拖慢:列表一律分页(size ≤ 50)+ 时间范围,查询贴现有索引(events 的 ev+t、scripts 的
 *     source+visibility+audit_status);日报按天汇总 drama_reward_log(钱账权威,扣费负数/发放退款正数),
 *     drama_stats 聚合表并排作参照,不扫 drama_events 明细算总量。
 *   - 影子方案:源码在 talk-ai,后台工程同路径是逐字副本(供本地云函数模式);上传只从 talk-ai master。
 * 新字段(schema 未声明;云函数写库不受 schema 约束,项目内已有先例):
 *   drama_scripts: audit_note / audit_by / audit_time;drama_reports: handler / handle_time / handle_note。
 * 返回约定:成功 { errMsg: '', data },失败 { errMsg: '人话' };方法体 try/catch 全包。
 */
'use strict'
const crypto = require('crypto')
const { ACCOUNTS, TOKEN_SECRET } = require('./config.js')

const db = uniCloud.database()
const dbCmd = db.command
const $agg = dbCmd.aggregate

const BUILD = '0909-1'

const SCRIPTS = 'drama_scripts'
const REPORTS = 'drama_reports'
const EVENTS = 'drama_events'
const REWARDS = 'drama_reward_log'
const STATS = 'drama_stats'
const SESSIONS = 'drama_sessions'
const ENDINGS = 'drama_endings'
const LIKES = 'drama_likes'
const USERS = 'users'
const ROLES = 'roles'

const PAGE_MAX = 50          // 单页上限(任务书硬约束)
const NOTE_MAX = 200         // 备注长度上限
const DAY_MS = 86400000
const BJ = 8 * 3600000       // 北京时区偏移(服务器 UTC)
const MONEY_DAYS_MAX = 30    // 日报最多回看天数
const ERRORS_SPAN_MAX = 31 * DAY_MS
/** 错误面板可选事件(70 号清单排障类;bgm_error 顺带,均在 lite 白名单或 full 档) */
const ERROR_EVS = ['fe_error', 'gen_dead', 'create_wait_fail', 'bgm_error']
/** 自由本分栏(status:0 执笔中 / 1 已交付 / -1 判死 / -2 软删)。
 *  09-09 黎定流程:创建时 AI 初审定公开/私有,后台只对「被举报的」「日审 AI 判不合规的」人工再看一遍决定要不要转私——
 *  所以没有「待审/通过/拒绝」栏,分栏 = 全部 / 已公开 / 私有 / 被举报 / 人工处置过 / 执笔中 / 判死·已删 */
const SCRIPT_TABS = ['all', 'public', 'private', 'reported', 'handled', 'writing', 'dead']
/** 举报处理态 */
const REPORT_STATUS = ['pending', 'handled', 'dismissed']
/** 发放流水里的退款类型(正数但不算发放) */
const REFUND_TYPES = new Set(['refund', 'free_script_refund'])
/** 自由本列表可排序字段(白名单;缺字段的老文档按 null 排,降序时垫底) */
const SCRIPT_SORTS = new Set(['create_time', 'update_time', 'heat_score', 'heat', 'play_count', 'stat_player_count',
	'stat_settle_count', 'stat_full_count', 'stat_ending_count', 'stat_rerun_count', 'report_count', 'audit_time'])
/** 自由本列表投影(详情走 getScript 全文;endings 只为数结局位,不下发) */
const LIST_FIELDS = {
	title: true, hook: true, genre: true, spec: true, cover: true, scene_imgs: true, endings: true,
	wish: true, wish_type: true, creator_id: true, bind_role_id: true,
	create_time: true, update_time: true, status: true, gen_state: true, fail_reason: true, deleted_time: true,
	audit_status: true, visibility: true, audit_note: true, audit_by: true, audit_time: true,
	play_count: true, stat_player_count: true, stat_rerun_count: true, stat_settle_count: true,
	stat_full_count: true, stat_ending_count: true, heat: true, heat_score: true, report_count: true, report_flag: true,
}
/** 聚合/查询失败降级成空数组(玩况是附加信息,失败不碍列表) */
const safe = (p) => p.then((r) => (r && r.data) || []).catch(() => [])

/* ───────────────────────── 鉴权(照抄 pay-manual,只验不签) ───────────────────────── */
const unb64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
const sign = (body) => crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('hex')

/**
 * 验 token:签名一致、未过期、账号仍在 ACCOUNTS 才返回 payload,否则 null
 * @param {string} token
 * @returns {{u:string, exp:number}|null}
 */
function verifyToken (token) {
	try {
		if (!token || typeof token !== 'string') return null
		const [body, sig] = token.split('.')
		if (!body || !sig) return null
		const expect = sign(body)
		if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
		const payload = JSON.parse(unb64url(body))
		if (!payload || !payload.u || !(payload.exp > Date.now())) return null
		if (!Object.prototype.hasOwnProperty.call(ACCOUNTS, payload.u)) return null
		return payload
	} catch (e) {
		return null
	}
}

/* ───────────────────────── 通用小工具 ───────────────────────── */
/** 北京日 key(YYYY-MM-DD)与当日零点(UTC ms)——与 drama-stats 同算法 */
function dayKeyOf (ms) { const b = new Date(ms + BJ); const p = (n) => String(n).padStart(2, '0'); return `${b.getUTCFullYear()}-${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}` }
function dayStartOf (ms) { return Math.floor((ms + BJ) / DAY_MS) * DAY_MS - BJ }

/** 分页参数收口:page ≥ 1,size ∈ [1, PAGE_MAX] */
function pageOf (page, size) {
	const p = Math.max(1, Math.floor(Number(page) || 1))
	const s = Math.min(PAGE_MAX, Math.max(1, Math.floor(Number(size) || 20)))
	return { page: p, size: s, skip: (p - 1) * s }
}

const num = (v) => Number(v) || 0
const str = (v, n) => String(v == null ? '' : v).slice(0, n || 1e9)
const trimNote = (v) => str(v, NOTE_MAX).trim()
const errText = (e, tag) => { console.log(`[drama-admin][${tag}]`, e && e.message); return (e && e.message) || `${tag} 异常` }

/** 关键字 → 不区分大小写的安全正则(转义元字符) */
function keywordRe (kw) {
	const k = str(kw, 30).trim()
	if (!k) return null
	return new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

/**
 * 批量取用户昵称头像(users 只读;分块 ≤100 一次 in 查询)
 * @param {string[]} ids
 * @returns {Promise<Object<string,{_id:string,nickname:string,avatar:string}>>}
 */
async function fetchUsers (ids) {
	const map = {}
	const uniq = [...new Set((ids || []).filter(Boolean).map(String))]
	for (let i = 0; i < uniq.length; i += 100) {
		const chunk = uniq.slice(i, i + 100)
		const { data } = await db.collection(USERS).where({ _id: dbCmd.in(chunk) })
			.field({ nickname: true, avatar: true }).limit(chunk.length).get()
		for (const u of data || []) map[u._id] = { _id: u._id, nickname: u.nickname || '', avatar: u.avatar || '' }
	}
	return map
}

/** 批量取崽(roles)名字头像——自由本 bind_role_id 展示用 */
async function fetchRoles (ids) {
	const map = {}
	const uniq = [...new Set((ids || []).filter(Boolean).map(String))]
	for (let i = 0; i < uniq.length; i += 100) {
		const chunk = uniq.slice(i, i + 100)
		const { data } = await db.collection(ROLES).where({ _id: dbCmd.in(chunk) })
			.field({ name: true, avatar: true }).limit(chunk.length).get()
		for (const r of data || []) map[r._id] = { _id: r._id, name: r.name || '', avatar: r.avatar || '' }
	}
	return map
}

const userOf = (map, id) => map[id] || { _id: String(id || ''), nickname: '', avatar: '' }

/** 封面:显式 cover > 自由本自己的场景图(scene_imgs 元素 {act_idx,url}) > 空 */
function coverOf (s) {
	if (s.cover) return s.cover
	const first = Array.isArray(s.scene_imgs) ? s.scene_imgs.find((x) => x && x.url) : null
	return first ? first.url : ''
}

/** 玩况空值(聚合缺该本时用) */
const EMPTY_PLAY = () => ({ sessions_total: 0, playing: 0, settled: 0, abandoned: 0, sessions_other: 0, last_played_at: 0, endings_unlocked: 0, ending_unlocks: 0, likes: 0 })

/**
 * 每页自由本的玩况聚合(三条 aggregate,各自失败不碍列表):
 *   局按状态计数 + 最近一局时间(drama_sessions,走 script_id 前缀索引)/ 结局解锁(去重结局数 + 总次数,drama_endings)/ 喜欢数(drama_likes)
 * @param {string[]} ids
 * @returns {Promise<Object<string,object>>} id → 玩况
 */
async function playStats (ids) {
	const map = {}
	const row = (id) => (map[id] = map[id] || EMPTY_PLAY())
	if (!ids.length) return map
	const [ses, ends, likes] = await Promise.all([
		safe(db.collection(SESSIONS).aggregate().match({ script_id: dbCmd.in(ids) })
			.group({ _id: { s: '$script_id', st: '$state' }, n: $agg.sum(1), last: $agg.max('$update_time') }).end()),
		safe(db.collection(ENDINGS).aggregate().match({ script_id: dbCmd.in(ids) })
			.group({ _id: { s: '$script_id', e: '$ending_id' }, n: $agg.sum(1) }).end()),
		safe(db.collection(LIKES).aggregate().match({ script_id: dbCmd.in(ids) })
			.group({ _id: '$script_id', n: $agg.sum(1) }).end()),
	])
	for (const x of ses) {
		const k = x._id || {}
		const r = row(k.s); const n = num(x.n)
		r.sessions_total += n
		if (k.st === 'playing') r.playing += n
		else if (k.st === 'settled') r.settled += n
		else if (k.st === 'abandoned') r.abandoned += n
		else r.sessions_other += n
		r.last_played_at = Math.max(r.last_played_at, num(x.last))
	}
	for (const x of ends) { const r = row((x._id || {}).s); r.endings_unlocked++; r.ending_unlocks += num(x.n) }
	for (const x of likes) row(x._id).likes = num(x.n)
	return map
}

/** 自由本列表行(面板要看的字段 + 玩况;详情走 getScript 全文) */
function shapeScript (s, users, roles, play) {
	return {
		_id: s._id,
		title: s.title || '', hook: s.hook || '', genre: s.genre || '', spec: s.spec || '',
		cover: coverOf(s),
		scene_imgs: (Array.isArray(s.scene_imgs) ? s.scene_imgs : []).map((x) => x && x.url).filter(Boolean),
		wish: s.wish || '', wish_type: s.wish_type || '',
		creator: userOf(users, s.creator_id),
		role: roles[s.bind_role_id] || null,
		create_time: num(s.create_time), update_time: num(s.update_time),
		status: num(s.status), gen_state: s.gen_state || '', fail_reason: s.fail_reason || '', deleted_time: num(s.deleted_time),
		audit_status: s.audit_status || '', visibility: s.visibility || '',
		audit_note: s.audit_note || '', audit_by: s.audit_by || '', audit_time: num(s.audit_time),
		play_count: num(s.play_count), stat_player_count: num(s.stat_player_count), stat_rerun_count: num(s.stat_rerun_count),
		stat_settle_count: num(s.stat_settle_count), stat_full_count: num(s.stat_full_count), stat_ending_count: num(s.stat_ending_count),
		heat: num(s.heat), heat_score: num(s.heat_score),
		report_count: num(s.report_count), report_flag: !!s.report_flag,
		endings_total: Array.isArray(s.endings) ? s.endings.length : 0,
		...(play || EMPTY_PLAY()),
	}
}

/** 分栏 → where(全部 = 所有自由本含执笔中/判死;公开/私有只看已交付本;被举报/人工处置过不限状态) */
function scriptWhere (tab) {
	const base = { source: 'free' }
	switch (tab) {
		case 'public': return { ...base, status: 1, visibility: 'public' }
		case 'private': return { ...base, status: 1, visibility: 'private' }
		case 'reported': return { ...base, report_count: dbCmd.gt(0) }
		case 'handled': return { ...base, audit_by: dbCmd.exists(true) }
		case 'writing': return { ...base, status: 0 }
		case 'dead': return { ...base, status: dbCmd.in([-1, -2]) }
		default: return base
	}
}

/** 处置留痕:drama_events 追加 admin_review(与 talk-drama logEv 同形;失败绝不反噬处置) */
async function logAdmin (operator, scriptId, creatorId, data) {
	try {
		await db.collection(EVENTS).add({
			user_id: str(creatorId), ev: 'admin_review', t: Date.now(), src: 'be',
			session_id: '', script_id: str(scriptId), data: { by: operator, ...data },
		})
	} catch (e) { /* 留痕失败不影响主动作 */ }
}

/* ═══════════════════════════════ 云对象 ═══════════════════════════════ */
module.exports = {
	_before () {
		const method = this.getMethodName()
		if (method === 'ping') return
		const p = (this.getParams() || [])[0] || {}
		const payload = verifyToken(p.token)
		if (!payload) throw new Error('登录已失效，请重新登录')
		this.operator = payload.u
	},

	/** 部署核戳:上传后后台调一次,build 不对说明 cli 假成功 */
	ping () {
		return { errMsg: '', data: { build: BUILD } }
	},

	/**
	 * @function listScripts 自由本列表(source=free):分栏过滤 + 关键字(标题/钩子/愿望)+ 排序(白名单字段,同分按新到旧)+ 分页;
	 *   每行附玩况聚合(在玩/落幕/弃局/结局解锁/喜欢/最近一局);page=1 顺带各栏计数
	 * @param {object} p { token, tab:'all'|'pending'|'fail'|'public'|'private'|'writing'|'dead', keyword, sort, dir:'asc'|'desc', page, size }
	 * @returns {{errMsg:string, data?:{list:object[], total:number, page:number, size:number, sort:string, dir:string, counts?:object}}}
	 */
	async listScripts ({ tab = 'all', keyword = '', sort = 'create_time', dir = 'desc', page = 1, size = 20 } = {}) {
		try {
			const t = SCRIPT_TABS.includes(tab) ? tab : 'all'
			const sortKey = SCRIPT_SORTS.has(sort) ? sort : 'create_time'
			const sortDir = dir === 'asc' ? 'asc' : 'desc'
			const pg = pageOf(page, size)
			let where = scriptWhere(t)
			const re = keywordRe(keyword)
			if (re) where = dbCmd.and([where, dbCmd.or([{ title: re }, { hook: re }, { wish: re }])])

			const col = db.collection(SCRIPTS)
			let q = col.where(where).field(LIST_FIELDS).orderBy(sortKey, sortDir)
			if (sortKey !== 'create_time') q = q.orderBy('create_time', 'desc') // 同分按新到旧,翻页稳定
			const [{ total }, { data }] = await Promise.all([
				col.where(where).count(),
				q.skip(pg.skip).limit(pg.size).get(),
			])
			const rows = data || []
			const [users, roles, play] = await Promise.all([
				fetchUsers(rows.map((s) => s.creator_id)),
				fetchRoles(rows.map((s) => s.bind_role_id)),
				playStats(rows.map((s) => s._id)),
			])
			const out = {
				list: rows.map((s) => shapeScript(s, users, roles, play[s._id])),
				total: num(total), page: pg.page, size: pg.size, sort: sortKey, dir: sortDir,
			}

			/* 各栏计数(小表,7 次 count 几十 ms;仅首页给,翻页不重复算) */
			if (pg.page === 1) {
				const counts = {}
				await Promise.all(SCRIPT_TABS.map(async (k) => {
					const r = await col.where(scriptWhere(k)).count()
					counts[k] = num(r && r.total)
				}))
				out.counts = counts
			}
			return { errMsg: '', data: out }
		} catch (e) {
			return { errMsg: errText(e, 'listScripts') }
		}
	},

	/**
	 * @function getScript 自由本详情:全文(去 gen_input 聊天摘录)+ 作者/崽 + 玩况 + 每个结局的解锁人数/次数 + 最近 10 局
	 *   + 最近 5 条举报 + 人工处置留痕(admin_review 最近 10 条)
	 * @param {object} p { token, id }
	 */
	async getScript ({ id } = {}) {
		try {
			const sid = str(id, 40)
			if (!sid) return { errMsg: '缺少剧本 id' }
			const { data } = await db.collection(SCRIPTS).doc(sid).get()
			const s = data && data[0]
			if (!s) return { errMsg: '这一本不存在' }
			if (s.source !== 'free') return { errMsg: '只看自由本' }

			const [reportsRes, trailRes, users, roles, play, endStats, sesRes] = await Promise.all([
				db.collection(REPORTS).where({ script_id: sid }).orderBy('create_time', 'desc').limit(5).get(),
				db.collection(EVENTS).where({ ev: 'admin_review', script_id: sid }).orderBy('t', 'desc').limit(10).get(),
				fetchUsers([s.creator_id]),
				fetchRoles([s.bind_role_id]),
				playStats([sid]),
				safe(db.collection(ENDINGS).aggregate().match({ script_id: sid })
					.group({ _id: '$ending_id', n: $agg.sum(1), users: $agg.addToSet('$user_id') }).end()),
				db.collection(SESSIONS).where({ script_id: sid }).field({
					user_id: true, role_id: true, state: true, turn_count: true, pay_mode: true, unlocked: true,
					ending_id: true, revenue_cb: true, create_time: true, update_time: true,
				}).orderBy('create_time', 'desc').limit(10).get(),
			])
			const reports = reportsRes.data || []
			const sessions = sesRes.data || []
			const people = await fetchUsers([...reports.map((r) => r.user_id), ...sessions.map((x) => x.user_id)])
			const endingStats = {}
			for (const x of endStats) endingStats[String(x._id)] = { n: num(x.n), users: Array.isArray(x.users) ? x.users.length : 0 }

			const full = { ...s }
			delete full.gen_input // 含用户聊天摘录,交付时本已清;执笔中的本不外泄
			return {
				errMsg: '',
				data: {
					...shapeScript(s, users, roles, play[sid]),
					script: full,
					ending_stats: endingStats,
					sessions_recent: sessions.map((x) => ({
						_id: x._id, user: userOf(people, x.user_id), role_id: x.role_id || '', state: x.state || '',
						turn_count: num(x.turn_count), pay_mode: x.pay_mode || '', unlocked: !!x.unlocked,
						ending_id: x.ending_id || '', revenue_cb: num(x.revenue_cb), create_time: num(x.create_time), update_time: num(x.update_time),
					})),
					reports: reports.map((r) => ({
						_id: r._id, reason: r.reason || '', detail: r.detail || '', status: r.status || 'pending',
						create_time: num(r.create_time), reporter: userOf(people, r.user_id),
						handler: r.handler || '', handle_time: num(r.handle_time), handle_note: r.handle_note || '',
					})),
					trail: (trailRes.data || []).map((e) => ({ t: num(e.t), ...(e.data || {}) })),
				},
			}
		} catch (e) {
			return { errMsg: errText(e, 'getScript') }
		}
	},

	/**
	 * @function reviewScript 人工处置(09-09 黎定:合成一个动作)——
	 *   private = 转私(不合规):visibility→private、audit_status→fail,作者端显示「仅自己」;备注必填。
	 *   restore = 撤销转私(只给人工转过私的本,防误操作;AI 初审定私有的本不给):visibility→public、audit_status→pass。
	 * @param {object} p { token, id, decision:'private'|'restore', note }
	 */
	async reviewScript ({ id, decision, note } = {}) {
		try {
			const sid = str(id, 40)
			const d = String(decision || '')
			const n = trimNote(note)
			if (!sid) return { errMsg: '缺少剧本 id' }
			if (!['private', 'restore'].includes(d)) return { errMsg: '无效的处置' }
			if (!n) return { errMsg: '请填写备注' }

			const { data } = await db.collection(SCRIPTS).doc(sid)
				.field({ source: true, status: true, audit_status: true, visibility: true, creator_id: true, title: true, audit_by: true }).get()
			const s = data && data[0]
			if (!s) return { errMsg: '这一本不存在' }
			if (s.source !== 'free') return { errMsg: '只能处置自由本' }

			const now = Date.now()
			const upd = { audit_note: n, audit_by: this.operator, audit_time: now, update_time: now }
			if (d === 'private') {
				if (s.visibility === 'private') return { errMsg: '这一本已经是私有了' }
				upd.visibility = 'private'; upd.audit_status = 'fail'
			} else {
				if (!s.audit_by) return { errMsg: '只能撤销人工转私的本；AI 初审定私有的本不在这里放开' }
				if (num(s.status) !== 1) return { errMsg: '这一本尚未交付或已判死，不能恢复公开' }
				if (s.visibility === 'public') return { errMsg: '这一本已经是公开的' }
				upd.visibility = 'public'; upd.audit_status = 'pass'
			}
			await db.collection(SCRIPTS).doc(sid).update(upd)

			await logAdmin(this.operator, sid, s.creator_id, {
				decision: d, note: n, prev: { audit_status: s.audit_status || '', visibility: s.visibility || '' },
			})
			console.log('[drama-admin] 审核', { id: sid, decision: d, by: this.operator })
			return { errMsg: '', data: { _id: sid, audit_status: upd.audit_status, visibility: upd.visibility } }
		} catch (e) {
			return { errMsg: errText(e, 'reviewScript') }
		}
	},

	/**
	 * @function listReports 举报列表(按处理态 + 分页),联表带出本标题/作者/当前可见性与举报人昵称
	 * @param {object} p { token, status:'pending'|'handled'|'dismissed'|'all', page, size }
	 */
	async listReports ({ status = 'pending', page = 1, size = 20 } = {}) {
		try {
			const pg = pageOf(page, size)
			const where = REPORT_STATUS.includes(status) ? { status } : {}
			const col = db.collection(REPORTS)
			const [{ total }, { data }] = await Promise.all([
				col.where(where).count(),
				col.where(where).orderBy('create_time', 'desc').skip(pg.skip).limit(pg.size).get(),
			])
			const rows = data || []
			const sids = [...new Set(rows.map((r) => r.script_id).filter(Boolean))]
			const scripts = {}
			if (sids.length) {
				const { data: sc } = await db.collection(SCRIPTS).where({ _id: dbCmd.in(sids) })
					.field({ title: true, creator_id: true, visibility: true, audit_status: true, status: true, report_count: true, report_flag: true })
					.limit(sids.length).get()
				for (const s of sc || []) scripts[s._id] = s
			}
			const users = await fetchUsers([...rows.map((r) => r.user_id), ...Object.values(scripts).map((s) => s.creator_id)])

			const counts = {}
			if (pg.page === 1) {
				await Promise.all(REPORT_STATUS.map(async (k) => { const r = await col.where({ status: k }).count(); counts[k] = num(r && r.total) }))
			}
			return {
				errMsg: '',
				data: {
					list: rows.map((r) => {
						const s = scripts[r.script_id]
						return {
							_id: r._id, script_id: r.script_id || '', reason: r.reason || '', detail: r.detail || '',
							status: r.status || 'pending', create_time: num(r.create_time),
							handler: r.handler || '', handle_time: num(r.handle_time), handle_note: r.handle_note || '',
							reporter: userOf(users, r.user_id),
							script: s ? {
								_id: s._id, title: s.title || '', visibility: s.visibility || '', audit_status: s.audit_status || '',
								status: num(s.status), report_count: num(s.report_count), report_flag: !!s.report_flag,
								creator: userOf(users, s.creator_id),
							} : null,
						}
					}),
					total: num(total), page: pg.page, size: pg.size, ...(pg.page === 1 ? { counts } : {}),
				},
			}
		} catch (e) {
			return { errMsg: errText(e, 'listReports') }
		}
	},

	/**
	 * @function handleReport 举报处置:takedown=本转私(不合规,与 reviewScript.private 同写法)+ 该举报 handled + 同本其余待处理举报一并 handled(09-08 黎拍板);dismiss=驳回
	 *   幂等:先原子翻处理态(where status:pending),updated===1 才继续;同一条第二次点被挡。
	 * @param {object} p { token, id, action:'takedown'|'dismiss', note }
	 */
	async handleReport ({ id, action, note } = {}) {
		try {
			const rid = str(id, 40)
			const a = String(action || '')
			const n = trimNote(note)
			if (!rid) return { errMsg: '缺少举报 id' }
			if (!['takedown', 'dismiss'].includes(a)) return { errMsg: '无效的处置' }

			const { data } = await db.collection(REPORTS).doc(rid).get()
			const r = data && data[0]
			if (!r) return { errMsg: '这条举报不存在' }
			if ((r.status || 'pending') !== 'pending') return { errMsg: '这条举报已处理过' }

			const now = Date.now()
			const status = a === 'takedown' ? 'handled' : 'dismissed'
			const { updated } = await db.collection(REPORTS).where({ _id: rid, status: 'pending' })
				.update({ status, handler: this.operator, handle_time: now, handle_note: n })
			if (updated !== 1) return { errMsg: '这条举报刚被处理过，刷新看看' }

			let siblings = 0
			let script = null
			if (a === 'takedown' && r.script_id) {
				const { data: sc } = await db.collection(SCRIPTS).doc(r.script_id)
					.field({ source: true, visibility: true, audit_status: true, creator_id: true, title: true }).get()
				script = sc && sc[0]
				if (script) {
					await db.collection(SCRIPTS).doc(r.script_id).update({
						visibility: 'private', audit_status: 'fail', audit_note: `举报转私:${n || r.reason || ''}`.slice(0, NOTE_MAX),
						audit_by: this.operator, audit_time: now, update_time: now,
					})
					/* 同本其余待处理举报一并归档(黎 09-08:一本被举报五次不用点五次) */
					const sib = await db.collection(REPORTS).where({ script_id: r.script_id, status: 'pending' })
						.update({ status: 'handled', handler: this.operator, handle_time: now, handle_note: `随举报 ${rid.slice(-6)} 一并处理` })
					siblings = num(sib && sib.updated)
					await logAdmin(this.operator, r.script_id, script.creator_id, {
						decision: 'takedown', note: n, report_id: rid, reason: r.reason || '', siblings,
						prev: { audit_status: script.audit_status || '', visibility: script.visibility || '' },
					})
				}
			} else if (a === 'dismiss' && r.script_id) {
				await logAdmin(this.operator, r.script_id, '', { decision: 'dismiss', note: n, report_id: rid, reason: r.reason || '' })
			}
			console.log('[drama-admin] 举报处置', { id: rid, action: a, by: this.operator, siblings })
			return { errMsg: '', data: { _id: rid, status, siblings, script_found: !!script } }
		} catch (e) {
			return { errMsg: errText(e, 'handleReport') }
		}
	},

	/**
	 * @function listErrors 错误事件分页(默认最近 24h,最长 31 天),时间倒序,走 idx_ev_time(ev,t)
	 * @param {object} p { token, evs:string[], from, to, page, size }
	 */
	async listErrors ({ evs, from, to, page = 1, size = 20 } = {}) {
		try {
			const list = (Array.isArray(evs) && evs.length ? evs : ERROR_EVS.slice(0, 3)).filter((e) => ERROR_EVS.includes(e))
			if (!list.length) return { errMsg: '事件类型无效' }
			const pg = pageOf(page, size)
			const toMs = num(to) || Date.now()
			let fromMs = num(from) || (toMs - DAY_MS)
			if (fromMs >= toMs) return { errMsg: '时间范围无效' }
			if (toMs - fromMs > ERRORS_SPAN_MAX) fromMs = toMs - ERRORS_SPAN_MAX

			const where = { ev: dbCmd.in(list), t: dbCmd.gte(fromMs).and(dbCmd.lte(toMs)) }
			const col = db.collection(EVENTS)
			const [{ total }, { data }] = await Promise.all([
				col.where(where).count(),
				col.where(where).orderBy('t', 'desc').skip(pg.skip).limit(pg.size).get(),
			])
			const rows = data || []
			const users = await fetchUsers(rows.map((e) => e.user_id))
			return {
				errMsg: '',
				data: {
					list: rows.map((e) => ({
						_id: e._id, ev: e.ev || '', t: num(e.t), src: e.src || '',
						session_id: e.session_id || '', script_id: e.script_id || '',
						user: userOf(users, e.user_id), data: e.data || {},
					})),
					total: num(total), page: pg.page, size: pg.size, from: fromMs, to: toMs, evs: list,
				},
			}
		} catch (e) {
			return { errMsg: errText(e, 'listErrors') }
		}
	},

	/**
	 * @function dailyMoney 钱账日报(近 N 天,N ≤ 30):按北京日汇总 drama_reward_log——
	 *   实收 income = 扣费流水(amount<0)绝对值之和;退款 refund = refund/free_script_refund;净实收 net = income - refund;
	 *   发放 grant = settle_grant 等正数非退款流水;不变式「发放 ≤ 净实收 50%」,ratio>0.5 标 warn。
	 *   只计 status 缺省或 'done' 的流水(pending/failed 是未落地的账);drama_stats 当日 econ/alerts 并排作参照。
	 * @param {object} p { token, days }
	 */
	async dailyMoney ({ days } = {}) {
		try {
			const n = Math.min(MONEY_DAYS_MAX, Math.max(1, Math.floor(num(days) || 7)))
			const todayStart = dayStartOf(Date.now())
			const start = todayStart - (n - 1) * DAY_MS
			const byDay = {}
			for (let i = 0; i < n; i++) {
				const t = start + i * DAY_MS
				byDay[dayKeyOf(t)] = { day: dayKeyOf(t), t, income: 0, refund: 0, grant: 0, n_charge: 0, n_refund: 0, n_grant: 0, stats: null }
			}

			let truncated = false
			let pageNo = 0
			for (; pageNo < 40; pageNo++) { // 护栏 2 万条(体验版量级远不到;超了标 truncated)
				const { data } = await db.collection(REWARDS).where({ create_time: dbCmd.gte(start) })
					.field({ type: true, amount: true, status: true, create_time: true })
					.orderBy('create_time', 'asc').skip(pageNo * 500).limit(500).get()
				if (!data || !data.length) break
				for (const r of data) {
					if (r.status && r.status !== 'done') continue
					const row = byDay[dayKeyOf(num(r.create_time))]
					if (!row) continue
					const amt = num(r.amount)
					const type = String(r.type || '')
					if (REFUND_TYPES.has(type)) { row.refund += Math.abs(amt); row.n_refund++ }
					else if (amt < 0) { row.income += -amt; row.n_charge++ }
					else if (amt > 0) { row.grant += amt; row.n_grant++ }
				}
				if (data.length < 500) break
			}
			if (pageNo >= 40) truncated = true

			/* 参照:drama-stats 日报(缺天=定时器没跑/无事件) */
			const { data: stats } = await db.collection(STATS).where({ t: dbCmd.gte(start) })
				.field({ day: true, t: true, econ: true, alerts: true, funnel: true }).orderBy('t', 'desc').limit(n + 1).get()
			for (const s of stats || []) {
				const row = byDay[s.day]
				if (row) row.stats = { econ: s.econ || null, alerts: s.alerts || [], starts_n: num(s.funnel && s.funnel.starts_n), settles_n: num(s.funnel && s.funnel.settles_n) }
			}

			const rows = Object.values(byDay).sort((a, b) => b.t - a.t).map((r) => {
				const net = r.income - r.refund
				const ratio = net > 0 ? +(r.grant / net).toFixed(3) : (r.grant > 0 ? 9.999 : 0)
				return { ...r, net, ratio, warn: r.grant > 0 && (net <= 0 || ratio > 0.5) }
			})
			const total = rows.reduce((a, r) => {
				a.income += r.income; a.refund += r.refund; a.grant += r.grant; a.net += r.net
				a.n_charge += r.n_charge; a.n_refund += r.n_refund; a.n_grant += r.n_grant; return a
			}, { income: 0, refund: 0, grant: 0, net: 0, n_charge: 0, n_refund: 0, n_grant: 0 })
			total.ratio = total.net > 0 ? +(total.grant / total.net).toFixed(3) : (total.grant > 0 ? 9.999 : 0)
			total.warn = total.grant > 0 && (total.net <= 0 || total.ratio > 0.5)
			return { errMsg: '', data: { days: n, from: start, rows, total, truncated } }
		} catch (e) {
			return { errMsg: errText(e, 'dailyMoney') }
		}
	},
}
