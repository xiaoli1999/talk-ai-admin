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
export const AUDIT_LABEL = { pending: '待审', pass: '已过', fail: '未过' }
export const AUDIT_TAG = { pending: 'warning', pass: 'success', fail: 'danger' }
export const VIS_LABEL = { public: '公开', private: '私有' }
export const VIS_TAG = { public: 'success', private: 'info' }
export const WISH_TYPE_LABEL = { goal: '目标型', open: '开放型', vibe: '氛围型' }
export const REPORT_STATUS_LABEL = { pending: '待处理', handled: '已处理', dismissed: '已驳回' }
export const REPORT_STATUS_TAG = { pending: 'warning', handled: 'success', dismissed: 'info' }
export const EV_LABEL = { fe_error: '前端异常', gen_dead: '执笔判死', create_wait_fail: '创建等待失败', bgm_error: 'BGM 失败', admin_review: '人工处置' }
export const EV_TAG = { fe_error: 'danger', gen_dead: 'warning', create_wait_fail: 'warning', bgm_error: 'info' }
export const DECISION_LABEL = { pass: '通过', fail: '拒绝', private: '转私有', takedown: '举报下架', dismiss: '举报驳回' }

export const shortId = (id) => (id ? String(id).slice(-6) : '—')
