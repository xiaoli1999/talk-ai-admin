/**
 * 问卷后台 · 公共工具(10-05)
 * 页面外壳 / 本期总结 / 填写明细三处共用:数据接口薄封装 + 题目定义合并 + 答案解码 + 格式化。
 * 设计要点:
 *   - 题目定义(survey.getArchive)与答卷数据(drama-admin.survey*)是两条独立链路,定义缺失时一切照常,只是题干退化为题号、选项退化为字母;
 *   - 版本列表取「定义 ∪ 数据」并集,未来上新 v4/v5 不用改后台代码;
 *   - 本文件全是纯函数(fetchArchive 除外),不碰 DOM,方便 node 单测。
 */
import { dayjs } from 'element-plus'
import { dramaApi } from '@/utils/drama'

/** 调 drama-admin 的问卷方法:surveyOverview / surveySummary / surveyTexts / surveyAnswers */
export const surveyApi = (method, params = {}) => dramaApi(method, params)

/**
 * 取各期题目定义;失败(未上线/网络)返回 null,不抛错
 * 惰性创建云对象:模块加载时不碰 uniCloud,接口未上线也不影响页面其余部分。
 * @returns {Promise<{current:string, versions:Array}|null>}
 */
export const fetchArchive = async () => {
    try {
        const survey = uniCloud.importObject('survey', { customUI: true })
        const res = await survey.getArchive()
        if (!res || res.errMsg || !res.data || !Array.isArray(res.data.versions)) return null
        return { current: res.data.current || '', versions: res.data.versions }
    } catch (e) {
        return null
    }
}

/** 版本号数值:'v10' → 10;不合法 → -1 */
export const versionNum = (v) => {
    const m = /^v(\d+)$/i.exec(String(v == null ? '' : v).trim())
    return m ? Number(m[1]) : -1
}

/* 自然序比较器:数字段按数值比(q2 < q10),浏览器与 node 都自带 Intl */
const NATURAL = new Intl.Collator('en', { numeric: true })

/** 题号自然序比较器:q2 < q10 */
export const qidCompare = (a, b) => NATURAL.compare(String(a == null ? '' : a), String(b == null ? '' : b))

/** 题干去掉前缀编号「1. 」「2、」(也兼容全角点、冒号、右括号与 Q 前缀) */
export const qText = (title) => String(title == null ? '' : title).replace(/^\s*[Qq]?\d+\s*(?:[.．](?!\d)|[、:：)）])\s*/, '').trim()

export const TYPE_LABEL = { radio: '单选', checkbox: '多选', text: '问答' }

/** 第 i 个选项的字母(0 → 'A') */
const letterOf = (i) => String.fromCharCode(65 + i)

/* 选项文本兼容字符串与对象两种形态(现网全是字符串;对象形态留给以后) */
const optText = (o) => (o != null && typeof o === 'object' ? String(o.label || o.text || o.value || '') : String(o == null ? '' : o))

/**
 * 题目定义的选项列表(字母序)。额外导出:总结面板列 0 票选项要用,和 decodeAnswer 共用同一份「字母 → 文本」口径。
 * @param {object} [q] 题目定义
 * @returns {Array<{key:string,label:string}>}
 */
export const optionList = (q) => (q && Array.isArray(q.options) ? q.options.map((o, i) => ({ key: letterOf(i), label: optText(o) || letterOf(i) })) : [])

/**
 * 选项字母 → 选项文本;没有定义或越界 → 字母原样。额外导出,理由同 optionList。
 * @param {object} [q] 题目定义
 * @param {string} key 选项字母
 */
export const optionLabel = (q, key) => {
    const i = String(key || '').charCodeAt(0) - 65
    const o = q && Array.isArray(q.options) && i >= 0 ? q.options[i] : undefined
    const t = o === undefined ? '' : optText(o)
    return t || String(key || '')
}

/* 北京日期 'YYYY-MM-DD':与本机时区无关(服务器/浏览器在哪个时区都对) */
const BJ_OFFSET = 8 * 3600 * 1000
const bjDay = (ms) => new Date(ms + BJ_OFFSET).toISOString().slice(0, 10)
/* 定义里的日期统一成 'YYYY-MM-DD';也兼容毫秒时间戳;其他 → '' */
const normDay = (v) => {
    if (typeof v === 'number' && v > 0) return bjDay(v)
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v == null ? '' : v).trim())
    return m ? m[1] : ''
}
/* 期状态:按北京「今天」与起止日比较(起止日都含当天);两头都没登记 → '' */
const statusOf = (startDate, endDate, today) => {
    if (!startDate && !endDate) return ''
    if (startDate && today < startDate) return '未开始'
    if (endDate && today > endDate) return '已结束'
    return '进行中'
}

/**
 * 合并「题目定义(archive,可为 null)」与「数据概览(overview.versions,可为空)」→ 版本列表,新→旧。
 * 并集:只有定义没数据(total=0)或只有数据没定义(hasDef=false)的版本都要出现 → 未来 v4/v5 自动兼容。
 * 每项:{ version, label:'第 3 期 · v3', title, startDate, endDate, reward, sections, questions, qmap:{q1:def},
 *         hasDef, isCurrent, status:'进行中'|'已结束'|'未开始'|'',   // 按北京日期与 startDate/endDate 比较;无日期为 ''
 *         total, first_time, last_time, avg_duration }
 * @param {{current:string, versions:Array}|null} archive
 * @param {Array} [overviewVersions]
 * @returns {Array<object>}
 */
export const mergeVersions = (archive, overviewVersions) => {
    const defs = archive && Array.isArray(archive.versions) ? archive.versions : []
    const current = (archive && archive.current) || ''
    const stats = Array.isArray(overviewVersions) ? overviewVersions : []
    const defMap = new Map()
    const statMap = new Map()
    for (const d of defs) if (d && d.version) defMap.set(String(d.version), d)
    /* 库里版本字段缺失的老数据(null/'')归到 '' 一组,照样出卡,不让数据凭空消失 */
    for (const s of stats) if (s) statMap.set(s.version == null ? '' : String(s.version), s)

    const keys = Array.from(new Set([...defMap.keys(), ...statMap.keys()]))
    const today = bjDay(Date.now())

    return keys
        .map((version) => {
            const d = defMap.get(version)
            const s = statMap.get(version) || {}
            const n = versionNum(version)
            const questions = d && Array.isArray(d.questions) ? d.questions.filter((q) => q && q.id) : []
            const qmap = {}
            for (const q of questions) qmap[q.id] = q
            const startDate = d ? normDay(d.startDate) : ''
            const endDate = d ? normDay(d.endDate) : ''
            const reward = d && Number(d.reward) > 0 ? Number(d.reward) : null
            return {
                version,
                label: n >= 0 ? `第 ${n} 期 · ${version}` : (version || '未标版本'),
                title: (d && d.title) || '',
                startDate,
                endDate,
                reward,
                sections: d && Array.isArray(d.sections) ? d.sections.filter((x) => x && Array.isArray(x.qids)) : [],
                questions,
                qmap,
                hasDef: !!d,
                isCurrent: !!current && version === current,
                status: statusOf(startDate, endDate, today),
                total: Number(s.total) || 0,
                first_time: Number(s.first_time) || 0,
                last_time: Number(s.last_time) || 0,
                avg_duration: Number(s.avg_duration) || 0,
            }
        })
        .sort((a, b) => (versionNum(b.version) - versionNum(a.version)) || qidCompare(b.version, a.version))
}

/* 选择题答案形态:'A' 或 'E_补充文字' */
const CHOICE_ONE = /^[A-Z]$/
const CHOICE_EXTRA = /^[A-Z]_/
const isChoiceStr = (s) => CHOICE_ONE.test(s) || CHOICE_EXTRA.test(s)
const choiceItem = (q, s) => ({ key: s[0], label: optionLabel(q, s[0]), extra: s.length > 2 ? s.slice(2) : '' })
const EMPTY = () => ({ kind: 'empty', items: [], text: '' })

/**
 * 解一个原始答案值。q 为该题定义(可为 undefined → 字母原样当 label)。
 * 返回 { kind:'choice'|'text'|'empty', items:[ { key:'A', label:'选项文本', extra:'补充文字' } ], text:'' }
 * 规则:数组 → 逐元素;字符串匹配 /^[A-Z]$/ 或 /^[A-Z]_/ 且(无定义或定义不是 text 型)→ choice;定义是 text 型或不匹配 → text。
 * 数组里混进非字母元素(理论上不会)时按 { key:'', label:原文 } 保留,宁可难看也不丢数据。
 * @param {object} [q]
 * @param {*} raw
 */
export const decodeAnswer = (q, raw) => {
    if (raw == null) return EMPTY()
    const isTextDef = !!(q && q.type === 'text')

    if (Array.isArray(raw)) {
        const items = raw
            .filter((x) => x != null && String(x).trim() !== '')
            .map((x) => {
                const s = String(x)
                return isChoiceStr(s) ? choiceItem(q, s) : { key: '', label: s, extra: '' }
            })
        if (!items.length) return EMPTY()
        /* 问答题却存成了数组(脏数据):拼成文本展示 */
        if (isTextDef) return { kind: 'text', items: [], text: raw.map((x) => String(x == null ? '' : x)).join(' / ') }
        return { kind: 'choice', items, text: '' }
    }

    const s = typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
    if (!s.trim()) return EMPTY()
    if (!isTextDef && isChoiceStr(s)) return { kind: 'choice', items: [choiceItem(q, s)], text: '' }
    return { kind: 'text', items: [], text: s }
}

/* 'q3' → 'Q3';不是 q+数字 的 key 原样转大写 */
const qNo = (id) => {
    const m = /^q(\d+)$/i.exec(String(id || ''))
    return m ? `Q${m[1]}` : String(id || '').toUpperCase()
}

/**
 * 一份答卷 → 逐题视图数组:[{ id, no:'Q1', title, type, typeLabel, kind, items, text, isContact }]
 * 有定义按定义题序(未作答的题也列出,kind:'empty');定义之外的 key 按自然序追加在后;无定义则全部按 key 自然序。
 * isContact = 定义带 wechat 或 phone。
 * 无定义的题:title 为 ''(展示侧用 no 兜底),type 按答案形态推断(数组 → checkbox / 字母 → radio / 文本 → text / 空 → '')。
 * @param {object} [ver] mergeVersions 的一项
 * @param {object} [answers] 答卷 answers 对象
 */
export const buildSheet = (ver, answers) => {
    const defs = ver && Array.isArray(ver.questions) ? ver.questions.filter((q) => q && q.id) : []
    const ans = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {}
    const out = []
    const seen = new Set()

    const push = (id, q) => {
        const raw = ans[id]
        const dec = decodeAnswer(q, raw)
        let type = q ? (q.type || '') : ''
        if (!q) type = dec.kind === 'choice' ? (Array.isArray(raw) ? 'checkbox' : 'radio') : dec.kind === 'text' ? 'text' : ''
        out.push({
            id,
            no: qNo(id),
            title: q ? qText(q.title) : '',
            type,
            typeLabel: TYPE_LABEL[type] || '',
            kind: dec.kind,
            items: dec.items,
            text: dec.text,
            isContact: !!(q && (q.wechat || q.phone)),
        })
    }

    for (const q of defs) {
        if (seen.has(q.id)) continue
        seen.add(q.id)
        push(q.id, q)
    }
    Object.keys(ans).filter((k) => !seen.has(k)).sort(qidCompare).forEach((k) => push(k, undefined))
    return out
}

/** 秒 → 'X分Y秒'(不足 1 分只显示秒;0/空 → '—') */
export const fmtDuration = (sec) => {
    const n = Math.round(Number(sec))
    if (!(n > 0)) return '—'
    return n < 60 ? `${n}秒` : `${Math.floor(n / 60)}分${n % 60}秒`
}

/** 毫秒 → 'YYYY-MM-DD HH:mm'(0/空 → '—');用 element-plus 导出的 dayjs */
export const fmtTime = (ms) => {
    const n = Number(ms)
    return n > 0 ? dayjs(n).format('YYYY-MM-DD HH:mm') : '—'
}
