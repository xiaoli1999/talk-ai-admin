/**
 * 优质老用户打分模型(09-13 黎令:把最优质的老用户筛出来,按顺序加进私域)
 * ─────────────────────────────────────────────────────────────────────
 * 纯函数、零依赖(不引 Vue / uni),后台页面与本地 node 校准脚本共用这一份。
 * 输入:drama-admin.listQualityUsers 返回的一行(f = 原始特征;另有 register_date / last_login_date / contact / survey)。
 * 输出:scoreRow() → { total 0-100, tier S/A/B/C, groups 六维 0-100, recency 近况系数, anomaly 异常原因[], reasons 推荐理由[] }
 *
 * 设计要点:
 *  1. 六个维度各自 0-100,再按权重加权;权重有预设(均衡/创作者优先/黏性优先/付费优先),后台可调。
 *  2. 创作力、影响力用「或叠加」(1 - Π(1 - 项)):任一项强就高,多项叠加更高——捏崽大神不写自由本也不吃亏。
 *     黏性、付费、反馈意愿用加权平均:这几项本来就相关,平均更稳。
 *  3. 曲线:数量类(捏崽数、充值额)用对数——第一个作品、第一笔钱最说明问题;
 *     量级类(登录、聊天、看广告、被聊次数)用平方根——头部要拉得开,才能排出先后。
 *  4. 封顶值(CAPS)取 2026-09-13 实测分布:近 30 天活跃老用户 1623 人的 p95~p99、UGC 创作者 1487 人的 p95;数据涨了再校准。
 *  5. 近况系数:最近登录越久远越打折(不在线的人加了也未必回);异常账号(领取次数远超注册天数等,疑似刷采贝)总分 ×0.3 并标红。
 */

const DAY = 86400000

/** 六个维度(顺序即展示顺序) */
export const QUALITY_GROUPS = [
    { key: 'creation', label: '创作力', short: '创作', color: '#eb6834', desc: '上线捏崽、优质角色、写自由本、捏崽提交、微调身份、AI 出图、问卷说会自己写本——任一项强就高,多项叠加更高' },
    { key: 'sticky', label: '黏性', short: '黏性', color: '#2a78d6', desc: '登录次数、聊天次数、累计获得采贝、领取采贝次数、看广告次数、喜欢过的角色、加到我的小程序' },
    { key: 'tenure', label: '资历', short: '资历', color: '#4a3aa7', desc: '注册天数(两年封顶)' },
    { key: 'pay', label: '付费', short: '付费', color: '#1baf7a', desc: '总充值、付费次数、会员中、近 30 天有充值' },
    { key: 'influence', label: '影响力', short: '影响', color: '#e87ba4', desc: '作品被喜欢、作品被聊、自由本被玩、邀请成功' },
    { key: 'intent', label: '反馈意愿', short: '意愿', color: '#eda100', desc: '填过几期问卷、联系方式是否齐全、三期问卷的定价态度 / 付费方式 / 想和谁重逢' },
]

/** 权重预设(和为 100) */
export const QUALITY_PRESETS = [
    { key: 'balanced', label: '均衡', weights: { creation: 30, sticky: 25, tenure: 10, pay: 15, influence: 10, intent: 10 } },
    { key: 'creator', label: '创作者优先', weights: { creation: 45, sticky: 15, tenure: 10, pay: 5, influence: 20, intent: 5 } },
    { key: 'sticky', label: '黏性优先', weights: { creation: 15, sticky: 40, tenure: 20, pay: 10, influence: 5, intent: 10 } },
    { key: 'pay', label: '付费优先', weights: { creation: 10, sticky: 20, tenure: 10, pay: 45, influence: 5, intent: 10 } },
]
export const DEFAULT_WEIGHTS = QUALITY_PRESETS[0].weights

/** 封顶值(到这个量视为满分;来源见文件头第 4 条) */
export const CAPS = {
    login: 1000, chat: 3000, cb_total: 12000, cb_count: 400, ad: 2000, likes_given: 80,
    tenure_days: 720,
    pay_yuan: 300, pay_n: 20,
    roles_pub: 5, roles_hq: 2, roles_my: 8, prompts: 300, ai_imgs: 20, scripts: 3,
    roles_likes: 150, roles_talks: 30000, script_players: 20, invites_ok: 5,
}

/** 分档线(总分):09-13 用线上两个池校准,S 约前 5%、A 约前 20% */
export const TIERS = [
    { key: 'S', min: 62, color: '#eb6834', label: 'S 顶级' },
    { key: 'A', min: 48, color: '#eda100', label: 'A 优质' },
    { key: 'B', min: 34, color: '#2a78d6', label: 'B 良好' },
    { key: 'C', min: 0, color: '#909399', label: 'C 一般' },
]

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0)
/** 对数曲线:第一个最值钱 */
const lg = (x, cap) => (x > 0 ? clamp01(Math.log1p(x) / Math.log1p(cap)) : 0)
/** 平方根曲线:头部拉得开 */
const sq = (x, cap) => (x > 0 ? clamp01(Math.sqrt(Math.min(x, cap) / cap)) : 0)
/** 或叠加:1 - Π(1 - 项) */
const orSum = (parts) => 1 - parts.reduce((p, v) => p * (1 - clamp01(v)), 1)

const BJ = 8 * 3600000
/** 北京时间自然日序号(「今天 / 1 天前」按日历算,不按 24 小时——昨晚 23 点登录不该显示成今天) */
const bjDay = (ms) => Math.floor((ms + BJ) / DAY)
export const tenureDaysOf = (row, nowMs) => (row.register_date ? Math.max(0, Math.floor((nowMs - row.register_date) / DAY)) : 0)
export const loginAgoDaysOf = (row, nowMs) => (row.last_login_date ? Math.max(0, bjDay(nowMs) - bjDay(row.last_login_date)) : 9999)

/** 近况系数:最近登录越久越打折 */
export function recencyFactor (agoDays) {
    if (agoDays <= 3) return 1
    if (agoDays <= 7) return 0.95
    if (agoDays <= 14) return 0.9
    if (agoDays <= 30) return 0.8
    if (agoDays <= 60) return 0.65
    if (agoDays <= 90) return 0.5
    return 0.35
}

/** 异常识别(疑似刷采贝):返回原因列表,空 = 正常 */
export function anomalyOf (row, nowMs) {
    const f = row.f || {}
    const days = tenureDaysOf(row, nowMs)
    const out = []
    if (f.cb_count > days * 3 + 30) out.push(`领取采贝 ${f.cb_count} 次,远超注册 ${days} 天`)
    if (f.cb_total > 100000) out.push(`累计获得采贝 ${f.cb_total}`)
    if (f.cb_num > 50000) out.push(`免费采贝余额 ${Math.round(f.cb_num)}`)
    return out
}

/* 问卷 v3 决策题的取值(和 drama-admin V3_OPTS 短标一致) */
const Q7 = { 很划算: 1, 可以接受: 0.7, 有点贵: 0.3, 太贵了: 0 }
const Q6 = { 一次付清: 1, 开会员享会员价: 0.9, 边玩边付: 0.6, 先免费再决定: 0.3 }
const Q2 = { 自己捏的崽: 1, 都想试试: 0.8, 别人写的故事: 0.6, 官方角色: 0.5 }

/**
 * 六维分(0-1)
 * @param {object} row listQualityUsers 的一行
 * @param {number} nowMs
 */
export function groupScores (row, nowMs) {
    const f = row.f || {}
    const s = row.survey || {}
    const q8 = s.q8 || ''
    const q8v = q8.startsWith('会写') ? 1 : (q8.startsWith('想试') ? 0.45 : 0)
    const payYuan = (f.pay_fen || 0) / 100
    const hasWx = !!(row.contact && row.contact.wechat_id)
    const hasPhone = !!(row.contact && row.contact.beta_phone)
    return {
        creation: orSum([
            0.90 * lg(f.roles_pub, CAPS.roles_pub),
            0.60 * lg(f.roles_hq, CAPS.roles_hq),
            0.85 * lg(f.scripts, CAPS.scripts),
            0.45 * lg(f.roles_my, CAPS.roles_my),
            0.40 * lg(f.prompts, CAPS.prompts),
            0.35 * lg(f.ai_imgs, CAPS.ai_imgs),
            0.35 * q8v,
        ]),
        sticky: 0.20 * sq(f.login, CAPS.login) + 0.25 * sq(f.chat, CAPS.chat) + 0.15 * sq(f.cb_total, CAPS.cb_total)
            + 0.15 * sq(f.cb_count, CAPS.cb_count) + 0.15 * sq(f.ad, CAPS.ad) + 0.05 * sq(f.likes_given, CAPS.likes_given) + 0.05 * (f.add_mp ? 1 : 0),
        tenure: sq(tenureDaysOf(row, nowMs), CAPS.tenure_days),
        pay: 0.55 * lg(payYuan, CAPS.pay_yuan) + 0.20 * lg(f.pay_n, CAPS.pay_n) + 0.10 * (f.vip ? 1 : 0) + 0.15 * (f.pay30_fen > 0 ? 1 : 0),
        influence: orSum([
            0.75 * sq(f.roles_likes, CAPS.roles_likes),
            0.60 * sq(f.roles_talks, CAPS.roles_talks),
            0.65 * lg(f.script_players, CAPS.script_players),
            0.70 * lg(f.invites_ok, CAPS.invites_ok),
        ]),
        intent: 0.45 * Math.min(f.surveys || 0, 3) / 3 + 0.20 * (hasWx && hasPhone ? 1 : (hasWx || hasPhone ? 0.6 : 0))
            + 0.15 * (Q7[s.q7] || 0) + 0.10 * (Q6[s.q6] || 0) + 0.10 * (Q2[s.q2] || 0),
    }
}

export const tierOf = (total) => TIERS.find((t) => total >= t.min) || TIERS[TIERS.length - 1]

/** 推荐理由:把最能说明「为什么排前面」的原始数据挑出来,按贡献排序 */
function reasonsOf (row, g, weights, nowMs) {
    const f = row.f || {}
    const s = row.survey || {}
    const w = (k) => (weights[k] || 0) / 100
    const out = []
    const add = (cond, text, group, strength) => { if (cond) out.push({ text, group, s: strength * (0.3 + w(group)) }) }
    const days = tenureDaysOf(row, nowMs)
    add(f.roles_pub > 0, `上线捏崽 ${f.roles_pub} 个${f.roles_hq ? ` · 优质 ${f.roles_hq}` : ''}`, 'creation', 0.9 + lg(f.roles_pub, CAPS.roles_pub))
    add(f.scripts > 0, `写自由本 ${f.scripts} 本${f.script_players ? ` · 被玩 ${f.script_players} 人` : ''}`, 'creation', 0.9 + lg(f.scripts, CAPS.scripts))
    add(f.roles_pub === 0 && f.roles_my >= 1, `提交捏崽 ${f.roles_my} 次`, 'creation', 0.5 + lg(f.roles_my, CAPS.roles_my) * 0.5)
    add(f.prompts >= 30, `微调身份 ${f.prompts} 次`, 'creation', 0.4 + lg(f.prompts, CAPS.prompts) * 0.5)
    add(f.ai_imgs >= 5, `AI 出图 ${f.ai_imgs} 张`, 'creation', 0.5)
    add((s.q8 || '').startsWith('会写'), '问卷:会自己写本', 'creation', 0.6)
    add(f.roles_likes >= 30, `作品被喜欢 ${f.roles_likes}`, 'influence', 0.4 + sq(f.roles_likes, CAPS.roles_likes) * 0.5)
    add(f.roles_talks >= 5000, `作品被聊 ${fmtWan(f.roles_talks)}`, 'influence', 0.4 + sq(f.roles_talks, CAPS.roles_talks) * 0.5)
    add(f.invites_ok > 0, `邀请成功 ${f.invites_ok} 人`, 'influence', 0.6)
    add(f.chat >= 1000, `聊天 ${fmtWan(f.chat)} 次`, 'sticky', 0.3 + sq(f.chat, CAPS.chat) * 0.5)
    add(f.login >= 300, `登录 ${fmtWan(f.login)} 次`, 'sticky', 0.3 + sq(f.login, CAPS.login) * 0.4)
    add(f.cb_total >= 5000, `累计获得采贝 ${fmtWan(f.cb_total)}`, 'sticky', 0.3 + sq(f.cb_total, CAPS.cb_total) * 0.4)
    add(f.cb_count >= 200, `领取采贝 ${f.cb_count} 次`, 'sticky', 0.3 + sq(f.cb_count, CAPS.cb_count) * 0.4)
    add(f.ad >= 300, `看广告 ${fmtWan(f.ad)} 次`, 'sticky', 0.3 + sq(f.ad, CAPS.ad) * 0.4)
    add(f.pay_fen >= 5000, `充值 ${Math.round(f.pay_fen / 100)} 元`, 'pay', 0.5 + lg(f.pay_fen / 100, CAPS.pay_yuan) * 0.5)
    add(f.pay_fen > 0 && f.pay_fen < 5000, `付费过 ${f.pay_n} 次`, 'pay', 0.4)
    add(f.pay30_fen > 0, '近 30 天有充值', 'pay', 0.5)
    add(f.vip === 1, '会员中', 'pay', 0.3)
    add(days >= 365, `老用户 ${days} 天`, 'tenure', 0.3 + g.tenure * 0.3)
    add((f.surveys || 0) >= 3, '三期问卷都填了', 'intent', 0.4)
    return out.sort((a, b) => b.s - a.s).map(({ text, group }) => ({ text, group }))
}
const fmtWan = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n))

/**
 * 给一行打分
 * @param {object} row listQualityUsers 的一行
 * @param {object} weights 六维权重(缺省 = 均衡)
 * @param {number} nowMs
 * @returns {{ total:number, tier:object, groups:object, recency:number, anomaly:string[], reasons:{text:string,group:string}[], tenureDays:number, loginAgoDays:number }}
 */
export function scoreRow (row, weights = DEFAULT_WEIGHTS, nowMs = Date.now()) {
    const g01 = groupScores(row, nowMs)
    const wSum = QUALITY_GROUPS.reduce((a, x) => a + (Number(weights[x.key]) || 0), 0) || 1
    const base = QUALITY_GROUPS.reduce((a, x) => a + (Number(weights[x.key]) || 0) * g01[x.key], 0) / wSum
    const loginAgoDays = loginAgoDaysOf(row, nowMs)
    const recency = recencyFactor(loginAgoDays)
    const anomaly = anomalyOf(row, nowMs)
    const total = Math.round(base * 100 * recency * (anomaly.length ? 0.3 : 1) * 10) / 10
    const groups = {}
    for (const x of QUALITY_GROUPS) groups[x.key] = Math.round(g01[x.key] * 100)
    return { total, tier: tierOf(total), groups, recency, anomaly, reasons: reasonsOf(row, g01, weights, nowMs), tenureDays: tenureDaysOf(row, nowMs), loginAgoDays }
}
