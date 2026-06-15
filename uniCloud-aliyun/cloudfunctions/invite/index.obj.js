/**
 * @module invite 邀新有礼云对象（有门槛 + 进度制邀请）
 *
 * 业务规则（详见 md/邀请页.md）：
 *   1. 邀请成功 = 被邀请人「完善资料(gender!=0)」且「与采崽聊天满 needChatCount 次」。
 *   2. 每位成功邀请 +inviteSuccessCb 采贝（逐条手动领，仅「本周邀请」可领，更早过期）。
 *   3. 累计成功达档发里程碑奖励（采贝/会员/畅聊卡，自助领，不限本周）。
 *   4. 周维度：本周邀请榜 Top3 + 我的本周战绩（按 ISO 周）。
 *
 * ⭐ 成本安全（发奖零漏洞）核心原则：
 *   - 所有「释放奖励」的状态变更都用**原子条件更新**实现，并以 `updated === 1` 作为
 *     “恰好一次”的唯一凭证；只有原子翻转成功后才真正发钱。
 *   - 领奖资格一律**服务端查库校验**，绝不信客户端入参（tier/inviteId 只作定位，资格由 DB 条件保证）。
 *   - 发钱失败处理偏向「绝不重复发放」：单条领取失败回滚状态（用受支持的字段更新）允许重试；
 *     里程碑失败**不回滚**占位（避免依赖未文档化的 pull、且杜绝重复发放），仅记日志人工对账。
 *   - 达标计数（total_success/week_success）只在 success:false→true 的原子翻转那一次累加，杜绝并发重复计数。
 *
 * 可插拔：本云对象 + invites/invite_summary 两张表 + 邀新页自成一体；
 *   user 云对象仅通过 try-catch 包裹的 importObject 钩子调用本对象，删除本对象不影响 user 主流程。
 */

const crypto = require('crypto')
const dayjs = require('./utils/dayjs.js')
const { getWeekKey, getBeijingDayStart, getBeijingYearStart } = require('./period-key.js')
const { AppSecret, needChatCount, inviteSuccessCb, milestones, weeklyRankRewards, share } = require('./config.js')

const db = uniCloud.database()
const dbCmd = db.command
const invitesDb = db.collection('invites')
const summaryDb = db.collection('invite_summary')
const usersDb = db.collection('users')
const weekRankDb = db.collection('invite_week_rank')
const boardCacheDb = db.collection('invite_board_cache')

/* 历史邀请分页：每页条数（首屏随 getInviteData 下发，触底加载走 getInviteHistory） */
const HIST_PAGE_SIZE = 20

/* ---------------- 周榜结算：快照上一周 Top3 写入 invite_week_rank（由 _timing 定时触发） ----------------
 * 定时器配置为「每天 00:10（北京时间，UTC+8）跑一次」(见 package.json cloudfunction-config.triggers)，每次结算"上一周"：
 *   周一这次把刚结束的上周结算掉；周二~周日因「该周已结算」幂等跳过 → 整周只真正结算一次；周一若漏跑，次日自动补上(自愈)。
 *   用每日跑而非"每周一"cron，规避星期几字段易写错的坑(日/周冲突、Mon=1还是2)。
 * 取 7 天前所在周 = 上一周（任意一天跑都对，不会误结算进行中的当前周）。
 * 极小竞态（周一 0:00~0:10 间有人邀请→其汇总被滚动重置→被排除）可接受并记录；唯一索引 (week_key,uid) 兜底防重。 */
async function settleWeekRank (now) {
	const lastWeek = getWeekKey(now - 7 * 24 * 3600 * 1000)   // 7 天前所在周 = 上一周
	const exist = await weekRankDb.where({ week_key: lastWeek }).limit(1).get()
	if (exist.data && exist.data.length) return { week: lastWeek, settled: 0, skip: 'already-settled' }
	const { data: top } = await summaryDb.where({ week_key: lastWeek, week_success: dbCmd.gt(0) })
		.orderBy('week_success', 'desc').limit(weeklyRankRewards.length).get()
	if (!top || !top.length) return { week: lastWeek, settled: 0 }
	let n = 0
	for (let i = 0; i < top.length && i < weeklyRankRewards.length; i++) {
		const reward = weeklyRankRewards[i]
		const ok = await weekRankDb.add({
			week_key: lastWeek,
			uid: top[i]._id,
			rank: reward.rank,
			week_success: top[i].week_success || 0,
			reward_type: reward.type,
			reward_value: reward.value,
			reward_unit: reward.unit,
			reward_label: reward.label,
			reward_state: 'claim',
			reward_time: 0,
			create_time: now
		}).then(() => true).catch(() => false)   // 唯一索引兜底防重
		if (ok) n++
	}
	return { week: lastWeek, settled: n }
}

/* 周榜 + 实时播报为全站共享数据，缓存进 invite_board_cache 单文档（全实例共享一份，跨实例一致）。
 * 为何弃用实例级内存缓存：serverless 多实例各存各的——领取后带 fresh 只更新了"处理该次请求的那个实例"，
 * 用户第二次进来若被路由到别的实例，会读到那个实例「领取前」的旧缓存 → 表现为"刚领完是新的、再进又变旧"。
 * 改用 DB 单文档后：领取触发的 fresh 写 = 全局更新；满 TTL 无人领取也自然过期重算；任何实例读到的都是同一份。 */
const HERO_TTL = 10 * 60 * 1000   // 榜单/播报缓存 10 分钟（降库压）；领取采贝前端带 fresh 调用会即时写回该缓存，全实例可见
const BOARD_CACHE_ID = 'board'    // 共享缓存单文档固定 _id（invite_board_cache 表全站仅此一条）

const pad2 = n => String(n).padStart(2, '0')

/* ---------------- 鉴权：本地验 JWT(HS256) + 一次轻量查 _id ----------------
 * 不再跨对象调 user.getUserInfo（省一次云函数调用：按秒计费 + 跨函数开销）。
 * 仅用 Node 内置 crypto 做 HMAC-SHA256 验签，零额外依赖。 */
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
		if (payload.exp && Math.floor(dayjs().valueOf() / 1000) > payload.exp) return {} // 过期
		return payload
	} catch (e) {
		return {}
	}
}
/* 校验 token → 取邀请人 _id（只查 _id，最轻） */
async function resolveUser (token) {
	if (!token) return null
	try {
		const { openid } = verifyToken(token)
		if (!openid) return null
		const { data } = await usersDb.where({ openid }).field({ _id: true }).limit(1).get()
		return (data && data[0]) ? data[0] : null
	} catch (e) {
		console.error('[invite] resolveUser failed:', e && e.message)
		return null
	}
}

/* ---------------- 单位换算（里程碑时长） ---------------- */
function unitToMs (value, unit) {
	if (unit === 'day') return value * 24 * 3600 * 1000
	if (unit === 'hour') return value * 3600 * 1000
	if (unit === 'minute') return value * 60 * 1000
	return 0
}

/* ---------------- 汇总文档：确保存在（零值幂等创建） ---------------- */
async function ensureSummary (uid, now) {
	const { data } = await summaryDb.where({ _id: uid }).field({ _id: true }).limit(1).get()
	if (data && data.length) return
	try {
		await summaryDb.add({
			_id: uid,
			total_success: 0,
			total_beans: 0,
			claimed_milestones: [],
			week_key: '',
			week_success: 0,
			update_time: now
		})
	} catch (e) {
		/* 并发首建：唯一 _id 冲突说明别的请求已创建，忽略即可 */
		if (!/duplicate key|E11000|unique/i.test((e && e.message) || '')) throw e
	}
}

/* ---------------- 达标累加（仅由 success 原子翻转那一次调用） ----------------
 * total_success 全时段累加（驱动里程碑）；inWindow 时累加本周成功数（驱动周榜/战绩）。 */
async function bumpSummary (inviterUid, inWindow, nowWeek, now) {
	await ensureSummary(inviterUid, now)
	await summaryDb.doc(inviterUid).update({ total_success: dbCmd.inc(1), update_time: now })
	if (inWindow) {
		/* 当前周匹配 → 原子 +1；跨周 → 重置本周计数为 1，并清空已领里程碑（里程碑按周刷新）。
		 * 榜单/里程碑非强一致，跨周竞态可接受。 */
		const wr = await summaryDb.where({ _id: inviterUid, week_key: nowWeek }).update({ week_success: dbCmd.inc(1) })
		if (!wr || wr.updated === 0) {
			await summaryDb.doc(inviterUid).update({ week_key: nowWeek, week_success: 1, claimed_milestones: [], week_beans: 0 })
		}
	}
}

/* ---------------- 评估单条邀请：达标则原子翻转 success 并累加汇总 ----------------
 * 幂等：success 已为 true 直接返回；未达标只刷新快照不发奖；
 * 达标用 where({_id, success:false}).update(success:true) 原子翻转，
 * 仅 updated===1（真正翻转的那一次）才 bumpSummary，杜绝并发重复计数。 */
async function evaluateOne (invite) {
	if (!invite || invite.success) return

	const now = dayjs().valueOf()
	const nowWeek = getWeekKey()

	/* 读被邀请人资料：gender 判定完善、chat_total 判定聊天次数、昵称/头像补全快照。
	 * chat_total 由 talk.deductUserTalkCount 搭车自增，这里一次读取即可，零额外查询、零碰聊天热路径。 */
	const { data: us } = await usersDb.where({ _id: invite.invitee_uid })
		.field({ gender: true, nickname: true, avatar: true, chat_total: true }).limit(1).get()
	const u = us && us[0]
	const profileDone = !!(u && u.gender)               // gender != 0 视为完善资料
	const chatCount = (u && u.chat_total) || 0
	const chatSnap = Math.min(chatCount, needChatCount) // 展示快照封顶到阈值，避免「5/3」
	const success = profileDone && chatCount >= needChatCount

	const nickname = (u && u.nickname) || invite.invitee_nickname || ''
	const avatar = (u && u.avatar) || invite.invitee_avatar || ''

	if (!success) {
		/* 未达标：仅刷新展示快照，不计数、不发奖。
		 * 成本优化：快照无变化则跳过本次写库（避免邀请人每次打开页面对 N 条 pending 空写）。 */
		const changed = profileDone !== !!invite.profile_done
			|| chatSnap !== (invite.chat_count || 0)
			|| nickname !== (invite.invitee_nickname || '')
			|| avatar !== (invite.invitee_avatar || '')
		if (changed) {
			await invitesDb.where({ _id: invite._id, success: false }).update({
				profile_done: profileDone,
				chat_count: chatSnap,
				invitee_nickname: nickname,
				invitee_avatar: avatar,
				update_time: now
			})
		}
		return
	}

	/* 达标：原子翻转 + 据「邀请所在周是否为本周」决定单条领取窗口 */
	const inWindow = invite.week_key === nowWeek
	const rewardState = inWindow ? 'claim' : 'expired'

	const r = await invitesDb.where({ _id: invite._id, success: false }).update({
		success: true,
		success_time: now,
		profile_done: true,
		chat_count: needChatCount,
		reward_state: rewardState,
		invitee_nickname: nickname,
		invitee_avatar: avatar,
		update_time: now
	})

	/* 只有真正完成翻转（恰好一次）才累加汇总 —— 这是防并发重复计数的关键闸门 */
	if (r && r.updated === 1) {
		await bumpSummary(invite.inviter_uid, inWindow, nowWeek, now)
	}
}

/* ---------------- 里程碑发奖（仅由原子占位成功后调用，恰好一次）。返回更新后的用户文档供前端 commit ---------------- */
async function grantMilestone (uid, ms, now) {
	if (ms.type === 'cb') {
		const ret = await usersDb.doc(uid).updateAndReturn({
			cb_num: dbCmd.inc(ms.value),
			receive_cb_total: dbCmd.inc(ms.value)
		})
		/* 里程碑采贝也计入本周采贝（口径与邀请榜一致；可领必为本周） */
		await summaryDb.doc(uid).update({ total_beans: dbCmd.inc(ms.value), week_beans: dbCmd.inc(ms.value) }).catch(() => {})
		return ret && ret.doc
	}
	if (ms.type === 'vip') {
		const add = unitToMs(ms.value, ms.unit)
		const { data } = await usersDb.where({ _id: uid }).field({ vip_end_time: true }).limit(1).get()
		const base = Math.max(now, (data && data[0] && data[0].vip_end_time) || 0)
		const ret = await usersDb.doc(uid).updateAndReturn({ vip_end_time: base + add })
		return ret && ret.doc
	}
	if (ms.type === 'talkcard') {
		const add = unitToMs(ms.value, ms.unit)
		const { data } = await usersDb.where({ _id: uid }).field({ talk_card_end_time: true }).limit(1).get()
		const base = Math.max(now, (data && data[0] && data[0].talk_card_end_time) || 0)
		const ret = await usersDb.doc(uid).updateAndReturn({ talk_card_end_time: base + add })
		return ret && ret.doc
	}
}

/* 记录格式化：服务端只下发原始数据（时间戳 / 原始昵称 / 状态），时间与昵称的展示格式化全部交客户端，
 * 减少云函数执行时长（按秒计费）。游客兜底名、≤10字裁剪、时:分:秒/月-日 等都在前端做。 */
function fmtRecord (r) {
	return {
		id: r._id,
		nickname: r.invitee_nickname || '',
		avatar: r.invitee_avatar || '',
		time: r.invite_time,
		profileDone: !!r.profile_done,
		chatCount: r.chat_count || 0,
		success: !!r.success,
		rewardState: r.reward_state || 'pending'
	}
}

/* ---------------- 周榜 Top3 + 实时播报（全站共享，DB 单文档缓存 10 分钟，跨实例一致） ---------------- */
async function getHero (nowWeek, fresh) {
	const now = dayjs().valueOf()
	/* 非 fresh：先读全站共享缓存单文档（最廉价的 _id 点查）。同周且未过期 → 直接返回，所有实例命中同一份。
	 * fresh=true（领取采贝后前端带 fresh 调用）：跳过读、强制重算并写回缓存 → 这次领取对全实例即时可见。
	 * 缓存读失败静默退化为直读库（建表前/异常都不会阻断主流程，只是退化成每次重算）。 */
	if (!fresh) {
		try {
			const { data: c } = await boardCacheDb.doc(BOARD_CACHE_ID).get()
			const hit = c && c[0]
			if (hit && hit.week_key === nowWeek && now < hit.expire_at) return hit.data
		} catch (e) { /* 读缓存失败 → 落到下方重算 */ }
	}

	/* Top3：本周有成功邀请的人，按 week_success 倒序 */
	const { data: top } = await summaryDb.where({ week_key: nowWeek, week_success: dbCmd.gt(0) })
		.orderBy('week_success', 'desc').limit(3).get()

	const ids = (top || []).map(t => t._id)
	const umap = {}
	if (ids.length) {
		const { data: us } = await usersDb.where({ _id: dbCmd.in(ids) }).field({ nickname: true, avatar: true }).get()
		;(us || []).forEach(x => { umap[x._id] = x })
	}
	const weeklyRank = (top || []).map(t => ({
		name: (umap[t._id] && umap[t._id].nickname) || '',   // 原始昵称，前端裁剪 ≤10 字
		avatar: (umap[t._id] && umap[t._id].avatar) || '',
		invites: t.week_success || 0,
		/* 采贝 = 本周"已领取"采贝（week_beans：领邀请 +10 / 领 cb 里程碑累加，跨周重置；vip/畅聊卡不计；口径与本周战绩一致） */
		beans: t.week_beans || 0
	}))

	/* 实时播报：取最近 20 条邀请，只下发原始数据（邀请人昵称快照 + 新用户昵称 + 时间戳）。
	 * 文案「{邀请人} {相对时间}前邀请了 {新用户}」由前端拼，相对时间前端算（永远新鲜，不受 10 分钟缓存影响）。
	 * inviter_nickname 为建立邀请关系时存的快照 → 免回查 users，省一次查询。 */
	const { data: recent } = await invitesDb.orderBy('invite_time', 'desc').limit(20)
		.field({ inviter_nickname: true, invitee_nickname: true, invite_time: true }).get()
	const broadcast = (recent || []).map(r => ({
		inviter: r.inviter_nickname || '',
		invitee: r.invitee_nickname || '',
		time: r.invite_time
	}))

	const data = { weeklyRank, broadcast }

	/* 写回全站共享缓存（固定 _id upsert）。先 update：命中(updated>0)即更新；未命中(updated:0)
	 * 或文档/表不存在(update 抛错) → 落到 add。写失败一律静默：建表前/异常只退化为"不缓存"，绝不阻断本次返回。
	 * 并发双写竞态：两实例同时落到 add，后者撞 _id 唯一冲突被 .catch 吞掉，无副作用。 */
	const payload = { week_key: nowWeek, data, expire_at: now + HERO_TTL, update_time: now }
	let cached = false
	try {
		const r = await boardCacheDb.doc(BOARD_CACHE_ID).update(payload)
		cached = !!(r && r.updated > 0)
	} catch (e) { /* 文档不存在 / 表未建 → 落到下方 add */ }
	if (!cached) await boardCacheDb.add({ _id: BOARD_CACHE_ID, ...payload }).catch(() => {})
	return data
}

/* ---------------- 批量兜底复核（性能：1 次批量读 + 并行写，替代逐条串行 evaluateOne） ----------------
 * 本邀请人仍 pending 的被邀请人一次性批量评估：批读 invitee 资料 → 内存判定 →
 * 仅对「达标翻转 / 快照变化」的记录并行写库；多数 pending 无变化 → 零写，极快。 */
async function recheckPending (uid) {
	const { data: pendings } = await invitesDb.where({ inviter_uid: uid, success: false })
		.orderBy('invite_time', 'desc').limit(30).get()
	if (!pendings || !pendings.length) return

	const ids = pendings.map(p => p.invitee_uid)
	const { data: us } = await usersDb.where({ _id: dbCmd.in(ids) })
		.field({ gender: true, nickname: true, avatar: true, chat_total: true }).get()
	const umap = {}
	;(us || []).forEach(u => { umap[u._id] = u })

	const now = dayjs().valueOf()
	const nowWeek = getWeekKey()
	const writes = []
	for (const inv of pendings) {
		const u = umap[inv.invitee_uid]
		const profileDone = !!(u && u.gender)
		const chatCount = (u && u.chat_total) || 0
		const chatSnap = Math.min(chatCount, needChatCount)
		const nickname = (u && u.nickname) || inv.invitee_nickname || ''
		const avatar = (u && u.avatar) || inv.invitee_avatar || ''
		const success = profileDone && chatCount >= needChatCount

		if (success) {
			const inWindow = inv.week_key === nowWeek
			writes.push(
				invitesDb.where({ _id: inv._id, success: false }).update({
					success: true, success_time: now, profile_done: true, chat_count: needChatCount,
					reward_state: inWindow ? 'claim' : 'expired',
					invitee_nickname: nickname, invitee_avatar: avatar, update_time: now
				}).then(r => (r && r.updated === 1) ? { inWindow } : null)
			)
		} else {
			const changed = profileDone !== !!inv.profile_done
				|| chatSnap !== (inv.chat_count || 0)
				|| nickname !== (inv.invitee_nickname || '')
				|| avatar !== (inv.invitee_avatar || '')
			if (changed) {
				writes.push(invitesDb.where({ _id: inv._id, success: false }).update({
					profile_done: profileDone, chat_count: chatSnap,
					invitee_nickname: nickname, invitee_avatar: avatar, update_time: now
				}).then(() => null))
			}
		}
	}
	if (!writes.length) return

	const flips = (await Promise.all(writes)).filter(Boolean)
	if (!flips.length) return

	/* 真正翻转成功的累加汇总（与 bumpSummary 同口径：total 全时段、week 本周且跨周重置） */
	const inWindowCount = flips.filter(f => f.inWindow).length
	await ensureSummary(uid, now)
	await summaryDb.doc(uid).update({ total_success: dbCmd.inc(flips.length), update_time: now })
	if (inWindowCount > 0) {
		const wr = await summaryDb.where({ _id: uid, week_key: nowWeek }).update({ week_success: dbCmd.inc(inWindowCount) })
		if (!wr || wr.updated === 0) {
			await summaryDb.doc(uid).update({ week_key: nowWeek, week_success: inWindowCount, claimed_milestones: [], week_beans: 0 })
		}
	}
}

const main = {

	/**
	 * @function _timing 定时触发入口：每周结算上周邀请榜 Top3 → 写入 invite_week_rank（页面可领取）。
	 *   ⚠️ 需在 uniCloud 控制台 / HBuilderX 为本云对象配置「定时触发」，建议每周一 00:0X（北京时间）。
	 */
	_timing: async function () {
		const now = dayjs().valueOf()
		try {
			const r = await settleWeekRank(now)
			console.log('[invite][_timing] 周榜结算', JSON.stringify(r))
		} catch (e) {
			console.error('[invite][_timing] 周榜结算异常', e && e.message)
		}
	},

	/**
	 * @function getInviteData 拉取邀新页全部数据（周榜/战绩/进度/今日/历史/配置）
	 * @param { Object } params { token } 用户 token
	 *
	 * 进入时做一次「兜底复核」：把本邀请人仍 pending 的被邀请人重新评估（限 30 条，控成本），
	 * 让达标状态在打开页面时刷新到最新。
	 */
	async getInviteData ({ token } = {}) {
		try {
			const u = await resolveUser(token)
			if (!u) return { errMsg: '无效用户' }
			const uid = u._id
			const now = dayjs().valueOf()
			const nowWeek = getWeekKey()
			const todayStart = getBeijingDayStart()

			/* 1) 先「兜底复核」写库完成，再读汇总/今日/历史 —— 保证本次返回与库强一致（首次打开即最新）。
			 *    复核会重算 pending 并写回快照(chat_count/profile_done/success)+ 翻转累加汇总(week_success)；
			 *    若与读并发，读常抢在写前 → 返回旧快照、要再刷一次才一致(慢一刷)。故 await 复核写完再读：
			 *    today 列表 / 本周完成数 / 名次 / 里程碑进度都基于复核后最新值，一次性一致。
			 *    复核仅 30 条、随后三路读并发，邀新页非热路径，多一段串行往返开销可接受。 */
			await recheckPending(uid)
			const [sumRes, todayRes, wrRes] = await Promise.all([
				summaryDb.where({ _id: uid }).limit(1).get(),
				invitesDb.where({ inviter_uid: uid, invite_time: dbCmd.gte(todayStart) })
					.orderBy('invite_time', 'desc').limit(100).get(),
				weekRankDb.where({ uid, reward_state: 'claim' }).orderBy('week_key', 'desc').limit(1).get().catch(() => ({ data: [] }))
			])
			const sum = (sumRes.data && sumRes.data[0]) || {}
			const weekMatches = sum.week_key === nowWeek
			const myWeekDone = weekMatches ? (sum.week_success || 0) : 0
			const weekBeans = weekMatches ? (sum.week_beans || 0) : 0   // 本周"已领取"采贝（week_beans，领取后累加；跨周重置）
			const claimed = weekMatches ? (sum.claimed_milestones || []) : []
			const todayList = todayRes.data || []
			/* 上周邀请榜前三的可领奖励（页面榜单下方领奖条用；无则 null） */
			const wr = wrRes.data && wrRes.data[0]
			const weekRankReward = wr ? { weekKey: wr.week_key, rank: wr.rank, reward: wr.reward_label } : null

			/* 3) 我的名次（仅本周有成绩才查，避免无谓 count） */
			const rank = myWeekDone > 0
				? (((await summaryDb.where({ week_key: nowWeek, week_success: dbCmd.gt(myWeekDone) }).count()).total || 0) + 1)
				: 0

			/* 4) 里程碑进度条状态（按本周成功数，梯度领取）：done(已领) / claim(可领) / now(当前目标) / locked(未解锁)。
			 *    梯度规则：只有「最低的未领档」可操作——已达成→claim、未达成→now；更高档即便已达成也先 locked，
			 *    领完低档才解锁下一档（即 5→10→20… 顺序逐档领，避免一次冒出多个领取入口）。 */
			/* 达成的档(week_success>=tier)菱形/进度都显示「达成」(reached)；领取气泡只给「最低未领档」(claim)，
			 * 领完才轮到下一档；未达成的最低档=当前目标(now)，更高未达成档=locked。 */
			const firstUnclaimed = milestones.find(m => !claimed.includes(m.tier))
			const firstUnreached = milestones.find(m => myWeekDone < m.tier)
			const tiers = milestones.map(m => {
				let state
				if (claimed.includes(m.tier)) state = 'done'
				else if (myWeekDone >= m.tier) state = (firstUnclaimed && m.tier === firstUnclaimed.tier) ? 'claim' : 'reached'
				else state = (firstUnreached && m.tier === firstUnreached.tier) ? 'now' : 'locked'
				return { n: m.tier, reward: m.label, type: m.type, state }
			})

			const today = {
				done: todayList.filter(r => r.success).length,
				total: todayList.length,
				list: todayList.map(fmtRecord)
			}

			/* 历史不在初始化拉取（默认选中今日）：前端切到「历史」时再调 getInviteHistory，每次切换都拿最新 */
			return {
				data: {
					/* 本周采贝 = 本周实际领取的采贝（与邀请榜口径一致），不再用「成功数×单价」估算 */
					myStats: { weekDone: myWeekDone, weekBeans, rank },
					/* 里程碑按周：totalDone 下发「本周成功数」，前端进度条与档位据此渲染 */
					progress: { totalDone: myWeekDone, tiers },
					today,
					/* 上周邀请榜前三的可领奖励（无则 null，前端据此显示/隐藏领奖条） */
					weekRankReward,
					/* 配置随接口下发，前端按此渲染，不在前端硬编码奖励规则 */
					config: { inviteSuccessCb, needChatCount, milestones, weeklyRankRewards },
					share
				},
				errMsg: '获取成功'
			}
		} catch ({ message }) {
			console.error('[invite] getInviteData failed:', message)
			return { errMsg: message }
		}
	},

	/**
	 * @function getInviteBoard 本周邀请榜 Top3 + 实时播报（从 getInviteData 拆出，前端可并行请求加速首屏）
	 *   全局共享数据 + DB 单文档缓存 10 分钟（跨实例一致）；不依赖用户态，单独成接口。
	 *   fresh=true 跳过缓存直读库并写回缓存：领取采贝后前端带 fresh 调用，使"已领采贝"对全实例即时生效。
	 */
	async getInviteBoard ({ fresh } = {}) {
		try {
			const hero = await getHero(getWeekKey(), fresh)
			return { data: { weeklyRank: hero.weeklyRank, broadcast: hero.broadcast }, errMsg: '获取成功' }
		} catch ({ message }) {
			console.error('[invite] getInviteBoard failed:', message)
			return { errMsg: message }
		}
	},

	/**
	 * @function getInviteToday 今日邀请列表（切回「今日」tab 时重新拉取，拿最新）。
	 *   仅 resolveUser + 1 次今日查询；不重跑兜底复核（页面初始化已复核，切 tab 不额外耗时/计费）。
	 */
	async getInviteToday ({ token } = {}) {
		try {
			const u = await resolveUser(token)
			if (!u) return { errMsg: '无效用户' }
			const todayStart = getBeijingDayStart()
			const { data } = await invitesDb.where({ inviter_uid: u._id, invite_time: dbCmd.gte(todayStart) })
				.orderBy('invite_time', 'desc').limit(100).get()
			const list = data || []
			return { data: { done: list.filter(r => r.success).length, total: list.length, list: list.map(fmtRecord) }, errMsg: '获取成功' }
		} catch ({ message }) {
			console.error('[invite] getInviteToday failed:', message)
			return { errMsg: message }
		}
	},

	/**
	 * @function getInviteHistory 历史邀请分页（触底加载）
	 * @param { Object } params { token, skip } skip 已加载条数
	 * @returns {object} { data: { list, hasMore }, errMsg }
	 *   按 invite_time 倒序，每页 HIST_PAGE_SIZE 条；多查 1 条判定 hasMore。
	 *   命中 idx_inviter_list (inviter_uid + invite_time) 索引，skip 分页成本可控。
	 */
	async getInviteHistory ({ token, skip = 0 } = {}) {
		try {
			const u = await resolveUser(token)
			if (!u) return { errMsg: '无效用户' }

			/* 历史邀请 = 今年、且「今天以前」：今天的记录归「今日邀请」tab，两个 tab 不重叠（避免今天的同时出现在两边）。
			 * 日界用 getBeijingDayStart（时区无关，见 period-key.js），取北京今天 00:00。 */
			const yearStart = getBeijingYearStart()
			const todayStart = getBeijingDayStart()
			const offset = Math.max(0, Number(skip) || 0)
			const { data } = await invitesDb.where({ inviter_uid: u._id, invite_time: dbCmd.gte(yearStart).and(dbCmd.lt(todayStart)) })
				.orderBy('invite_time', 'desc').skip(offset).limit(HIST_PAGE_SIZE + 1).get()

			const hasMore = (data || []).length > HIST_PAGE_SIZE
			const list = (data || []).slice(0, HIST_PAGE_SIZE).map(fmtRecord)
			return { data: { list, hasMore }, errMsg: '获取成功' }
		} catch ({ message }) {
			console.error('[invite] getInviteHistory failed:', message)
			return { errMsg: message }
		}
	},

	/**
	 * @function claimInvite 领取单条邀请的 +inviteSuccessCb 采贝（成本敏感，零漏洞）
	 * @param { Object } params { token, inviteId }
	 *
	 * 安全要点：
	 *   - 原子条件更新 reward_state: 'claim' → 'got'，where 同时校验
	 *     归属(inviter_uid===调用者)、成功(success:true)、窗口(week_key===本周)。
	 *   - 仅 updated===1（恰好一次翻转）才发钱；并发双击中第二次 updated===0 直接拒绝。
	 *   - 发钱失败回滚状态，避免用户丢奖励且不产生重复发放。
	 */
	async claimInvite ({ token, inviteId } = {}) {
		try {
			const u = await resolveUser(token)
			if (!u) return { errMsg: '无效用户' }
			if (!inviteId) return { errMsg: '参数缺失' }

			const now = dayjs().valueOf()
			const nowWeek = getWeekKey()

			/* 原子状态机翻转：唯一“可领”闸门 */
			const r = await invitesDb.where({
				_id: inviteId,
				inviter_uid: u._id,        // 归属校验：不能领别人的
				success: true,             // 必须已成功
				reward_state: 'claim',     // 必须可领（防重复 / 防过期）
				week_key: nowWeek          // 必须本周邀请（补领窗口）
			}).update({ reward_state: 'got', reward_time: now, update_time: now })

			if (!r || r.updated !== 1) return { errMsg: '该奖励不可领取或已领取' }

			/* 翻转成功后才发钱，并用 updateAndReturn 拿最新用户数据回传（前端 commit SetUserInfo） */
			let userDoc
			try {
				const ret = await usersDb.doc(u._id).updateAndReturn({
					cb_num: dbCmd.inc(inviteSuccessCb),
					receive_cb_total: dbCmd.inc(inviteSuccessCb)
				})
				userDoc = ret && ret.doc
			} catch (e) {
				/* 发钱失败 → 回滚为可领，允许重试，绝不让用户丢奖励 */
				await invitesDb.doc(inviteId).update({ reward_state: 'claim', reward_time: 0 }).catch(() => {})
				console.error('[invite] claimInvite credit failed, rolled back:', e && e.message)
				return { errMsg: '领取失败，请重试' }
			}

			/* 汇总：累计采贝 + 本周采贝（week_beans 驱动邀请榜/本周战绩；可领必为本周，week_key 已由成功流程置为本周） */
			await summaryDb.doc(u._id).update({ total_beans: dbCmd.inc(inviteSuccessCb), week_beans: dbCmd.inc(inviteSuccessCb), update_time: now }).catch(() => {})

			return { data: { inviteId, cb: inviteSuccessCb, user: userDoc }, errMsg: '领取成功' }
		} catch ({ message }) {
			console.error('[invite] claimInvite failed:', message)
			return { errMsg: message }
		}
	},

	/**
	 * @function claimMilestone 领取里程碑奖励（成本敏感，零漏洞）
	 * @param { Object } params { token, tier } tier 仅作定位，资格由 DB 条件保证
	 *
	 * 安全要点：
	 *   - tier 合法性以服务端 config.milestones 为准（客户端传啥都校验）。
	 *   - 原子占位：where(total_success>=tier 且 claimed_milestones 不含 tier).push(tier)，
	 *     单文档更新由数据库串行化，并发同档只有一次 updated===1。
	 *   - 仅占位成功才发奖；发奖失败回滚占位（pull tier），允许重试。
	 */
	async claimMilestone ({ token, tier } = {}) {
		try {
			const u = await resolveUser(token)
			if (!u) return { errMsg: '无效用户' }

			tier = Number(tier)
			const ms = milestones.find(m => m.tier === tier)
			if (!ms) return { errMsg: '无效档位' }

			const now = dayjs().valueOf()
			const nowWeek = getWeekKey()
			await ensureSummary(u._id, now)

			/* 原子占位（里程碑按周刷新）：必须本周(week_key===nowWeek) 且 本周成功数达档(week_success>=tier)
			 * 且 本周未领(claimed_milestones nin tier) 才推入已领数组。单文档更新由 DB 串行化，并发同档仅一次 updated===1。
			 * 跨周时 week_key 不匹配 → 直接拒绝（本周成绩与已领均已随 bumpSummary 重置）。 */
			const r = await summaryDb.where({
				_id: u._id,
				week_key: nowWeek,
				week_success: dbCmd.gte(tier),
				claimed_milestones: dbCmd.nin([tier])
			}).update({ claimed_milestones: dbCmd.push([tier]), update_time: now })

			if (!r || r.updated !== 1) return { errMsg: '未达成或已领取' }

			/* 占位成功后才发奖。
			 * 成本安全：发奖失败**不回滚占位**——uniCloud-aliyun 未提供 pull 操作符，且回滚可能在
			 * “已提交但响应异常”时让同档被再次领取造成重复发放。宁可极小概率漏发由日志人工对账补发，
			 * 也绝不制造重复发放漏洞（tier 已记入 claimed_milestones，不会再次发放）。 */
			let userDoc
			try {
				userDoc = await grantMilestone(u._id, ms, now)
			} catch (e) {
				console.error('[invite][RECONCILE] claimMilestone 发奖失败，已保留占位防重复发放。uid=' + u._id + ' tier=' + tier, e && e.message)
				return { errMsg: '领取处理中，请稍后在账户查看' }
			}

			return { data: { tier, type: ms.type, reward: ms.label, user: userDoc }, errMsg: '领取成功' }
		} catch ({ message }) {
			console.error('[invite] claimMilestone failed:', message)
			return { errMsg: message }
		}
	},

	/**
	 * @function claimWeekRankReward 领取「上周邀请榜前三」奖励（成本敏感，原子领取）
	 * @param { Object } params { token }
	 *   取本人一条可领的周榜奖励 → 原子翻转 claim→got → 发放(复用 grantMilestone) → 回传最新用户。
	 *   发奖失败不回滚占位（同里程碑策略，杜绝重复发放），仅记日志人工对账。
	 */
	async claimWeekRankReward ({ token } = {}) {
		try {
			const u = await resolveUser(token)
			if (!u) return { errMsg: '无效用户' }
			const now = dayjs().valueOf()
			const { data } = await weekRankDb.where({ uid: u._id, reward_state: 'claim' })
				.orderBy('week_key', 'desc').limit(1).get()
			const rec = data && data[0]
			if (!rec) return { errMsg: '暂无可领奖励' }

			/* 原子翻转 claim→got，第二次 updated:0 防重复领取 */
			const r = await weekRankDb.where({ _id: rec._id, reward_state: 'claim' }).update({ reward_state: 'got', reward_time: now })
			if (!r || r.updated !== 1) return { errMsg: '该奖励不可领取或已领取' }

			let userDoc
			try {
				userDoc = await grantMilestone(u._id, { type: rec.reward_type, value: rec.reward_value, unit: rec.reward_unit }, now)
			} catch (e) {
				console.error('[invite][RECONCILE] claimWeekRankReward 发奖失败，已保留占位防重复。uid=' + u._id + ' week=' + rec.week_key, e && e.message)
				return { errMsg: '领取处理中，请稍后在账户查看' }
			}
			return { data: { rank: rec.rank, reward: rec.reward_label, user: userDoc }, errMsg: '领取成功' }
		} catch ({ message }) {
			console.error('[invite] claimWeekRankReward failed:', message)
			return { errMsg: message }
		}
	},

	/**
	 * @function onInviteeRegister 新用户注册且携带邀请码时建立邀请关系（由 user.login 钩子调用）
	 * @param { Object } params { inviterUid, inviteeUid, nickname, avatar }
	 *
	 * 仅建立 pending 关系、**不发任何奖励**（奖励延迟到达标后手动领取）。
	 * 防护：禁自邀、邀请人需存在、invitee_uid 唯一索引防重复建立。
	 */
	async onInviteeRegister ({ inviterUid, inviteeUid, nickname = '', avatar = '' } = {}) {
		try {
			if (!inviterUid || !inviteeUid) return { errMsg: '参数缺失' }
			if (inviterUid === inviteeUid) return { errMsg: '不能邀请自己' }

			/* 邀请人需真实存在，防伪造 inviteUid 刷脏记录；顺带取昵称快照（播报展示用，免后续回查 users） */
			const { data: iv } = await usersDb.where({ _id: inviterUid }).field({ _id: true, nickname: true }).limit(1).get()
			if (!iv || !iv.length) return { errMsg: '邀请人不存在' }

			const now = dayjs().valueOf()
			await invitesDb.add({
				inviter_uid: inviterUid,
				inviter_nickname: (iv[0] && iv[0].nickname) || '',
				invitee_uid: inviteeUid,
				invitee_nickname: nickname || '',
				invitee_avatar: avatar || '',
				invite_time: now,
				week_key: getWeekKey(),
				profile_done: false,
				chat_count: 0,
				success: false,
				success_time: 0,
				reward_state: 'pending',
				reward_time: 0,
				create_time: now,
				update_time: now
			})
			return { data: true, errMsg: '邀请关系已建立' }
		} catch (e) {
			const msg = (e && e.message) || ''
			/* invitee_uid 唯一索引冲突 = 重复回调，幂等忽略 */
			if (/duplicate key|E11000|unique/i.test(msg)) return { data: false, errMsg: '邀请关系已存在' }
			console.error('[invite] onInviteeRegister failed:', msg)
			return { errMsg: msg }
		}
	},

	/**
	 * @function evaluateInvitee 复核某被邀请人是否达标（由 user.updateUser 钩子调用，也可前端触发）
	 * @param { Object } params { uid } 被邀请人 uid
	 *
	 * 仅按真实 DB 数据诚实翻转状态，不向任何人“凭空”发钱（发钱只在 claimXxx），故公开暴露亦安全。
	 */
	async evaluateInvitee ({ uid } = {}) {
		try {
			if (!uid) return { errMsg: '参数缺失' }
			const { data } = await invitesDb.where({ invitee_uid: uid }).limit(1).get()
			const invite = data && data[0]
			if (!invite) return { data: false, errMsg: '无邀请关系' }
			if (invite.success) return { data: true, errMsg: '已成功' }
			await evaluateOne(invite)
			return { data: true, errMsg: '已复核' }
		} catch ({ message }) {
			console.error('[invite] evaluateInvitee failed:', message)
			return { errMsg: message }
		}
	},

}

module.exports = main
