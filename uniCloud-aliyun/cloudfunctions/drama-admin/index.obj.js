/**
 * drama-admin · 小剧场后台监控云对象(一期,2026-09-08 黎令开工;蓝图 md/待优化/11、任务书 11a)
 * ─────────────────────────────────────────────────────────────────────────
 * 职责:给后台管理系统(talk-ai-admin,H5)读小剧场数据 + 窄口写回。
 *   ② 自由本列表 / 详情 / 人工转私  → listScripts / getScript / reviewScript
 *      (09-09 黎定流程:创建时 AI 初审定公开/私有;后台只对被举报的、日审判不合规的人工再看一遍,决定要不要转私;没有「通过/拒绝」)
 *   ③ 举报列表 / 处理              → listReports / handleReport
 *   ⑥ 错误面板                     → listErrors
 *   ④ 钱账日报 + 「发放 ≤ 实收 50%」不变式 → dailyMoney
 *   ⑨ 总览统计台 → overview;内测招募候选与跟进 → listBetaCandidates / setBetaInvite(新表 beta_invites,09-09)
 *   ⑩ 后台通用:找用户 / 用户详情 / 赠送采贝 → findUsers / userDetail / grantCb(流水表 admin_cb_grants,09-09)
 *   ⑪ 优质老用户原始特征(只看留了联系方式的) → listQualityUsers(打分在后台 utils/quality-score.js,09-13)
 *   ⑫ 问卷(只读 surveys + users,10-05):各期概览 / 一期统计总结 / 某题文字答案 / 答卷明细
 *      (答卷明细可按 充值 / 联系方式 / 性别 / 来源 / 填写时间 / 注册时间 筛,按 时间 / 时长 / 充值 / 注册 / 登录 / 聊天 排)
 *      → surveyOverview / surveySummary / surveyTexts / surveyAnswers(题目定义由后台从 survey.getArchive 取,解码在前端)
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

const BUILD = '1005-2'

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
const ORDERS = 'orders'
const SURVEYS = 'surveys'
const BETA = 'beta_invites'      // 内测招募跟进(新表,只经本对象读写)
const GRANTS = 'admin_cb_grants' // 后台手工赠送采贝流水(新表,只经本对象写)

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

/* ───────────────────────── 总览统计台(overview)用 ───────────────────────── */
const HOUR_MS = 3600000
const OVERVIEW_SPAN_MAX = 31 * DAY_MS
const SCAN_PAGE = 500
const SCAN_PAGES_MAX = 20          // 1 万条/表护栏,超了标 truncated
const ratio = (a, b) => (b ? +(a / b).toFixed(3) : 0)
/** 灯长明的计费态(买断/首免/执笔自玩永不灯灭,08-28 黎令);其余 3 天不动灯灭 */
const ETERNAL_MODES = new Set(['first_free', 'creator_free'])

/**
 * 时间范围扫描(投影 + 分页):体验版量级各表几百到几千条可扫;
 * ⚠️ scripts/sessions/endings/reward_log/reports 的时间字段都没单独索引,放量后要加索引(索引=线上表资源,交黎手动传)
 * @param {string} col 表名
 * @param {string} tfield 时间字段
 * @param {number} fromMs
 * @param {number} toMs
 * @param {object} fields 投影
 * @param {object} [extra] 附加等值条件
 * @returns {Promise<{rows:object[], truncated:boolean}>}
 */
async function scanRange (col, tfield, fromMs, toMs, fields, extra) {
	const rows = []
	let truncated = false
	for (let p = 0; p < SCAN_PAGES_MAX; p++) {
		const { data } = await db.collection(col)
			.where({ ...(extra || {}), [tfield]: dbCmd.gte(fromMs).and(dbCmd.lte(toMs)) })
			.field(fields).orderBy(tfield, 'asc').skip(p * SCAN_PAGE).limit(SCAN_PAGE).get()
		if (!data || !data.length) break
		rows.push(...data)
		if (data.length < SCAN_PAGE) break
		if (p === SCAN_PAGES_MAX - 1) truncated = true
	}
	return { rows, truncated }
}

/** 批量取本的简介(标题/来源/热度/可见性),热门榜与自由本 vs 官方本占比用 */
async function fetchScriptsBrief (ids) {
	const map = {}
	const uniq = [...new Set((ids || []).filter(Boolean).map(String))]
	for (let i = 0; i < uniq.length; i += 100) {
		const chunk = uniq.slice(i, i + 100)
		const { data } = await db.collection(SCRIPTS).where({ _id: dbCmd.in(chunk) })
			.field({ title: true, source: true, heat_score: true, visibility: true, stat_player_count: true, status: true }).limit(chunk.length).get()
		for (const s of data || []) map[s._id] = s
	}
	return map
}

/** 时间桶标签(北京时):小时桶 MM-DD HH:00,日桶 MM-DD */
function bucketLabel (t, bucket) {
	const b = new Date(t + BJ); const p = (n) => String(n).padStart(2, '0')
	return bucket === 'hour' ? `${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())} ${p(b.getUTCHours())}:00` : `${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}`
}

/* ───────────────────────── 内测招募(listBetaCandidates / setBetaInvite)用 ───────────────────────── */
const BETA_CAND_MAX = 3000     // 候选(留了联系方式的用户)上限,超了标 truncated
/** 跟进态(09-13 黎令补 待同意 / 号不对,文案在后台 utils/drama.js):未处理 / 待同意(已发好友申请) / 已加上 / 已邀请 / 已进内测 / 号不对 / 已拒绝 */
const INVITE_STATUS = ['', 'pending', 'added', 'invited', 'joined', 'wrong', 'refused']
const BETA_SORTS = new Set(['pay_total', 'pay_count', 'recent_pay', 'last_pay', 'wechat_id_time', 'last_login_date', 'register_date', 'vip_end_time', 'chat_total', 'theater_sessions', 'login_count'])
const BETA_TIME_FIELDS = { contact: 'wechat_id_time', register: 'register_date', login: 'last_login_date' } // pay 走订单,在内存里筛
const BETA_USER_FIELDS = {
	nickname: true, avatar: true, gender: true, register_date: true, last_login_date: true, login_count: true, chat_total: true,
	pay_total: true, pay_count: true, cb_pay_count: true, cb_num: true, cb_pay_num: true, vip_end_time: true, talk_card_end_time: true,
	wechat_id: true, beta_phone: true, wechat_id_time: true, wechat_id_source: true,
}
/** v3 问卷决策题的选项短标(答案库里存 A/B/C/D 序号;题目在 survey/config.js v3,改题要一起改) */
const V3_OPTS = {
	q2: ['自己捏的崽', '官方角色', '别人写的故事', '都想试试'],
	q4: ['十几次·一口气', '三五十次·慢慢来', '越长越好', '看故事不设限'],
	q6: ['边玩边付', '一次付清', '先免费再决定', '开会员享会员价'],
	q7: ['很划算', '可以接受', '有点贵', '太贵了'],
	q8: ['会写·已想好', '想试·不会写', '先玩别人的', '应该不会'],
}
function decodeAns (q, v) {
	if (v == null || v === '') return ''
	const s = String(Array.isArray(v) ? v[0] : v)
	const i = /^[A-Z]$/.test(s) ? s.charCodeAt(0) - 65 : -1
	return (V3_OPTS[q] && V3_OPTS[q][i]) || s.slice(0, 20)
}

/** 按 user_id 分组聚合(ids 分块 ≤500,各块失败降级空;显式 limit=块大小——分组键是用户,组数不会超过块大小,不依赖云端默认条数) */
async function aggByUser (col, ids, match, group) {
	const out = []
	for (let i = 0; i < ids.length; i += 500) {
		const chunk = ids.slice(i, i + 500)
		const rows = await safe(db.collection(col).aggregate().match({ ...(match || {}), user_id: dbCmd.in(chunk) }).group({ _id: '$user_id', ...group }).limit(chunk.length).end())
		out.push(...rows)
	}
	return out
}

/** ids 按 size 分块并行查(各块独立;块内每个用户至多一条记录时 limit=块大小即不漏) */
async function inChunks (ids, size, fn) {
	const tasks = []
	for (let i = 0; i < ids.length; i += size) tasks.push(fn(ids.slice(i, i + size)))
	return (await Promise.all(tasks)).flat()
}

/** 跟进标记 map(user_id → 记录;beta_invites 一人一条) */
async function fetchInvites (ids) {
	const map = {}
	const rows = await inChunks(ids, 500, async (chunk) => (await db.collection(BETA).where({ user_id: dbCmd.in(chunk) }).limit(chunk.length).get()).data || [])
	for (const x of rows) map[x.user_id] = { status: x.status || '', note: x.note || '', operator: x.operator || '', update_time: num(x.update_time) }
	return map
}

/** v3 问卷决策题答案(user_id → {q2,q4,q6,q7,q8,time};surveys 按 user_id+version 唯一) */
async function fetchSurveyV3 (ids) {
	const map = {}
	const rows = await inChunks(ids, 500, async (chunk) => (await db.collection(SURVEYS).where({ user_id: dbCmd.in(chunk), version: 'v3' })
		.field({ user_id: true, answers: true, created_time: true }).limit(chunk.length).get()).data || [])
	for (const x of rows) {
		const a = x.answers || {}
		map[x.user_id] = {
			q2: decodeAns('q2', a.q2), q4: decodeAns('q4', a.q4),
			q6: decodeAns('q6', a.q6), q7: decodeAns('q7', a.q7), q8: decodeAns('q8', a.q8), time: num(x.created_time),
		}
	}
	return map
}

/* ───────────────────────── 优质老用户(listQualityUsers)用 ───────────────────────── */
const QUALITY_POOL_MAX = 3000
const QUALITY_CHUNK = 500      // $in 分块;分组键是用户,单块组数 ≤ 块大小
const QUALITY_USER_FIELDS = {
	nickname: true, avatar: true, gender: true, register_date: true, last_login_date: true,
	login_count: true, chat_total: true, receive_cb_total: true, receive_cb_count: true, video_ad_count: true,
	pay_total: true, pay_count: true, vip_end_time: true, add_mp_reward_time: true, cb_num: true,
	wechat_id: true, beta_phone: true, wechat_id_time: true,
}

/**
 * 按某个用户键分组聚合 → map(用户 id → 组)。分块 $in + 显式 limit;单表失败只记 errors 不拖垮整体;timing 记耗时供排查慢表。
 * @param {object} ctx { errors:string[], timing:object }
 */
async function aggUserMap (ctx, label, col, key, ids, match, group) {
	const t0 = Date.now()
	const map = {}
	for (let i = 0; i < ids.length; i += QUALITY_CHUNK) {
		const chunk = ids.slice(i, i + QUALITY_CHUNK)
		try {
			const { data } = await db.collection(col).aggregate()
				.match({ ...(match || {}), [key]: dbCmd.in(chunk) })
				.group({ _id: '$' + key, ...group })
				.limit(chunk.length).end()
			for (const x of data || []) map[x._id] = x
		} catch (e) {
			ctx.errors.push(`${label}: ${(e && e.message) || e}`.slice(0, 160))
		}
	}
	ctx.timing[label] = Date.now() - t0
	return map
}

/** 内测候选行:用户基本信息 + 联系方式 + 付费(用户表累计 + 订单近 30 天/最近一单)+ 体验版足迹(剧场局)+ 跟进 */
function shapeBetaRow (u, pa, p30, th, inv) {
	const nowMs = Date.now()
	return {
		_id: u._id, nickname: u.nickname || '', avatar: u.avatar || '', gender: num(u.gender),
		register_date: num(u.register_date), register_days: u.register_date ? Math.max(0, Math.floor((nowMs - num(u.register_date)) / DAY_MS)) : 0,
		last_login_date: num(u.last_login_date), login_count: num(u.login_count), chat_total: num(u.chat_total),
		cb_num: num(u.cb_num), cb_pay_num: num(u.cb_pay_num), vip_end_time: num(u.vip_end_time), talk_card_end_time: num(u.talk_card_end_time),
		contact: { wechat_id: u.wechat_id || '', beta_phone: u.beta_phone || '', time: num(u.wechat_id_time), source: u.wechat_id_source || '' },
		pay: {
			total: num(u.pay_total), count: num(u.pay_count), cb_count: num(u.cb_pay_count),
			recent30: num(p30), last_paid: pa ? num(pa.last) : 0, orders_n: pa ? num(pa.n) : 0, orders_total: pa ? num(pa.total) : 0,
		},
		theater: { entered: !!(th && (num(th.sessions) > 0 || num(th.first) > 0)), sessions: th ? num(th.sessions) : 0, first: th ? num(th.first) : 0, last: th ? num(th.last) : 0 },
		invite: inv || { status: '', note: '', operator: '', update_time: 0 },
		survey: null,
	}
}

/* ───────────────────────── 用户查找与赠送采贝(findUsers / userDetail / grantCb)用 ───────────────────────── */
const GRANT_MAX = 10000
const HEX24 = /^[0-9a-f]{24}$/i
const USER_DETAIL_FIELDS = {
	nickname: true, avatar: true, username: true, gender: true, register_date: true, register_platform: true, inviter_uid: true,
	last_login_date: true, login_count: true, chat_total: true, cb_num: true, cb_pay_num: true,
	receive_cb_total: true, receive_cb_count: true, receive_cb_date: true, pay_total: true, pay_count: true,
	vip_end_time: true, talk_card_end_time: true, wechat_id: true, beta_phone: true, mobile: true,
}
/** 用户详情行(后台看的字段;金额分、时间 ms 原样给,前端换算) */
function shapeUser (u) {
	const nowMs = Date.now()
	return {
		_id: u._id, nickname: u.nickname || '', avatar: u.avatar || '', username: u.username || '', gender: num(u.gender),
		register_date: num(u.register_date), register_days: u.register_date ? Math.max(0, Math.floor((nowMs - num(u.register_date)) / DAY_MS)) : 0,
		register_platform: u.register_platform || '', inviter_uid: u.inviter_uid || '',
		last_login_date: num(u.last_login_date), login_count: num(u.login_count), chat_total: num(u.chat_total),
		cb_num: num(u.cb_num), cb_pay_num: num(u.cb_pay_num),
		receive_cb_total: num(u.receive_cb_total), receive_cb_count: num(u.receive_cb_count), receive_cb_date: u.receive_cb_date || '',
		pay_total: num(u.pay_total), pay_count: num(u.pay_count),
		vip_end_time: num(u.vip_end_time), talk_card_end_time: num(u.talk_card_end_time),
		wechat_id: u.wechat_id || '', beta_phone: u.beta_phone || '', mobile: u.mobile || '',
	}
}
/** 某用户最近的后台赠送流水 */
async function fetchGrants (uid, limit) {
	const { data } = await db.collection(GRANTS).where({ user_id: uid }).orderBy('create_time', 'desc').limit(limit || 10).get()
	return (data || []).map((g) => ({ _id: g._id, amount: num(g.amount), note: g.note || '', operator: g.operator || '', before: g.before || {}, after: g.after || {}, create_time: num(g.create_time) }))
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
			.group({ _id: { s: '$script_id', st: '$state' }, n: $agg.sum(1), last: $agg.max('$update_time') }).limit(1000).end()),
		safe(db.collection(ENDINGS).aggregate().match({ script_id: dbCmd.in(ids) })
			.group({ _id: { s: '$script_id', e: '$ending_id' }, n: $agg.sum(1) }).limit(1000).end()),
		safe(db.collection(LIKES).aggregate().match({ script_id: dbCmd.in(ids) })
			.group({ _id: '$script_id', n: $agg.sum(1) }).limit(ids.length).end()),
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

/* ───────────────────────── 问卷(surveyOverview / surveySummary / surveyTexts / surveyAnswers)用 ───────────────────────── */
/*
 * surveys 记录形态:{ _id, user_id, version, answers, duration(秒), source, created_time? }
 *   - answers 是 KV(key = 题号 q1…qN):单选存选项字母 'A';选「其他」带补充存 'E_补充文字';多选存数组 ['A','C','E_补充文字'];问答存原文字符串。
 *   - 记录是 survey 云对象 add() 写的,不走 schema 默认值 → created_time 多半缺失:提交时间一律走 surveyTimeOf(有就用,否则从 _id 推);
 *     排序一律按 _id(ObjectId 前 4 字节是秒级时间戳,与提交先后单调),不按 created_time。
 *   - 早期 v1 记录没有 version 字段(另有个别显式为 null),按 v1 处理(surveyVersionWhere 查询与 mergeSurveyGroups 概览两处同口径)。
 *   - 题目定义(题干 / 选项文案)不在这里:后台从 survey.getArchive 取、在前端解码;本对象只给原始字母与统计。
 * 纯计算(tallySurvey / mergeSurveyGroups / surveyPickText 等)与 DB 扫描(scanSurveys)分开,纯函数不碰 db,便于 mock 测试。
 * ⚠️ surveys 现只有 (user_id, version) 复合唯一索引:按 version 扫 / 计数在体验版量级(几千条)无压力;放量后再评估加 version 前缀索引(线上表资源,交黎手动传)。
 */
const SURVEY_SCAN_PAGE = 1000          // 云函数端 limit 上限 1000(官方文档:阿里云 / 腾讯云 / 支付宝云均最大 1000)
const SURVEY_SCAN_MAX = 20000          // 单期扫描护栏,超了标 truncated
const SURVEY_SCAN_PARALLEL = 4         // count 后按页并行拉,单批 4 页
const SURVEY_GROUPS_MAX = 100          // 概览分组上限(= 版本数,远不到;显式给,不依赖云端聚合默认条数)
const SURVEY_FILL_DAYS_MAX = 120       // daily 首末日跨度超过它就不补零(防脏时间撑出几千个空日)
const SURVEY_EXTRA_TEXTS_MAX = 100     // 每个带补充的选项最多回传多少条不同补充文字
const SURVEY_EXTRA_TEXT_LEN = 200
const SURVEY_SAMPLES_MAX = 20          // 每题自由文本样例条数(最近的)
const SURVEY_SAMPLE_LEN = 300
const SURVEY_VERSION_RE = /^v\d{1,3}$/
const SURVEY_QID_RE = /^[A-Za-z][A-Za-z0-9_]{0,19}$/
const SURVEY_OPT_RE = /^[A-Z]$/
/** 选项形态的答案值:'A' 或 'E_补充文字'(下划线后是补充文字) */
const SURVEY_OPT_VAL_RE = /^[A-Z](_|$)/
/** 库内查「自由文本」:至少一个非空白字符、且不是选项形态——与 tallySurvey 的 text 判定同口径;对多选数组,选项元素一律不命中 */
const SURVEY_TEXT_RE = /^(?![A-Z](?:_|$))[\s\S]*\S/
/** 已知是问答题时(后台按题目定义传 asText / textQids):任何非空内容都算文字答案——否则恰好只填一个大写字母、或「A_xxx」形态的微信号会被误判成选项 */
const SURVEY_ANY_TEXT_RE = /\S/
const SURVEY_TEXT_QIDS_MAX = 200
const SURVEY_SCAN_FIELDS = { user_id: true, answers: true, duration: true, source: true, created_time: true }
/** 答卷明细排序(10-05 黎令扩成多角度):答卷自身字段库内可排;用户字段要先扫候选再在内存里排(user 路径) */
const SURVEY_ROW_SORTS = new Set(['time', 'duration'])
const SURVEY_USER_SORTS = new Set(['pay_total', 'pay_count', 'register_date', 'last_login_date', 'chat_total', 'login_count'])
/** 旧 sort 值兼容(交付首版的前端传 time_desc 等):拆成 sort + dir */
const SURVEY_LEGACY_SORTS = {
	time_desc: ['time', 'desc'], time_asc: ['time', 'asc'],
	duration_desc: ['duration', 'desc'], duration_asc: ['duration', 'asc'],
}
/** user 路径扫候选时的投影:不带 answers(体积大头),本页定下来后再按 _id 回查 */
const SURVEY_CAND_FIELDS = { user_id: true, duration: true, source: true, created_time: true }
const SURVEY_SOURCE_LEN = 40           // source 筛选入参截断长度
const SURVEY_SOURCES_MAX = 1000        // 来源分布分组上限(显式给,不依赖云端聚合默认条数)
const SURVEY_USER_FIELDS = {
	nickname: true, avatar: true, gender: true, register_date: true, last_login_date: true,
	pay_total: true, pay_count: true, chat_total: true, login_count: true, vip_end_time: true, wechat_id: true, beta_phone: true,
}
/** 答卷明细的用户空壳(用户已注销 / 查不到时;字段与 shapeSurveyUser 同序) */
const SURVEY_USER_EMPTY = (id) => ({
	_id: String(id || ''), nickname: '', avatar: '', gender: 0, register_date: 0, last_login_date: 0,
	pay_total: 0, pay_count: 0, chat_total: 0, login_count: 0, vip_end_time: 0, wechat_id: '', beta_phone: '',
})
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** ObjectId → 24 位小写 hex(兼容字符串 / {$oid} / 驱动 ObjectId 对象——聚合里 $min('$_id') 的返回形态未在真库核实);拿不到合法值返回 '' */
function oidHex (v) {
	let s = ''
	if (typeof v === 'string') s = v
	else if (v && typeof v === 'object') s = typeof v.$oid === 'string' ? v.$oid : (typeof v.toHexString === 'function' ? v.toHexString() : String(v))
	s = s.trim().toLowerCase()
	return HEX24.test(s) ? s : ''
}

/** ObjectId 前 8 位 hex = 秒级时间戳 → 毫秒;非法给 0 */
function oidTime (v) {
	const h = oidHex(v)
	return h ? parseInt(h.slice(0, 8), 16) * 1000 : 0
}

/**
 * 答卷提交时间(ms):created_time(数字毫秒)有就用,否则从 _id 推。
 * Why:记录是云函数 add() 写的,不走 schema 默认值,created_time 多半缺失;阈值 1e12 顺带挡掉误存成秒 / 脏值的情况,回落 _id。
 * @param {{_id:*, created_time:*}} doc
 * @returns {number}
 */
function surveyTimeOf (doc) {
	const ct = num(doc && doc.created_time)
	return ct > 1e12 ? ct : oidTime(doc && doc._id)
}

/**
 * 版本 → 查询条件:v1 同时命中 version 缺失或显式为 null 的早期老记录;其余版本等值。
 * Why eq(null) 而不是 exists(false):Mongo 的 $eq:null 对「字段缺失」和「显式 null」都命中;
 *   10-05 真库实测 v1 的 1058 条里有 1 条 version 显式为 null,exists(false) 会漏掉它(总结 1057 ≠ 概览 1058)。
 * @param {string} version 须形如 v1 / v12 / v123
 * @returns {object|null} 入参不合法返回 null(调用方回 errMsg)
 */
function surveyVersionWhere (version) {
	const v = str(version).trim()
	if (!SURVEY_VERSION_RE.test(v)) return null
	return v === 'v1' ? dbCmd.or([{ version: 'v1' }, { version: dbCmd.eq(null) }]) : { version: v }
}

/** 自然序比较(q2 < q10、v9 < v10):数字段按数值比,其余按字符串比 */
function natCmp (a, b) {
	const ta = String(a).match(/\d+|\D+/g) || []
	const tb = String(b).match(/\d+|\D+/g) || []
	for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
		const x = ta[i]
		const y = tb[i]
		if (x === y) continue
		if (/^\d/.test(x) && /^\d/.test(y)) return (Number(x) - Number(y)) || cmpStr(x, y)
		return cmpStr(x, y)
	}
	return ta.length - tb.length
}

/** 答案值算不算「作答」:非空字符串 / 含非空字符串元素的数组 */
const surveyAnswered = (v) => (Array.isArray(v) ? v.some((x) => typeof x === 'string' && !!x.trim()) : (typeof v === 'string' && !!v.trim()))
/** 自由文本:非空字符串、且不是选项形态('A' / 'E_xxx') */
const isSurveyText = (v) => typeof v === 'string' && !!v.trim() && !SURVEY_OPT_VAL_RE.test(v)

/**
 * 概览分组合并(纯函数):aggregate 按 $version 分组的结果 → 各期一行;分组键 null / 缺失 / 空串并入 v1
 *   (total 相加、first 取小、last 取大、平均时长按人数加权——只对有平均值的组加权,整组没时长的不拉低均值)。
 * @param {Array<{_id:*, total:number, first_id:*, last_id:*, avg_duration:*}>} groups
 * @returns {Array<{version:string, total:number, first_time:number, last_time:number, avg_duration:number}>} 按版本自然序升序
 */
function mergeSurveyGroups (groups) {
	const map = Object.create(null)
	for (const g of groups || []) {
		if (!g) continue
		const v = g._id == null || g._id === '' ? 'v1' : String(g._id)
		const r = map[v] || (map[v] = { version: v, total: 0, first: '', last: '', dsum: 0, dn: 0 })
		const n = num(g.total)
		r.total += n
		const f = oidHex(g.first_id)
		const l = oidHex(g.last_id)
		if (f && (!r.first || f < r.first)) r.first = f
		if (l && (!r.last || l > r.last)) r.last = l
		const avg = Number(g.avg_duration)
		if (g.avg_duration != null && Number.isFinite(avg) && n > 0) { r.dsum += avg * n; r.dn += n }
	}
	return Object.keys(map).sort(natCmp).map((v) => {
		const r = map[v]
		return { version: v, total: r.total, first_time: oidTime(r.first), last_time: oidTime(r.last), avg_duration: r.dn ? Math.round(r.dsum / r.dn) : 0 }
	})
}

/**
 * 一期答卷的统计汇总(纯函数,不碰 db)。判定规则:
 *   值是数组 → 逐元素按选项处理(非选项形态的元素跳过);值是字符串且为 'A' / 'A_补充' → 选项;其余非空字符串 → 自由文本;
 *   非字符串 / 非数组的脏值跳过。同一份答卷同一字母只计一次(单选 = 人数,多选 = 人次);'E_xxx' 计入 E,补充文字另记 extras。
 * ⚠️ 计数表一律 Object.create(null):来源、补充文字、题号都来自用户提交,'constructor' / '__proto__' 之类的键不能撞原型。
 * @param {object[]} rows surveys 记录(用到 _id / user_id / answers / duration / source / created_time)
 * @param {string[]} [textQids] 题目定义里的问答题题号:这些题的字符串答案一律当自由文本,不做选项形态判定(没定义时不传,走形态判定)
 * @returns {{total:number, first_time:number, last_time:number,
 *   duration:{avg:number, median:number, min:number, max:number}, daily:Array<{day:string, n:number}>, sources:Array<{source:string, n:number}>,
 *   questions:Array<{id:string, answered:number, multi:boolean, options:Array<{key:string, n:number}>,
 *     extras:Array<{key:string, n:number, texts:Array<{text:string, n:number}>}>, text_n:number, samples:Array<{text:string, user_id:string, time:number}>}>}}
 */
function tallySurvey (rows, textQids) {
	const list = Array.isArray(rows) ? rows : []
	const textSet = new Set(Array.isArray(textQids) ? textQids : [])
	const durs = []
	const days = Object.create(null)
	const sources = Object.create(null)
	const qs = Object.create(null)
	let first = 0
	let last = 0
	const qOf = (id) => qs[id] || (qs[id] = { answered: 0, multi: false, options: Object.create(null), extras: Object.create(null), text_n: 0, texts: [] })

	for (const r of list) {
		if (!r || typeof r !== 'object') continue
		const t = surveyTimeOf(r)
		if (t > 0) {
			if (!first || t < first) first = t
			if (t > last) last = t
			const dk = dayKeyOf(t)
			days[dk] = (days[dk] || 0) + 1
		}
		const d = Number(r.duration)
		if (r.duration != null && r.duration !== '' && Number.isFinite(d) && d >= 0) durs.push(Math.round(d))
		const src = r.source == null ? '' : String(r.source)
		sources[src] = (sources[src] || 0) + 1

		const a = r.answers
		if (!a || typeof a !== 'object' || Array.isArray(a)) continue
		for (const qid of Object.keys(a)) {
			if (!SURVEY_QID_RE.test(qid)) continue
			const v = a[qid]
			const isArr = Array.isArray(v)
			if (!isArr && typeof v !== 'string') continue
			const q = qOf(qid)
			if (isArr) q.multi = true
			if (!surveyAnswered(v)) continue
			q.answered++
			if (!isArr && (textSet.has(qid) || isSurveyText(v))) {
				q.text_n++
				q.texts.push({ text: v.trim().slice(0, SURVEY_SAMPLE_LEN), user_id: str(r.user_id), time: t, _id: str(r._id) })
				continue
			}
			const letters = new Set()
			const extraSeen = new Set()
			for (const x of isArr ? v : [v]) {
				if (typeof x !== 'string' || !SURVEY_OPT_VAL_RE.test(x)) continue
				const k = x[0]
				if (!letters.has(k)) { letters.add(k); q.options[k] = (q.options[k] || 0) + 1 }
				const extra = x.slice(2).trim().slice(0, SURVEY_EXTRA_TEXT_LEN)
				if (extra && !extraSeen.has(k)) {
					extraSeen.add(k)
					const e = q.extras[k] || (q.extras[k] = { n: 0, texts: Object.create(null) })
					e.n++
					e.texts[extra] = (e.texts[extra] || 0) + 1
				}
			}
		}
	}

	durs.sort((x, y) => x - y)
	const dn = durs.length
	const duration = dn
		? {
			avg: Math.round(durs.reduce((s, x) => s + x, 0) / dn),
			median: Math.round(dn % 2 ? durs[(dn - 1) / 2] : (durs[dn / 2 - 1] + durs[dn / 2]) / 2),
			min: durs[0],
			max: durs[dn - 1],
		}
		: { avg: 0, median: 0, min: 0, max: 0 }

	/* 北京日分布:首末日跨度 ≤ SURVEY_FILL_DAYS_MAX 时把中间没人填的日补 0(折线图连续);超了只给有数据的日 */
	let daily = Object.keys(days).sort().map((day) => ({ day, n: days[day] }))
	if (first && last) {
		const span = Math.round((dayStartOf(last) - dayStartOf(first)) / DAY_MS)
		if (span <= SURVEY_FILL_DAYS_MAX) {
			daily = []
			for (let i = 0, s = dayStartOf(first); i <= span; i++, s += DAY_MS) {
				const day = dayKeyOf(s)
				daily.push({ day, n: days[day] || 0 })
			}
		}
	}

	return {
		total: list.length,
		first_time: first,
		last_time: last,
		duration,
		daily,
		sources: Object.keys(sources).map((source) => ({ source, n: sources[source] })).sort((x, y) => y.n - x.n || cmpStr(x.source, y.source)),
		questions: Object.keys(qs).sort(natCmp).map((id) => {
			const q = qs[id]
			return {
				id,
				answered: q.answered,
				multi: q.multi,
				options: Object.keys(q.options).sort().map((key) => ({ key, n: q.options[key] })),
				extras: Object.keys(q.extras).sort().map((key) => {
					const e = q.extras[key]
					const texts = Object.keys(e.texts).map((text) => ({ text, n: e.texts[text] }))
						.sort((x, y) => y.n - x.n || cmpStr(x.text, y.text)).slice(0, SURVEY_EXTRA_TEXTS_MAX)
					return { key, n: e.n, texts }
				}),
				text_n: q.text_n,
				samples: q.texts.sort((x, y) => y.time - x.time || cmpStr(y._id, x._id)).slice(0, SURVEY_SAMPLES_MAX)
					.map((x) => ({ text: x.text, user_id: x.user_id, time: x.time })),
			}
		}),
	}
}

/**
 * 从一条答案值里取展示文本(surveyTexts 用,纯函数)
 * @param {*} v answers[qid] 原值(字符串或数组)
 * @param {string} opt 选项字母;空 = 取自由文本原文
 * @param {RegExp|null} kwRe 关键字正则(可空;有多个候选时优先给命中关键字的)
 * @param {boolean} [asText] 已知是问答题:非空即文本,不排除选项形态
 * @returns {string} opt 模式下是去掉 'X_' 前缀的补充文字;自由文本模式下是原文(多选数组里的自由文本元素用「；」拼)
 */
function surveyPickText (v, opt, kwRe, asText) {
	const arr = (Array.isArray(v) ? v : [v]).filter((x) => typeof x === 'string')
	if (opt) {
		const hits = arr.filter((x) => x.startsWith(opt + '_')).map((x) => x.slice(opt.length + 1).trim())
		return (kwRe && hits.find((x) => kwRe.test(x))) || hits[0] || ''
	}
	return arr.filter((x) => (asText ? !!x.trim() : isSurveyText(x)) && (!kwRe || kwRe.test(x))).join('；')
}

/**
 * 分页扫一期答卷(按 _id 升序;先 count 再按页并行拉,每批 SURVEY_SCAN_PARALLEL 页;护栏 SURVEY_SCAN_MAX 条,超了标 truncated)
 * @param {object} where surveyVersionWhere 给的条件(可再叠加其他库内条件)
 * @param {object} [fields] 投影,缺省 SURVEY_SCAN_FIELDS(答卷明细 user 路径只要 SURVEY_CAND_FIELDS)
 * @returns {Promise<{rows:object[], truncated:boolean}>}
 */
async function scanSurveys (where, fields) {
	const col = db.collection(SURVEYS)
	const { total } = await col.where(where).count()
	const want = Math.min(num(total), SURVEY_SCAN_MAX)
	const pages = Math.ceil(want / SURVEY_SCAN_PAGE)
	const rows = []
	for (let p = 0; p < pages; p += SURVEY_SCAN_PARALLEL) {
		const batch = []
		for (let k = p; k < Math.min(pages, p + SURVEY_SCAN_PARALLEL); k++) {
			batch.push(col.where(where).field(fields || SURVEY_SCAN_FIELDS).orderBy('_id', 'asc').skip(k * SURVEY_SCAN_PAGE).limit(SURVEY_SCAN_PAGE).get())
		}
		for (const r of await Promise.all(batch)) rows.push(...((r && r.data) || []))
	}
	return { rows: rows.slice(0, SURVEY_SCAN_MAX), truncated: num(total) > SURVEY_SCAN_MAX }
}

/** 答卷明细用户行(金额分、时间 ms 原样给,缺省 0;字段与 SURVEY_USER_EMPTY 同序) */
function shapeSurveyUser (u) {
	return {
		_id: u._id, nickname: u.nickname || '', avatar: u.avatar || '', gender: num(u.gender),
		register_date: num(u.register_date), last_login_date: num(u.last_login_date),
		pay_total: num(u.pay_total), pay_count: num(u.pay_count), chat_total: num(u.chat_total), login_count: num(u.login_count),
		vip_end_time: num(u.vip_end_time), wechat_id: u.wechat_id || '', beta_phone: u.beta_phone || '',
	}
}

/** 答卷明细用户信息 map(users 只读;inChunks 分块 500 并行 in 查询;查不到的由调用方补 SURVEY_USER_EMPTY 空壳) */
async function fetchSurveyUsers (ids) {
	const map = Object.create(null)
	const uniq = [...new Set((ids || []).filter(Boolean).map(String))]
	const rows = await inChunks(uniq, 500, async (chunk) => (await db.collection(USERS).where({ _id: dbCmd.in(chunk) })
		.field(SURVEY_USER_FIELDS).limit(chunk.length).get()).data || [])
	for (const u of rows) map[u._id] = shapeSurveyUser(u)
	return map
}

/** 答卷明细行(answers 原样;时间走 surveyTimeOf) */
function shapeSurveyAnswer (d, users) {
	return {
		_id: d._id, user_id: d.user_id || '', user: users[d.user_id] || SURVEY_USER_EMPTY(d.user_id),
		answers: d.answers && typeof d.answers === 'object' ? d.answers : {},
		duration: num(d.duration), source: d.source == null ? '' : String(d.source), time: surveyTimeOf(d),
	}
}

/** 正数入参:数字或非空数字串、有限且 > 0 才算,否则 0(= 不限) */
function posNum (v) {
	if (typeof v !== 'number' && !(typeof v === 'string' && v.trim())) return 0
	const n = Number(v)
	return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * 答卷明细筛选 / 排序入参规范化(纯函数),并判定走哪条路径:
 *   db 路径 = 排序是答卷自身字段(time / duration)且没有任何用户维度筛选 → 库内分页;
 *   user 路径 = 排序是用户字段,或带了 pay / payMin / contact / gender / regFrom / regTo 任一 → 扫候选 + 内存筛排。
 * 校验:非法 sort 回落 time;dir 非 asc 即 desc;旧 sort 值(time_desc 等)拆成 sort + dir;payMin(元)非正数忽略;
 *   时间戳非有限正数忽略、from > to 交换;gender 只认 0 / 1 / 2(数字或数字串),'' / 不传 / 其他 = 全部;source 只认非空字符串,截 40 字。
 * @param {object} p surveyAnswers 入参
 * @returns {{sort:string, dir:string, pay:string, payMinFen:number, contact:string, gender:(number|null), source:string,
 *   timeFrom:number, timeTo:number, regFrom:number, regTo:number, mode:'db'|'user'}}
 */
function surveyAnswerOpts (p) {
	const o = p || {}
	let sort = str(o.sort).trim()
	let dir = o.dir === 'asc' ? 'asc' : 'desc'
	if (Object.prototype.hasOwnProperty.call(SURVEY_LEGACY_SORTS, sort)) [sort, dir] = SURVEY_LEGACY_SORTS[sort]
	if (!SURVEY_ROW_SORTS.has(sort) && !SURVEY_USER_SORTS.has(sort)) sort = 'time'
	const pay = o.pay === 'paid' || o.pay === 'unpaid' ? o.pay : ''
	const payYuan = posNum(o.payMin)
	const contact = o.contact === 'yes' || o.contact === 'no' ? o.contact : ''
	const g = o.gender
	const gn = typeof g === 'number' || (typeof g === 'string' && /^\s*\d\s*$/.test(g)) ? Number(g) : NaN
	const gender = gn === 0 || gn === 1 || gn === 2 ? gn : null
	const source = typeof o.source === 'string' ? o.source.trim().slice(0, SURVEY_SOURCE_LEN) : ''
	let timeFrom = posNum(o.timeFrom)
	let timeTo = posNum(o.timeTo)
	if (timeFrom && timeTo && timeFrom > timeTo) [timeFrom, timeTo] = [timeTo, timeFrom]
	let regFrom = posNum(o.regFrom)
	let regTo = posNum(o.regTo)
	if (regFrom && regTo && regFrom > regTo) [regFrom, regTo] = [regTo, regFrom]
	const userFilter = !!(pay || payYuan || contact || gender !== null || regFrom || regTo)
	return {
		sort, dir, pay, payMinFen: payYuan ? Math.round(payYuan * 100) : 0, contact, gender, source,
		timeFrom, timeTo, regFrom, regTo, mode: SURVEY_USER_SORTS.has(sort) || userFilter ? 'user' : 'db',
	}
}

/**
 * 提交时间范围 → _id 字符串范围条件(纯函数;含端点)。
 * Why 用 _id 不用 created_time:surveys 全部记录都没有 created_time(10-05 真库实测),_id 是 24 位 hex 字符串、前 8 位是秒级时间戳,
 *   字符串比较即时间比较;下界秒 hex 补 16 个 0、上界补 16 个 f,端点所在的那一秒整秒命中。
 * @param {number} fromMs 0 = 不限
 * @param {number} toMs 0 = 不限
 * @returns {object|null} dbCmd 条件;两侧都不限返回 null
 */
function surveyIdRange (fromMs, toMs) {
	const secHex = (ms) => Math.min(0xffffffff, Math.floor(ms / 1000)).toString(16).padStart(8, '0')
	const lo = fromMs > 0 ? secHex(fromMs) + '0'.repeat(16) : ''
	const hi = toMs > 0 ? secHex(toMs) + 'f'.repeat(16) : ''
	if (lo && hi) return dbCmd.gte(lo).and(dbCmd.lte(hi))
	if (lo) return dbCmd.gte(lo)
	if (hi) return dbCmd.lte(hi)
	return null
}

/**
 * user 路径的「筛选 + 排序 + 切页」(纯函数,不碰 db)
 *   - 用户维度筛:pay paid = pay_total > 0 / unpaid = ≤ 0;payMinFen = pay_total ≥ 它(分);contact yes = 微信号或手机号非空 / no = 都空;
 *     gender 等值;注册时间范围含端点,注册时间未知(0)一律不命中——用户不存在(空壳)时同理:unpaid 命中、contact no 命中、注册时间不命中、gender 按 0。
 *   - 排序:缺省值按 0;同值按 _id 倒序(翻页稳定);time 直接比 _id。
 * @param {object[]} rows 候选答卷(_id / user_id / duration / source / created_time)
 * @param {Object<string,object>} users fetchSurveyUsers 给的 map
 * @param {object} o surveyAnswerOpts 的结果
 * @param {{skip:number, size:number}} pg pageOf 的结果
 * @returns {{total:number, list:object[]}} total = 筛后条数;list = 本页候选(原对象)
 */
function pageSurveyRows (rows, users, o, pg) {
	const shell = SURVEY_USER_EMPTY('')
	const items = []
	for (const r of rows || []) {
		if (!r) continue
		const u = users[r.user_id] || shell
		const paid = num(u.pay_total)
		if (o.pay === 'paid' && !(paid > 0)) continue
		if (o.pay === 'unpaid' && paid > 0) continue
		if (o.payMinFen > 0 && !(paid >= o.payMinFen)) continue
		if (o.contact && !!(str(u.wechat_id).trim() || str(u.beta_phone).trim()) !== (o.contact === 'yes')) continue
		if (o.gender != null && num(u.gender) !== o.gender) continue
		if (o.regFrom || o.regTo) {
			const rd = num(u.register_date)
			if (!(rd > 0) || (o.regFrom && rd < o.regFrom) || (o.regTo && rd > o.regTo)) continue
		}
		items.push({ r, id: str(r._id), v: o.sort === 'duration' ? num(r.duration) : (SURVEY_USER_SORTS.has(o.sort) ? num(u[o.sort]) : 0) })
	}
	const sgn = o.dir === 'asc' ? 1 : -1
	items.sort((a, b) => (o.sort === 'time' ? sgn * cmpStr(a.id, b.id) : sgn * (a.v - b.v)) || cmpStr(b.id, a.id))
	return { total: items.length, list: items.slice(pg.skip, pg.skip + pg.size).map((x) => x.r) }
}

/** 来源分组合并(纯函数):null / 缺失与空串都记 '';按人数降序、同数按来源字典序 */
function mergeSourceGroups (groups) {
	const map = Object.create(null)
	for (const g of groups || []) {
		if (!g) continue
		const k = g._id == null ? '' : String(g._id)
		map[k] = (map[k] || 0) + num(g.n)
	}
	return Object.keys(map).map((source) => ({ source, n: map[source] })).sort((x, y) => y.n - x.n || cmpStr(x.source, y.source))
}

/** 一期的来源分布(只按版本,不受其他筛选影响;给筛选下拉用);聚合失败降级 [] 不碍列表 */
async function surveySourceDist (versionWhere) {
	try {
		const { data } = await db.collection(SURVEYS).aggregate().match(versionWhere)
			.group({ _id: '$source', n: $agg.sum(1) }).limit(SURVEY_SOURCES_MAX).end()
		return mergeSourceGroups(data)
	} catch (e) {
		console.log('[drama-admin][surveySourceDist]', e && e.message)
		return []
	}
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
					.group({ _id: '$ending_id', n: $agg.sum(1), users: $agg.addToSet('$user_id') }).limit(200).end()),
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

	/**
	 * @function overview 总览统计台(09-09 黎令:进小剧场监控第一眼看到的报表)。
	 *   时间范围 [from, to](≤31 天,缺省=今天),六表各扫一遍(投影+分页护栏)算:
	 *   create 执笔(新建/交付/判死/初审公开·不合规)/ play 玩(开局/玩家/完局/弃局/计费模式/自由本 vs 官方本)/
	 *   endings 结局(解锁数/人数/稀有度)/ money 钱(实收/退款/发放/护栏/扣费构成)/ quality 问题(四类错误/前端异常分型/举报)/
	 *   hot 时段热门本 Top5;另给 now 此刻快照(留灯=进行中的局,分长明/限时;待处理举报;公开/私有/执笔中本数)与 heat_top 热度榜;
	 *   series 按桶(≤2 天按小时,否则按天)给趋势,桶补齐无缺口。不扫 drama_events 全量,只扫错误四类(走 ev+t 索引)。
	 * @param {object} p { token, from, to }
	 */
	async overview ({ from, to } = {}) {
		try {
			const nowMs = Date.now()
			const toMs = num(to) || nowMs
			let fromMs = num(from) || dayStartOf(nowMs)
			if (fromMs >= toMs) return { errMsg: '时间范围无效' }
			if (toMs - fromMs > OVERVIEW_SPAN_MAX) fromMs = toMs - OVERVIEW_SPAN_MAX
			const bucket = (toMs - fromMs) <= 2 * DAY_MS ? 'hour' : 'day'
			const step = bucket === 'hour' ? HOUR_MS : DAY_MS
			const keyOf = (ms) => (bucket === 'hour' ? Math.floor(ms / HOUR_MS) * HOUR_MS : dayStartOf(ms))
			const seriesEnd = Math.min(toMs, nowMs)
			const buckets = {}
			const order = []
			for (let t = keyOf(fromMs); t <= seriesEnd; t += step) {
				buckets[t] = { t, label: bucketLabel(t, bucket), created: 0, delivered: 0, dead: 0, sessions: 0, _players: new Set(), settled: 0, unlocks: 0, income: 0, refund: 0, grant: 0, errors: 0, reports: 0 }
				order.push(t)
			}
			const bk = (ms) => buckets[keyOf(ms)]

			const [sc, se, en, rw, ev, rp, lantern, pendingRes, pubRes, privRes, writingRes, heatRes] = await Promise.all([
				scanRange(SCRIPTS, 'create_time', fromMs, toMs, { status: true, visibility: true, audit_status: true, creator_id: true, create_time: true }, { source: 'free' }),
				scanRange(SESSIONS, 'create_time', fromMs, toMs, { user_id: true, script_id: true, state: true, pay_mode: true, unlocked: true, turn_count: true, create_time: true }),
				scanRange(ENDINGS, 'unlock_time', fromMs, toMs, { user_id: true, script_id: true, ending_id: true, rarity: true, unlock_time: true }),
				scanRange(REWARDS, 'create_time', fromMs, toMs, { type: true, amount: true, status: true, create_time: true }),
				scanRange(EVENTS, 't', fromMs, toMs, { ev: true, t: true, data: true }, { ev: dbCmd.in(ERROR_EVS) }),
				scanRange(REPORTS, 'create_time', fromMs, toMs, { status: true, script_id: true, create_time: true }),
				safe(db.collection(SESSIONS).aggregate().match({ state: 'playing' }).group({ _id: { pm: '$pay_mode', un: '$unlocked' }, n: $agg.sum(1) }).limit(100).end()),
				db.collection(REPORTS).where({ status: 'pending' }).count(),
				db.collection(SCRIPTS).where(scriptWhere('public')).count(),
				db.collection(SCRIPTS).where(scriptWhere('private')).count(),
				db.collection(SCRIPTS).where(scriptWhere('writing')).count(),
				db.collection(SCRIPTS).where({ source: 'free', status: 1 })
					.field({ title: true, heat_score: true, heat: true, stat_player_count: true, play_count: true, visibility: true })
					.orderBy('heat_score', 'desc').limit(5).get(),
			])

			/* 执笔 */
			const create = { n: 0, delivered: 0, writing: 0, dead: 0, deleted: 0, public: 0, private: 0, ai_fail: 0, ai_pending: 0, creators: 0 }
			const creators = new Set()
			for (const s of sc.rows) {
				create.n++
				const st = num(s.status)
				if (st === 1) {
					create.delivered++
					if (s.visibility === 'public') create.public++; else create.private++
					if (s.audit_status === 'fail') create.ai_fail++; else if (s.audit_status === 'pending') create.ai_pending++
				} else if (st === 0) create.writing++
				else if (st === -1) create.dead++
				else if (st === -2) create.deleted++
				if (s.creator_id) creators.add(s.creator_id)
				const b = bk(num(s.create_time))
				if (b) { b.created++; if (st === 1) b.delivered++; if (st === -1) b.dead++ }
			}
			create.creators = creators.size
			create.dead_rate = ratio(create.dead, create.n)
			create.fail_rate = ratio(create.ai_fail, create.delivered)

			/* 玩 */
			const play = { sessions: 0, players: 0, settled: 0, abandoned: 0, playing: 0, other: 0, avg_turns: 0, paid: 0, by_mode: {}, by_source: { free: 0, official: 0, unknown: 0 } }
			const players = new Set()
			const perScript = {}
			let turns = 0
			for (const x of se.rows) {
				play.sessions++
				if (x.user_id) players.add(x.user_id)
				turns += num(x.turn_count)
				const st = x.state
				if (st === 'settled') play.settled++
				else if (st === 'abandoned') play.abandoned++
				else if (st === 'playing') play.playing++
				else play.other++
				const mode = x.unlocked ? 'full' : (x.pay_mode || 'unknown')
				play.by_mode[mode] = (play.by_mode[mode] || 0) + 1
				if (mode === 'full' || mode === 'per_turn') play.paid++
				if (x.script_id) {
					const ps = perScript[x.script_id] = perScript[x.script_id] || { n: 0, u: new Set() }
					ps.n++; if (x.user_id) ps.u.add(x.user_id)
				}
				const b = bk(num(x.create_time))
				if (b) { b.sessions++; if (x.user_id) b._players.add(x.user_id); if (st === 'settled') b.settled++ }
			}
			play.players = players.size
			play.avg_turns = play.sessions ? +(turns / play.sessions).toFixed(1) : 0
			play.settle_rate = ratio(play.settled, play.sessions)
			play.abandon_rate = ratio(play.abandoned, play.sessions)
			play.paid_share = ratio(play.paid, play.sessions)
			const sids = Object.keys(perScript)
			const briefs = await fetchScriptsBrief(sids)
			for (const sid of sids) {
				const bsc = briefs[sid]
				const src = bsc ? (bsc.source === 'free' ? 'free' : 'official') : 'unknown'
				play.by_source[src] += perScript[sid].n
			}
			const hot = sids.map((sid) => {
				const bsc = briefs[sid] || {}
				return { _id: sid, title: bsc.title || '(已不存在)', source: bsc.source || '', visibility: bsc.visibility || '', heat_score: num(bsc.heat_score), sessions: perScript[sid].n, players: perScript[sid].u.size }
			}).sort((a, b) => b.sessions - a.sessions || b.players - a.players).slice(0, 5)

			/* 结局 */
			const endings = { unlocks: 0, users: 0, scripts: 0, by_rarity: {} }
			const eUsers = new Set(); const eScripts = new Set()
			for (const e of en.rows) {
				endings.unlocks++
				if (e.user_id) eUsers.add(e.user_id)
				if (e.script_id) eScripts.add(e.script_id)
				const r = e.rarity || '常规'
				endings.by_rarity[r] = (endings.by_rarity[r] || 0) + 1
				const b = bk(num(e.unlock_time)); if (b) b.unlocks++
			}
			endings.users = eUsers.size; endings.scripts = eScripts.size

			/* 钱(口径同 dailyMoney) */
			const money = { income: 0, refund: 0, grant: 0, net: 0, ratio: 0, warn: false, n_charge: 0, n_refund: 0, n_grant: 0, full_unlocks: 0, by_type: {} }
			for (const r of rw.rows) {
				if (r.status && r.status !== 'done') continue
				const amt = num(r.amount); const type = String(r.type || '')
				const b = bk(num(r.create_time))
				if (REFUND_TYPES.has(type)) { money.refund += Math.abs(amt); money.n_refund++; if (b) b.refund += Math.abs(amt) }
				else if (amt < 0) { money.income += -amt; money.n_charge++; money.by_type[type] = (money.by_type[type] || 0) + (-amt); if (type === 'full_unlock') money.full_unlocks++; if (b) b.income += -amt }
				else if (amt > 0) { money.grant += amt; money.n_grant++; if (b) b.grant += amt }
			}
			money.net = money.income - money.refund
			money.ratio = money.net > 0 ? +(money.grant / money.net).toFixed(3) : (money.grant > 0 ? 9.999 : 0)
			money.warn = money.grant > 0 && (money.net <= 0 || money.ratio > 0.5)

			/* 问题信号 */
			const quality = { errors: { fe_error: 0, gen_dead: 0, create_wait_fail: 0, bgm_error: 0 }, fe_kinds: {}, reports: 0, reports_by_status: {} }
			for (const e of ev.rows) {
				if (quality.errors[e.ev] !== undefined) quality.errors[e.ev]++
				if (e.ev === 'fe_error') { const d = e.data || {}; const k = d.kind || (d.where ? 'enter' : 'other'); quality.fe_kinds[k] = (quality.fe_kinds[k] || 0) + 1 }
				const b = bk(num(e.t)); if (b) b.errors++
			}
			for (const r of rp.rows) {
				quality.reports++
				const st = r.status || 'pending'
				quality.reports_by_status[st] = (quality.reports_by_status[st] || 0) + 1
				const b = bk(num(r.create_time)); if (b) b.reports++
			}

			/* 此刻快照 */
			const lanterns = { playing: 0, eternal: 0, timed: 0 }
			for (const x of lantern) {
				const k = x._id || {}; const n = num(x.n)
				lanterns.playing += n
				if (k.un || ETERNAL_MODES.has(k.pm)) lanterns.eternal += n; else lanterns.timed += n
			}
			const now = {
				lanterns, reports_pending: num(pendingRes && pendingRes.total),
				scripts: { public: num(pubRes && pubRes.total), private: num(privRes && privRes.total), writing: num(writingRes && writingRes.total) },
			}
			const heatTop = (heatRes.data || []).map((s) => ({
				_id: s._id, title: s.title || '(未命名)', heat_score: num(s.heat_score), heat: num(s.heat),
				players: num(s.stat_player_count), play_count: num(s.play_count), visibility: s.visibility || '',
			}))

			const series = order.map((t) => { const b = buckets[t]; const { _players, ...rest } = b; return { ...rest, players: _players.size } })
			return {
				errMsg: '',
				data: {
					from: fromMs, to: toMs, bucket, now, create, play, endings, money, quality, hot, heat_top: heatTop, series,
					truncated: { scripts: sc.truncated, sessions: se.truncated, endings: en.truncated, rewards: rw.truncated, events: ev.truncated, reports: rp.truncated },
				},
			}
		} catch (e) {
			return { errMsg: errText(e, 'overview') }
		}
	},

	/**
	 * @function listBetaCandidates 内测招募候选(09-09 黎令):留了微信号/手机号(问卷 v3 必填 → wechat_id_time>0)的用户,
	 *   带付费(用户表累计 + 订单近 30 天/最近一单)、注册与登录、问卷 v3 三题、体验版足迹(有剧场局或 enter_theater 事件=进过)、跟进标记。
	 *   候选 ≤3000 人在内存里筛/排/分页(用户表能下推的条件都下推);目的=把充值多的加进私域邀请内测。
	 * @param {object} p { token, paid:'all'|'paid'|'unpaid', minPay(元), timeField:'contact'|'register'|'login'|'pay', from, to,
	 *   sort, dir, keyword(昵称/微信号/手机号/uid), invite:'all'|'none'|status, beta:'all'|'entered'|'not', page, size }
	 */
	async listBetaCandidates ({ paid = 'all', minPay = 0, timeField = 'contact', from, to, sort = 'pay_total', dir = 'desc', keyword = '', invite = 'all', beta = 'all', page = 1, size = 20 } = {}) {
		try {
			const pg = pageOf(page, size)
			const sortKey = BETA_SORTS.has(sort) ? sort : 'pay_total'
			const desc = dir !== 'asc'
			const fromMs = num(from); const toMs = num(to)
			const hasRange = fromMs > 0 && toMs > fromMs
			const minFen = Math.max(0, Math.round(num(minPay) * 100))

			/* 1. 候选:用户表条件下推 */
			const conds = [{ wechat_id_time: dbCmd.gt(0) }]
			if (paid === 'paid') conds.push({ pay_total: dbCmd.gt(0) })
			else if (paid === 'unpaid') conds.push(dbCmd.or([{ pay_total: dbCmd.lte(0) }, { pay_total: dbCmd.exists(false) }]))
			if (minFen > 0) conds.push({ pay_total: dbCmd.gte(minFen) })
			if (hasRange && BETA_TIME_FIELDS[timeField]) conds.push({ [BETA_TIME_FIELDS[timeField]]: dbCmd.gte(fromMs).and(dbCmd.lte(toMs)) })
			const kw = str(keyword, 40).trim()
			const re = keywordRe(kw)
			if (re) conds.push(dbCmd.or([{ nickname: re }, { wechat_id: re }, { beta_phone: re }, { _id: kw }]))
			const where = conds.length === 1 ? conds[0] : dbCmd.and(conds)
			const users = []
			let truncated = false
			const pages = BETA_CAND_MAX / 500
			for (let p = 0; p < pages; p++) {
				const { data } = await db.collection(USERS).where(where).field(BETA_USER_FIELDS)
					.orderBy('wechat_id_time', 'desc').skip(p * 500).limit(500).get()
				if (!data || !data.length) break
				users.push(...data)
				if (data.length < 500) break
				if (p === pages - 1) truncated = true
			}
			const ids = users.map((u) => u._id)

			/* 2. 联表:订单(累计/近 30 天)、剧场局、enter_theater 首次、跟进 */
			const day30 = Date.now() - 30 * DAY_MS
			const [payAll, pay30, theater, enters, invites] = await Promise.all([
				aggByUser(ORDERS, ids, { status: 1 }, { n: $agg.sum(1), total: $agg.sum('$total_fee'), last: $agg.max('$paid_time') }),
				aggByUser(ORDERS, ids, { status: 1, paid_time: dbCmd.gte(day30) }, { total: $agg.sum('$total_fee') }),
				aggByUser(SESSIONS, ids, {}, { n: $agg.sum(1), first: $agg.min('$create_time'), last: $agg.max('$update_time') }),
				aggByUser(EVENTS, ids, { ev: 'enter_theater' }, { first: $agg.min('$t') }),
				fetchInvites(ids),
			])
			const pm = {}; for (const x of payAll) pm[x._id] = x
			const p30 = {}; for (const x of pay30) p30[x._id] = num(x.total)
			const th = {}; for (const x of theater) th[x._id] = { sessions: num(x.n), first: num(x.first), last: num(x.last) }
			for (const x of enters) { const t = th[x._id] = th[x._id] || { sessions: 0, first: 0, last: 0 }; t.first = t.first ? Math.min(t.first, num(x.first)) : num(x.first) }

			/* 3. 组行 + 其他表条件在内存里筛 */
			let rows = users.map((u) => shapeBetaRow(u, pm[u._id], p30[u._id], th[u._id], invites[u._id]))
			if (hasRange && timeField === 'pay') rows = rows.filter((r) => r.pay.last_paid >= fromMs && r.pay.last_paid <= toMs)
			if (beta === 'entered') rows = rows.filter((r) => r.theater.entered)
			else if (beta === 'not') rows = rows.filter((r) => !r.theater.entered)
			if (invite === 'none') rows = rows.filter((r) => !r.invite.status)
			else if (invite === 'todo') rows = rows.filter((r) => !r.invite.status || r.invite.status === 'pending') // 只看待加 = 未处理 + 待同意
			else if (invite !== 'all' && INVITE_STATUS.includes(invite)) rows = rows.filter((r) => r.invite.status === invite)

			/* 4. 排序(同值按留联系方式新到旧)+ 汇总 + 分页 + 本页问卷 */
			const sv = (r) => ({
				pay_total: r.pay.total, pay_count: r.pay.count, recent_pay: r.pay.recent30, last_pay: r.pay.last_paid,
				wechat_id_time: r.contact.time, last_login_date: r.last_login_date, register_date: r.register_date, vip_end_time: r.vip_end_time,
				chat_total: r.chat_total, theater_sessions: r.theater.sessions, login_count: r.login_count,
			})[sortKey] || 0
			rows.sort((a, b) => ((sv(b) - sv(a)) * (desc ? 1 : -1)) || (b.contact.time - a.contact.time))
			const summary = rows.reduce((a, r) => {
				a.n++; if (r.pay.total > 0) a.paid++; a.pay_total += r.pay.total; a.recent30 += r.pay.recent30
				if (r.theater.entered) a.entered++; if (r.invite.status) a.followed++; if (r.invite.status === 'joined') a.joined++
				return a
			}, { n: 0, paid: 0, pay_total: 0, recent30: 0, entered: 0, followed: 0, joined: 0 })
			const pageRows = rows.slice(pg.skip, pg.skip + pg.size)
			const answers = await fetchSurveyV3(pageRows.map((r) => r._id))
			for (const r of pageRows) r.survey = answers[r._id] || null
			return { errMsg: '', data: { list: pageRows, total: rows.length, page: pg.page, size: pg.size, sort: sortKey, dir: desc ? 'desc' : 'asc', summary, truncated } }
		} catch (e) {
			return { errMsg: errText(e, 'listBetaCandidates') }
		}
	},

	/**
	 * @function setBetaInvite 跟进标记(写 beta_invites,一人一条 upsert):status ∈ ''/added/invited/joined/refused,note ≤200 字,operator=登录账号
	 * @param {object} p { token, user_id, status, note }
	 */
	async setBetaInvite ({ user_id, status, note } = {}) {
		try {
			const uid = str(user_id, 40).trim()
			const st = String(status == null ? '' : status)
			const n = trimNote(note)
			if (!uid) return { errMsg: '缺少用户 id' }
			if (!INVITE_STATUS.includes(st)) return { errMsg: '无效的跟进态' }
			const { data: uArr } = await db.collection(USERS).doc(uid).field({ _id: true }).get()
			if (!uArr || !uArr[0]) return { errMsg: '用户不存在' }
			const now = Date.now()
			const doc = { status: st, note: n, operator: this.operator, update_time: now }
			const { data: ex } = await db.collection(BETA).where({ user_id: uid }).limit(1).get()
			if (ex && ex[0]) await db.collection(BETA).doc(ex[0]._id).update(doc)
			else await db.collection(BETA).add({ user_id: uid, ...doc, create_time: now })
			console.log('[drama-admin] 跟进标记', { uid, status: st, by: this.operator })
			return { errMsg: '', data: { user_id: uid, ...doc } }
		} catch (e) {
			return { errMsg: errText(e, 'setBetaInvite') }
		}
	},

	/**
	 * @function listQualityUsers 优质老用户候选(09-13 黎令:把最优质的老用户按顺序加进私域)——
	 *   本方法只取「原始特征」,不打分:打分公式与权重在后台 utils/quality-score.js(纯函数),前端可切权重预设即时重排。
	 *   候选池 = 留了微信号/手机号的用户(09-13 黎定:内测招募的核心是能加上,没留联系方式的没用;原「近期活跃老用户」池已删)。
	 *   付费 / 未付费的区分在前端按 f.pay_fen 切。
	 *   特征来源(全部只读):users 本表(登录/聊天/累计获得采贝/领取次数/看广告/付费/会员/加到我的小程序)、
	 *   roles(上线捏崽数、优质角色、被喜欢/被聊)、roles_my(捏崽提交/草稿)、roles_like(喜欢过的角色)、users_prompt(微调身份)、
	 *   users_ai_imgs(AI 出图)、drama_scripts(写自由本/被玩)、drama_sessions + enter_theater(体验版足迹)、surveys(填过几期 + v3 决策题)、
	 *   orders(近 30 天充值/最近一单)、invites(邀请人数/成功)、beta_invites(跟进态)。
	 * @param {object} p { token }
	 */
	async listQualityUsers () {
		try {
			const t0 = Date.now()
			const nowMs = Date.now()
			const ctx = { errors: [], timing: {} }

			/* 1. 候选池:留了联系方式 */
			const where = { wechat_id_time: dbCmd.gt(0) }
			const users = []
			let truncated = false
			const tu = Date.now()
			const { total: poolSize } = await db.collection(USERS).where(where).count()
			if (num(poolSize) <= QUALITY_POOL_MAX) {
				/* 不超上限:按 _id 分页并行拉(_id 稳定,不怕拉取中途有人登录导致翻页错位) */
				const pageTasks = []
				for (let p = 0; p * 500 < num(poolSize); p++) {
					pageTasks.push(db.collection(USERS).where(where).field(QUALITY_USER_FIELDS).orderBy('_id', 'asc').skip(p * 500).limit(500).get())
				}
				for (const r of await Promise.all(pageTasks)) users.push(...(r.data || []))
			} else {
				/* 超上限:按最近登录倒序截前 QUALITY_POOL_MAX 人 */
				truncated = true
				for (let p = 0; p * 500 < QUALITY_POOL_MAX; p++) {
					const { data } = await db.collection(USERS).where(where).field(QUALITY_USER_FIELDS)
						.orderBy('last_login_date', 'desc').skip(p * 500).limit(500).get()
					if (!data || !data.length) break
					users.push(...data)
					if (data.length < 500) break
				}
			}
			ctx.timing.users = Date.now() - tu
			const ids = users.map((u) => u._id)
			const day30 = nowMs - 30 * DAY_MS

			/* 2. 各表按用户聚合(并行;单表失败降级为 0 并记 errors) */
			const [
				roles, rolesHq, rolesMy, likes, prompts, imgs, scripts, scriptsPub, sessions, enters, surveys, pay30, payLast, invites, invitesOk, follow, v3,
			] = await Promise.all([
				aggUserMap(ctx, 'roles', ROLES, 'creator_id', ids, {}, { n: $agg.sum(1), likes: $agg.sum('$like_count'), talks: $agg.sum('$talk_count') }),
				aggUserMap(ctx, 'roles_hq', ROLES, 'creator_id', ids, { high_quality: true }, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'roles_my', 'roles_my', 'creator_id', ids, {}, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'roles_like', 'roles_like', 'user_id', ids, {}, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'users_prompt', 'users_prompt', 'user_id', ids, {}, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'ai_imgs', 'users_ai_imgs', 'user_id', ids, {}, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'scripts', SCRIPTS, 'creator_id', ids, { source: 'free', status: dbCmd.in([0, 1]) }, { n: $agg.sum(1), players: $agg.sum('$stat_player_count') }),
				aggUserMap(ctx, 'scripts_pub', SCRIPTS, 'creator_id', ids, { source: 'free', status: 1, visibility: 'public' }, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'sessions', SESSIONS, 'user_id', ids, {}, { n: $agg.sum(1), first: $agg.min('$create_time') }),
				aggUserMap(ctx, 'enter_theater', EVENTS, 'user_id', ids, { ev: 'enter_theater' }, { first: $agg.min('$t') }),
				aggUserMap(ctx, 'surveys', SURVEYS, 'user_id', ids, {}, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'pay30', ORDERS, 'user_id', ids, { status: 1, paid_time: dbCmd.gte(day30) }, { total: $agg.sum('$total_fee') }),
				aggUserMap(ctx, 'pay_last', ORDERS, 'user_id', ids, { status: 1 }, { last: $agg.max('$paid_time') }),
				aggUserMap(ctx, 'invites', 'invites', 'inviter_uid', ids, {}, { n: $agg.sum(1) }),
				aggUserMap(ctx, 'invites_ok', 'invites', 'inviter_uid', ids, { success: true }, { n: $agg.sum(1) }),
				(async () => { const s = Date.now(); const m = await fetchInvites(ids); ctx.timing.follow = Date.now() - s; return m })(),
				(async () => { const s = Date.now(); const m = await fetchSurveyV3(ids); ctx.timing.survey_v3 = Date.now() - s; return m })(),
			])
			const n = (m, id, k) => num(m[id] && m[id][k || 'n'])

			/* 3. 组行:只给原始特征(f)与展示字段,分数由前端 quality-score.js 算 */
			const list = users.map((u) => {
				const id = u._id
				const theaterFirst = [n(sessions, id, 'first'), n(enters, id, 'first')].filter((x) => x > 0)
				return {
					_id: id, nickname: u.nickname || '', avatar: u.avatar || '', gender: num(u.gender),
					register_date: num(u.register_date), last_login_date: num(u.last_login_date),
					contact: { wechat_id: u.wechat_id || '', beta_phone: u.beta_phone || '', time: num(u.wechat_id_time) },
					f: {
						login: num(u.login_count), chat: num(u.chat_total), cb_total: num(u.receive_cb_total), cb_count: num(u.receive_cb_count),
						ad: num(u.video_ad_count), cb_num: num(u.cb_num), add_mp: num(u.add_mp_reward_time) > 0 ? 1 : 0,
						likes_given: n(likes, id),
						pay_fen: num(u.pay_total), pay_n: num(u.pay_count), pay30_fen: n(pay30, id, 'total'), last_paid: n(payLast, id, 'last'),
						vip: num(u.vip_end_time) > nowMs ? 1 : 0,
						roles_pub: n(roles, id), roles_hq: n(rolesHq, id), roles_likes: n(roles, id, 'likes'), roles_talks: n(roles, id, 'talks'),
						roles_my: n(rolesMy, id), prompts: n(prompts, id), ai_imgs: n(imgs, id),
						scripts: n(scripts, id), scripts_pub: n(scriptsPub, id), script_players: n(scripts, id, 'players'),
						sessions: n(sessions, id), invites: n(invites, id), invites_ok: n(invitesOk, id), surveys: n(surveys, id),
					},
					theater: { entered: theaterFirst.length > 0, sessions: n(sessions, id), first: theaterFirst.length ? Math.min(...theaterFirst) : 0 },
					survey: v3[id] || null,
					invite: follow[id] || { status: '', note: '', operator: '', update_time: 0 },
				}
			})
			ctx.timing.total = Date.now() - t0
			return {
				errMsg: '',
				data: {
					list, total: list.length, pool_size: num(poolSize), truncated,
					generated_at: nowMs, timing: ctx.timing, errors: ctx.errors,
				},
			}
		} catch (e) {
			return { errMsg: errText(e, 'listQualityUsers') }
		}
	},

	/**
	 * @function findUsers 找用户(后台「发放奖励」第一步):_id 精确 / 用户名精确 / 昵称模糊;auto = 24 位 hex 当 _id,否则 用户名精确 或 昵称模糊
	 * @param {object} p { token, q, by:'auto'|'_id'|'username'|'nickname', limit }
	 */
	async findUsers ({ q, by = 'auto', limit = 20 } = {}) {
		try {
			const kw = str(q, 60).trim()
			if (!kw) return { errMsg: '请输入 _id、用户名或昵称' }
			const n = Math.min(50, Math.max(1, Math.floor(num(limit) || 20)))
			const users = db.collection(USERS)
			const get = (w, lim) => users.where(w).field(USER_DETAIL_FIELDS).orderBy('last_login_date', 'desc').limit(lim).get().then((r) => r.data || [])
			let mode = by
			let exact = []
			let fuzzy = []
			if (by === '_id' || (by === 'auto' && HEX24.test(kw))) { exact = await get({ _id: kw }, 1); mode = '_id' }
			else if (by === 'username') exact = await get({ username: kw }, n)
			else {
				/* 昵称重名很常见(09-13 实测「熙熙」一搜 17 个全等):全等的先查满,模糊的只补剩下的名额,免得上限把全等挤掉 */
				exact = await get(by === 'nickname' ? { nickname: kw } : dbCmd.or([{ username: kw }, { nickname: kw }]), n)
				if (exact.length < n) {
					const seen = exact.map((u) => u._id)
					const fw = { nickname: keywordRe(kw) }
					fuzzy = await get(seen.length ? dbCmd.and([fw, { _id: dbCmd.nin(seen) }]) : fw, n - exact.length)
				}
				if (by === 'auto') mode = 'auto'
			}
			const list = [...exact.map((u) => ({ ...shapeUser(u), exact: true })), ...fuzzy.map((u) => ({ ...shapeUser(u), exact: false }))]
			return { errMsg: '', data: { list, total: list.length, exact_count: exact.length, mode, capped: list.length >= n } }
		} catch (e) {
			return { errMsg: errText(e, 'findUsers') }
		}
	},

	/**
	 * @function userDetail 用户详情 + 最近 10 笔后台赠送流水
	 * @param {object} p { token, user_id }
	 */
	async userDetail ({ user_id } = {}) {
		try {
			const uid = str(user_id, 40).trim()
			if (!uid) return { errMsg: '缺少用户 id' }
			const { data } = await db.collection(USERS).doc(uid).field(USER_DETAIL_FIELDS).get()
			const u = data && data[0]
			if (!u) return { errMsg: '用户不存在' }
			return { errMsg: '', data: { user: shapeUser(u), grants: await fetchGrants(uid, 10) } }
		} catch (e) {
			return { errMsg: errText(e, 'userDetail') }
		}
	},

	/**
	 * @function grantCb 赠送采贝(黎 09-09:赠送计入累积采贝)——cb_num 免费采贝余额 与 receive_cb_total 领取采贝总数 一起涨,
	 *   与 survey.submit 发奖同口径;刻意「读改写 + ||0」不用 inc(沉睡账号这两个字段可能为 null,$inc 会抛);
	 *   cb_num 取整向上(历史有 1.1 倍会员加成产生的小数,沿用旧后台 Math.ceil);每笔落 admin_cb_grants 留痕(发前发后)。
	 * @param {object} p { token, user_id, amount(1~10000 整数), note }
	 */
	async grantCb ({ user_id, amount, note } = {}) {
		try {
			const uid = str(user_id, 40).trim()
			const amt = Math.floor(num(amount))
			const n = trimNote(note)
			if (!uid) return { errMsg: '缺少用户 id' }
			if (!(amt >= 1 && amt <= GRANT_MAX)) return { errMsg: `赠送数量须为 1~${GRANT_MAX} 的整数` }
			const { data } = await db.collection(USERS).doc(uid).field({ nickname: true, cb_num: true, receive_cb_total: true }).get()
			const u = data && data[0]
			if (!u) return { errMsg: '用户不存在' }
			const before = { cb_num: num(u.cb_num), receive_cb_total: num(u.receive_cb_total) }
			const after = { cb_num: Math.ceil(before.cb_num + amt), receive_cb_total: before.receive_cb_total + amt }
			const { updated } = await db.collection(USERS).doc(uid).update({ cb_num: after.cb_num, receive_cb_total: after.receive_cb_total })
			if (updated !== 1) return { errMsg: '写入失败,请刷新后重试' }
			const now = Date.now()
			let logged = true
			try {
				await db.collection(GRANTS).add({ user_id: uid, amount: amt, note: n, operator: this.operator, before, after, create_time: now })
			} catch (le) { logged = false; console.log('[drama-admin] 赠送流水落库失败', uid, le && le.message) }
			console.log('[drama-admin] 赠送采贝', { uid, amount: amt, by: this.operator, before, after })
			const { data: fresh } = await db.collection(USERS).doc(uid).field(USER_DETAIL_FIELDS).get()
			return { errMsg: '', data: { user: shapeUser((fresh && fresh[0]) || { _id: uid, ...u, ...after }), grant: { amount: amt, note: n, operator: this.operator, before, after, create_time: now, logged }, grants: await fetchGrants(uid, 10) } }
		} catch (e) {
			return { errMsg: errText(e, 'grantCb') }
		}
	},

	/**
	 * @function surveyOverview 问卷各期概览(数据驱动:库里出现什么版本就列什么,自动兼容未来 v4 / v5)——
	 *   一条 aggregate 按 $version 分组(人数 / 最早最晚 _id / 平均时长),缺 version 的早期记录并入 v1(mergeSurveyGroups)。
	 *   各期标题 / 题目定义不在这里,后台从 survey.getArchive 取后按 version 对上。
	 * @param {object} p { token }
	 * @returns {{errMsg:string, data?:{build:string, versions:Array<{version:string, total:number, first_time:number, last_time:number, avg_duration:number}>}}}
	 */
	async surveyOverview () {
		try {
			const { data } = await db.collection(SURVEYS).aggregate()
				.group({ _id: '$version', total: $agg.sum(1), first_id: $agg.min('$_id'), last_id: $agg.max('$_id'), avg_duration: $agg.avg('$duration') })
				.limit(SURVEY_GROUPS_MAX).end()
			const versions = mergeSurveyGroups(data || [])
			/* 兜底:聚合里 _id 的返回形态没在真库核实过,万一拿不到合法 hex,就按 _id 单查该期首末各一条(每期 2 次 limit 1,版本数个位数) */
			await Promise.all(versions.filter((r) => r.total > 0 && (!r.first_time || !r.last_time)).map(async (r) => {
				const w = surveyVersionWhere(r.version)
				if (!w) return
				const edge = (dir) => db.collection(SURVEYS).where(w).field({ created_time: true }).orderBy('_id', dir).limit(1).get()
					.then((x) => (x && x.data && x.data[0] ? surveyTimeOf(x.data[0]) : 0)).catch(() => 0)
				const [f, l] = await Promise.all([edge('asc'), edge('desc')])
				if (!r.first_time) r.first_time = f
				if (!r.last_time) r.last_time = l
			}))
			return { errMsg: '', data: { build: BUILD, versions } }
		} catch (e) {
			return { errMsg: errText(e, 'surveyOverview') }
		}
	},

	/**
	 * @function surveySummary 一期问卷的统计总结:分页扫该期全部答卷(_id 升序,每页 1000,护栏 2 万条,超了 truncated:true),
	 *   在内存里用纯函数 tallySurvey 汇总——时长分布 / 北京日分布 / 来源 / 每题选项计数 + 「其他」补充文字 + 自由文本最近样例。
	 * @param {object} p { token, version:'v1'|'v2'|…, textQids?:string[] 题目定义里的问答题题号(这些题不做选项形态判定) }
	 * @returns {{errMsg:string, data?:{version:string, total:number, truncated:boolean, first_time:number, last_time:number,
	 *   duration:object, daily:object[], sources:object[], questions:object[]}}}
	 */
	async surveySummary ({ version, textQids } = {}) {
		try {
			const v = str(version).trim()
			const where = surveyVersionWhere(v)
			if (!where) return { errMsg: '问卷版本无效' }
			const tq = (Array.isArray(textQids) ? textQids : []).slice(0, SURVEY_TEXT_QIDS_MAX).map((x) => str(x).trim()).filter((x) => SURVEY_QID_RE.test(x))
			const { rows, truncated } = await scanSurveys(where)
			return { errMsg: '', data: { version: v, truncated, ...tallySurvey(rows, tq) } }
		} catch (e) {
			return { errMsg: errText(e, 'surveySummary') }
		}
	},

	/**
	 * @function surveyTexts 某题的文字答案分页(_id 倒序):
	 *   不传 opt → 问答题自由文本全文(非空且非选项形态;asText=true 表示题目定义就是问答题,非空即算);
	 *   传 opt → 该「其他」选项的补充文字(去掉 'X_' 前缀,单选字符串与多选数组元素都命中)。
	 *   kw 模糊匹配文字内容(不区分大小写,元字符已转义)。
	 * @param {object} p { token, version, qid, opt?:'A'…'Z', asText?:boolean, kw?, page, size }
	 * @returns {{errMsg:string, data?:{list:Array<{_id:string, user_id:string, user:object, text:string, time:number}>, total:number, page:number, size:number}}}
	 */
	async surveyTexts ({ version, qid, opt, asText, kw, page = 1, size = 20 } = {}) {
		try {
			const vw = surveyVersionWhere(version)
			if (!vw) return { errMsg: '问卷版本无效' }
			const q = str(qid).trim()
			if (!SURVEY_QID_RE.test(q)) return { errMsg: '题号无效' }
			const o = str(opt).trim()
			if (o && !SURVEY_OPT_RE.test(o)) return { errMsg: '选项无效' }
			const kre = keywordRe(kw)
			const f = 'answers.' + q
			const conds = [vw]
			if (o) conds.push({ [f]: new RegExp('^' + o + '_' + (kre ? '[\\s\\S]*' + kre.source : ''), kre ? 'i' : '') })
			else {
				conds.push({ [f]: asText ? SURVEY_ANY_TEXT_RE : SURVEY_TEXT_RE })
				if (kre) conds.push({ [f]: kre })
			}
			const where = dbCmd.and(conds)
			const pg = pageOf(page, size)
			const col = db.collection(SURVEYS)
			const [{ total }, { data }] = await Promise.all([
				col.where(where).count(),
				col.where(where).field({ user_id: true, answers: true, created_time: true }).orderBy('_id', 'desc').skip(pg.skip).limit(pg.size).get(),
			])
			const rows = data || []
			const users = await fetchUsers(rows.map((d) => d.user_id))
			return {
				errMsg: '',
				data: {
					list: rows.map((d) => ({
						_id: d._id, user_id: d.user_id || '', user: userOf(users, d.user_id),
						text: surveyPickText((d.answers || {})[q], o, kre, !!asText), time: surveyTimeOf(d),
					})),
					total: num(total), page: pg.page, size: pg.size,
				},
			}
		} catch (e) {
			return { errMsg: errText(e, 'surveyTexts') }
		}
	},

	/**
	 * @function surveyAnswers 一期问卷的答卷明细分页(10-05 黎令扩成多角度筛选 + 排序):answers 原样下发(解码在前端做,题目定义由前端从 survey.getArchive 拿)。
	 *   库内条件:version / kw(24 位 hex = user_id 精确,否则昵称模糊找 ≤200 人再 user_id in,找不到直接空列表)/ qid + opt(选了该选项的人,含带补充的)
	 *     / source 等值 / timeFrom~timeTo 提交时间(按 _id 字符串范围,见 surveyIdRange)。
	 *   两条路径(surveyAnswerOpts 判定,mode 回显):
	 *     db   = sort 是 time / duration 且无用户维度筛选 → 库内 count + 分页(duration 同值按 _id 倒序);
	 *     user = sort 是用户字段或带了 pay / payMin / contact / gender / regFrom / regTo → 按库内条件扫候选(不带 answers,护栏 2 万超了 truncated)
	 *            → 分块取用户 → 纯函数 pageSurveyRows 筛 + 排 + 切页 → 只对本页 _id 回查 answers。
	 *   page === 1 时附该期来源分布 sources(只按版本,给筛选下拉用;失败降级 [])。
	 * @param {object} p { token, version, page, size, kw?, qid?, opt?,
	 *   sort?:'time'|'duration'|'pay_total'|'pay_count'|'register_date'|'last_login_date'|'chat_total'|'login_count'(兼容旧 time_desc / time_asc / duration_desc / duration_asc),
	 *   dir?:'desc'|'asc', pay?:''|'paid'|'unpaid', payMin?:number(元), contact?:''|'yes'|'no', gender?:''|0|1|2, source?:string,
	 *   timeFrom?, timeTo?, regFrom?, regTo?(ms,含端点) }
	 * @returns {{errMsg:string, data?:{list:Array<{_id:string, user_id:string, user:object, answers:object, duration:number, source:string, time:number}>,
	 *   total:number, page:number, size:number, sort:string, dir:string, mode:'db'|'user', truncated:boolean, sources?:Array<{source:string, n:number}>}}}
	 */
	async surveyAnswers ({ version, page = 1, size = 20, kw, qid, opt, sort, dir, pay, payMin, contact, gender, source, timeFrom, timeTo, regFrom, regTo } = {}) {
		try {
			const vw = surveyVersionWhere(version)
			if (!vw) return { errMsg: '问卷版本无效' }
			const q = str(qid).trim()
			const o = str(opt).trim()
			if (q && !SURVEY_QID_RE.test(q)) return { errMsg: '题号无效' }
			if (o && !SURVEY_OPT_RE.test(o)) return { errMsg: '选项无效' }
			const f = surveyAnswerOpts({ sort, dir, pay, payMin, contact, gender, source, timeFrom, timeTo, regFrom, regTo })
			const pg = pageOf(page, size)
			const srcTask = pg.page === 1 ? surveySourceDist(vw) : null // 内部已兜错,不会 reject
			const finish = async (list, total, truncated) => ({
				errMsg: '',
				data: {
					list, total, page: pg.page, size: pg.size, sort: f.sort, dir: f.dir, mode: f.mode, truncated,
					...(srcTask ? { sources: await srcTask } : {}),
				},
			})

			const conds = [vw]
			if (f.source) conds.push({ source: f.source })
			const idRange = surveyIdRange(f.timeFrom, f.timeTo)
			if (idRange) conds.push({ _id: idRange })
			const k = str(kw, 60).trim()
			if (k) {
				if (HEX24.test(k)) conds.push({ user_id: k.toLowerCase() })
				else {
					const { data: us } = await db.collection(USERS).where({ nickname: keywordRe(k) }).field({ _id: true }).limit(200).get()
					const ids = (us || []).map((u) => u._id).filter(Boolean)
					if (!ids.length) return finish([], 0, false)
					conds.push({ user_id: dbCmd.in(ids) })
				}
			}
			if (q && o) conds.push({ ['answers.' + q]: new RegExp('^' + o + '(_|$)') })
			const where = conds.length === 1 ? vw : dbCmd.and(conds)
			const col = db.collection(SURVEYS)

			if (f.mode === 'db') {
				let query = col.where(where).field(SURVEY_SCAN_FIELDS)
				query = f.sort === 'duration' ? query.orderBy('duration', f.dir).orderBy('_id', 'desc') : query.orderBy('_id', f.dir)
				const [{ total }, { data }] = await Promise.all([
					col.where(where).count(),
					query.skip(pg.skip).limit(pg.size).get(),
				])
				const rows = data || []
				const users = await fetchSurveyUsers(rows.map((d) => d.user_id))
				return finish(rows.map((d) => shapeSurveyAnswer(d, users)), num(total), false)
			}

			/* user 路径:扫候选(不带 answers)→ 取用户 → 内存筛排切页 → 本页回查 answers */
			const { rows, truncated } = await scanSurveys(where, SURVEY_CAND_FIELDS)
			const users = await fetchSurveyUsers(rows.map((d) => d.user_id))
			const { total, list } = pageSurveyRows(rows, users, f, pg)
			const answers = Object.create(null)
			if (list.length) {
				const { data } = await col.where({ _id: dbCmd.in(list.map((d) => d._id)) }).field({ answers: true }).limit(list.length).get()
				for (const d of data || []) answers[d._id] = d.answers
			}
			return finish(list.map((d) => shapeSurveyAnswer({ ...d, answers: answers[d._id] }, users)), total, truncated)
		} catch (e) {
			return { errMsg: errText(e, 'surveyAnswers') }
		}
	},
}
