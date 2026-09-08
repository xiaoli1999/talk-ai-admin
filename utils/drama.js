/**
 * 小剧场监控 · 云对象 drama-admin 调用薄封装(09-08)
 * 统一注入后台登录 token(admin_session,pay-manual.login 签发)、统一错误形态 {errMsg, data}、登录失效跳登录页。
 * 页面里只写业务,不重复写鉴权与兜底。
 */
import { getSession, goLogin } from '@/utils/auth'

const DramaAdmin = uniCloud.importObject('drama-admin', { customUI: true })

/**
 * 调 drama-admin 方法(除 ping 外全部带 token)
 * @param {string} method 方法名
 * @param {object} [params]
 * @returns {Promise<{errMsg:string, data?:any}>}
 */
export const dramaApi = async (method, params = {}) => {
    const session = getSession()
    if (!session) { goLogin(); return { errMsg: '未登录' } }
    const res = await DramaAdmin[method]({ token: session.token, ...params })
        .catch((e) => ({ errMsg: (e && e.message) || `${method} 调用失败` }))
    if (res && /登录/.test(res.errMsg || '')) goLogin()
    return res || { errMsg: '无响应' }
}

/** 部署核戳:回 { build } 用于确认线上跑的是哪一版 */
export const dramaPing = () => DramaAdmin.ping().catch((e) => ({ errMsg: (e && e.message) || 'ping 失败' }))

/* ───── 展示枚举(与云对象/talk-drama 的字段语义对齐) ───── */
export const SCRIPT_STATUS = { 0: '执笔中', 1: '已交付', '-1': '判死', '-2': '已删' }
export const SCRIPT_STATUS_TAG = { 0: 'warning', 1: 'success', '-1': 'danger', '-2': 'info' }
/* 审核态 = AI 初审或人工转私的结论:pass 合规 / fail 不合规 / pending AI 审超时(私有) */
export const AUDIT_LABEL = { pending: 'AI 未判', pass: '合规', fail: '不合规' }
export const AUDIT_TAG = { pending: 'warning', pass: 'success', fail: 'danger' }
export const VIS_LABEL = { public: '公开', private: '私有' }
export const VIS_TAG = { public: 'success', private: 'info' }
export const WISH_TYPE_LABEL = { goal: '目标型', open: '开放型', vibe: '氛围型' }
export const REPORT_STATUS_LABEL = { pending: '待处理', handled: '已处理', dismissed: '已驳回' }
export const REPORT_STATUS_TAG = { pending: 'warning', handled: 'success', dismissed: 'info' }
export const EV_LABEL = { fe_error: '前端异常', gen_dead: '执笔判死', create_wait_fail: '创建等待失败', bgm_error: 'BGM 失败', admin_review: '人工处置' }
export const EV_TAG = { fe_error: 'danger', gen_dead: 'warning', create_wait_fail: 'warning', bgm_error: 'info' }
/* 处置动作(09-09 黎定:只剩 转私 + 撤销转私;pass/fail 是 09-08 旧留痕,只用于读历史) */
export const DECISION_LABEL = { private: '转私', restore: '撤销转私', takedown: '举报转私', dismiss: '举报驳回', pass: '通过(旧)', fail: '拒绝(旧)' }

export const SESSION_STATE_LABEL = { playing: '进行中', settled: '已落幕', settling: '结算中', abandoned: '已弃局' }
export const SESSION_STATE_TAG = { playing: 'success', settled: 'primary', settling: 'warning', abandoned: 'info' }
export const PAY_MODE_LABEL = { first_free: '首局免费', trial: '试玩', per_turn: '按轮', full: '买断', creator_free: '执笔免费' }
/** 自由本列表排序项(值 = 云对象白名单字段) */
export const SCRIPT_SORTS = [
    { key: 'create_time', label: '创建时间' }, { key: 'update_time', label: '最近更新' },
    { key: 'heat_score', label: '热度分（排序分）' }, { key: 'heat', label: '终身热度' },
    { key: 'play_count', label: '开局数' }, { key: 'stat_player_count', label: '玩家数' },
    { key: 'stat_settle_count', label: '完局数' }, { key: 'stat_full_count', label: '买断数' },
    { key: 'stat_ending_count', label: '结局解锁数' }, { key: 'stat_rerun_count', label: '复玩数' },
    { key: 'report_count', label: '举报数' }, { key: 'audit_time', label: '最近人工处置' },
]

/* 图表序列色(dataviz 参考调色板,固定槽位不轮换;09-09 用 validate_palette 校验过 light 模式全过) */
export const CHART_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
export const CHARGE_TYPE_LABEL = { turn_charge: '按轮聊天', narr_charge: '旁白', voice_charge: '语音', regen_charge: '重演一轮', opts_charge: '换一批', full_unlock: '整本买断', free_script_charge: '执笔单' }

export const shortId = (id) => (id ? String(id).slice(-6) : '—')
