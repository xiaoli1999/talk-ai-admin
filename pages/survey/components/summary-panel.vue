<template>
    <div v-loading="loading" class="sp">
        <template v-if="s && s.total">
            <el-alert v-if="s.truncated" class="tip" type="warning" show-icon :closable="false"
                title="答卷数超过云端单次统计上限,下面的统计只覆盖了部分答卷(数字偏小)" />

            <!-- 1. 概览 -->
            <div class="sec-tt">概览 <span class="sub">{{ ver.label }}{{ ver.title ? ' · ' + ver.title : '' }}</span></div>
            <div class="kpis">
                <div class="kpi">
                    <div class="kv">{{ fmtNum(s.total) }}<i> 份</i></div>
                    <div class="kl">填写人数</div>
                    <div class="ks">{{ days.length ? `共 ${days.length} 天 · 日均 ${dayAvg} 份` : '没有按日统计' }}</div>
                </div>
                <div class="kpi">
                    <div class="kv">{{ fmtDuration(dur.avg) }}</div>
                    <div class="kl">平均用时</div>
                    <div class="ks">中位数 {{ fmtDuration(dur.median) }} · 最快 {{ fmtDuration(dur.min) }} · 最慢 {{ fmtDuration(dur.max) }}</div>
                </div>
                <div class="kpi">
                    <div class="kv sm">{{ fmtTime(s.first_time) }}</div>
                    <div class="kv sm">~ {{ fmtTime(s.last_time) }}</div>
                    <div class="kl">首份 ~ 末份提交</div>
                </div>
                <div class="kpi">
                    <div class="kv">{{ ver.reward ? fmtNum(s.total * ver.reward) : '—' }}<i v-if="ver.reward"> 采贝</i></div>
                    <div class="kl">奖励发放合计</div>
                    <div class="ks">{{ ver.reward ? `${fmtNum(s.total)} 份 × ${ver.reward} 采贝(按份数估算)` : '这一期没有登记奖励' }}</div>
                </div>
                <div class="kpi">
                    <div class="kl kl-top">来源 Top 3<span v-if="sources.length" class="kl-sub">共 {{ sources.length }} 个来源</span></div>
                    <div v-for="(src, i) in sources.slice(0, 3)" :key="i" class="src">
                        <span class="src-n" :class="{ none: !src.source }" :title="src.source || '未标记'">{{ src.source || '未标记' }}</span>
                        <span class="src-t"><i :style="{ width: barW(src.n, s.total) + '%' }"></i></span>
                        <span class="src-v"><b>{{ fmtNum(src.n) }}</b> · {{ pctText(src.n / s.total) }}</span>
                    </div>
                    <div v-if="!sources.length" class="ks">没有来源记录</div>
                </div>
            </div>

            <!-- 2. 每日填写趋势(只有一天时退化成一句话) -->
            <div class="sec-tt">每日填写 <span class="sub">北京日期 · 悬停看具体值</span></div>
            <div v-if="days.length > 1" class="charts">
                <div class="card"><mini-chart title="每日填写" :subtitle="peakText" unit=" 份" :labels="dayLabels" :series="daySeries" /></div>
                <div class="card"><mini-chart title="累计填写" :subtitle="`至今 ${fmtNum(cumTotal)} 份`" unit=" 份" :labels="dayLabels" :series="cumSeries" /></div>
            </div>
            <div v-else class="card one-day">{{ days.length ? `全部 ${fmtNum(days[0].n)} 份都在 ${days[0].day} 当天提交` : '没有按日统计数据' }}</div>

            <!-- 3. 逐题统计(有 sections 按 PART 分组) -->
            <div class="sec-tt">逐题统计 <span class="sub">选项条点一下 → 到「填写明细」看选了它的答卷</span></div>
            <template v-for="g in groups" :key="g.key">
                <div v-if="g.eyebrow || g.title" class="part">
                    <div v-if="g.eyebrow" class="part-eb">{{ g.eyebrow }}</div>
                    <div v-if="g.title" class="part-tt">{{ g.title }}<span v-if="g.sub" class="part-sub">{{ g.sub }}</span></div>
                </div>
                <div class="qgrid">
                    <div v-for="q in g.items" :key="q.id" class="qc">
                        <div class="qc-hd">
                            <span class="qno">{{ q.no }}</span>
                            <el-tag v-if="q.typeLabel" size="small" :type="TYPE_TAG[q.type] || 'info'" effect="plain">{{ q.typeLabel }}</el-tag>
                            <el-tag v-if="q.isContact" size="small" type="danger" effect="plain">联系方式</el-tag>
                            <span class="qc-n"><b>{{ fmtNum(q.answered) }}</b>人作答</span>
                        </div>
                        <div v-if="q.title" class="qc-tt">{{ q.title }}</div>
                        <div v-if="q.multi && q.kind === 'choice'" class="qc-note">多选 · 占比按作答人数(各项相加会超过 100%)</div>

                        <!-- 联系方式题:不在总结里平铺,隐私数据只在明细里按人看 -->
                        <div v-if="q.isContact" class="lock">已有 <b>{{ fmtNum(q.answered) }}</b> 人留下 · 联系方式请到「填写明细」查看</div>

                        <!-- 选择题:每个选项一条横条,占比分母 = 作答人数 -->
                        <template v-else-if="q.kind === 'choice'">
                            <div class="opts">
                                <div
                                    v-for="o in q.options"
                                    :key="o.key"
                                    class="opt"
                                    :class="{ top: o.top, zero: !o.n, click: o.n > 0 }"
                                    :title="o.n ? '点击查看选了这一项的答卷' : ''"
                                    @click="drillTo(q, o)"
                                >
                                    <div class="opt-hd">
                                        <span class="opt-k">{{ o.key }}</span>
                                        <span class="opt-l">{{ o.label }}</span>
                                        <span class="opt-v"><b>{{ fmtNum(o.n) }}</b> 人 · {{ pctText(o.pct) }}</span>
                                        <span class="opt-go">看答卷 ›</span>
                                    </div>
                                    <div class="opt-track"><div class="opt-fill" :style="{ width: o.w + '%' }"></div></div>
                                </div>
                                <div v-if="!q.options.length" class="muted">没有选项数据</div>
                            </div>

                            <!-- 「其他」等带补充文字的选项:默认收起,前 10 条 + 查看全部 -->
                            <div v-for="ex in q.extras" :key="ex.key" class="ex">
                                <div class="ex-hd" @click="toggle(q.id, ex.key)">
                                    <el-icon class="ex-arr" :class="{ open: isOpen(q.id, ex.key) }"><ArrowRight /></el-icon>
                                    <span>「{{ ex.label }}」补充内容（{{ fmtNum(ex.n) }}）</span>
                                </div>
                                <div v-if="isOpen(q.id, ex.key)" class="ex-bd">
                                    <div v-for="(t, i) in ex.texts.slice(0, 10)" :key="i" class="ex-r">
                                        <span class="ex-t">{{ t.text }}</span>
                                        <span v-if="t.n > 1" class="ex-c">×{{ t.n }}</span>
                                    </div>
                                    <div v-if="!ex.texts.length" class="muted">没有补充文字</div>
                                    <el-button v-if="ex.more" link type="primary" size="small" @click="openTexts(q, ex)">查看全部 {{ fmtNum(ex.n) }} 条 ›</el-button>
                                </div>
                            </div>
                        </template>

                        <!-- 问答题:最近 5 条 + 查看全部(抽屉里可搜索) -->
                        <div v-else class="txt">
                            <div v-for="(sm, i) in q.samples" :key="i" class="smp">
                                <div class="smp-t">{{ sm.text }}</div>
                                <div class="smp-m"><span>{{ fmtTime(sm.time) }}</span><id-copy :id="sm.user_id || ''" label="uid" /></div>
                            </div>
                            <div v-if="!q.samples.length" class="muted">还没有回答</div>
                            <el-button v-if="q.text_n" link type="primary" size="small" class="more" @click="openTexts(q)">查看全部 {{ fmtNum(q.text_n) }} 条 · 可搜索 ›</el-button>
                        </div>
                    </div>
                </div>
            </template>
            <el-empty v-if="!groups.length" description="这一期没有逐题数据" :image-size="60" />
        </template>

        <el-empty v-else-if="!loading && err" :description="`本期总结加载失败:${err}`">
            <el-button type="primary" @click="load">重试</el-button>
        </el-empty>
        <el-empty v-else-if="!loading && s" description="这一期还没有人填写" />

        <!-- 文本抽屉:「其他」补充内容 / 问答题全部回答,共用一个,分页 + 关键字 -->
        <el-drawer v-model="dw.visible" :title="dw.title" size="560px" destroy-on-close>
            <div class="dw">
                <div v-if="dw.sub" class="dw-sub">{{ dw.sub }}</div>
                <div class="dw-bar">
                    <el-input v-model="dw.kw" placeholder="搜关键字" :prefix-icon="Search" clearable style="width: 240px;" @keyup.enter="loadTexts(1)" @clear="loadTexts(1)" />
                    <el-button type="primary" @click="loadTexts(1)">搜索</el-button>
                    <span class="dw-total">共 {{ fmtNum(dw.total) }} 条</span>
                </div>
                <div v-loading="dw.loading" class="dw-list">
                    <div v-for="row in dw.list" :key="row._id" class="dw-it">
                        <div class="dw-who">
                            <el-avatar :size="24" :src="(row.user && row.user.avatar) || undefined">{{ ((row.user && row.user.nickname) || '?').slice(0, 1) }}</el-avatar>
                            <span class="dw-n">{{ (row.user && row.user.nickname) || '(无昵称)' }}</span>
                            <id-copy :id="row.user_id || (row.user && row.user._id) || ''" label="uid" />
                            <span class="dw-time">{{ fmtTime(row.time) }}</span>
                        </div>
                        <div class="dw-txt"><template v-for="(seg, i) in segs(row.text)" :key="i"><mark v-if="seg.hit">{{ seg.t }}</mark><template v-else>{{ seg.t }}</template></template></div>
                    </div>
                    <el-empty v-if="!dw.loading && !dw.list.length" :description="dw.err || (dw.kwOn ? '没有匹配的内容' : '还没有内容')" :image-size="60" />
                </div>
                <div v-if="dw.total > dw.size" class="pagination">
                    <el-pagination v-model:currentPage="dw.page" :page-size="dw.size" :total="dw.total" layout="prev, pager, next" small @current-change="loadTexts()" />
                </div>
            </div>
        </el-drawer>
    </div>
</template>

<script setup>
/**
 * 问卷 · 本期总结(10-05):概览统计卡 → 每日趋势 → 逐题统计(选项横条可下钻到明细)→ 文本抽屉。
 * 数据经 drama-admin.surveySummary 一次拉齐;题干/选项文本来自 ver(mergeVersions 的一项),没有定义时退化为题号/字母。
 * 图表复用小剧场监控的零依赖 mini-chart;选项条用纯 div(SVG 里写 <text> 会被 uni-app 编译成 uni-text 不渲染)。
 */
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowRight, Search } from '@element-plus/icons-vue'
import { CHART_PALETTE } from '@/utils/drama'
import { surveyApi, qidCompare, qText, optionList, optionLabel, TYPE_LABEL, fmtDuration, fmtTime } from '@/utils/survey'
import MiniChart from '@/pages/drama/components/mini-chart.vue'
import IdCopy from '@/pages/drama/components/id-copy.vue'

const props = defineProps({
    ver: { type: Object, required: true },
})
const emit = defineEmits(['drill'])

const C = CHART_PALETTE
const TYPE_TAG = { radio: 'primary', checkbox: 'warning', text: 'success' }
const DAY = 86400000

const s = ref(null)
const err = ref('')
const loading = ref(false)
/* 防乱序:快速切期时只认最后一次请求的结果 */
let loadSeq = 0

const load = async () => {
    const v = props.ver
    if (!v) return
    const tk = ++loadSeq
    loading.value = true
    err.value = ''
    /* 有定义时把问答题题号带上:云端对这些题不做选项形态判定(否则只填一个大写字母、或「A_xxx」形态的微信号会被误计成选项) */
    const params = { version: v.version }
    const textQids = (v.hasDef && Array.isArray(v.questions) ? v.questions : []).filter((q) => q.type === 'text').map((q) => q.id)
    if (textQids.length) params.textQids = textQids
    const r = await surveyApi('surveySummary', params)
    if (tk !== loadSeq) return
    loading.value = false
    if (!r || r.errMsg || !r.data) {
        s.value = null
        err.value = (r && r.errMsg) || '无响应'
        return ElMessage.error(`本期总结加载失败:${err.value}`)
    }
    s.value = r.data
}
watch(() => props.ver && props.ver.version, load, { immediate: true })
defineExpose({ reload: load })

/* ───── 格式化 ───── */
const fmtNum = (x) => (Number(x) || 0).toLocaleString('en-US')
const pctText = (r) => `${Math.round((Number(r) || 0) * 1000) / 10}%`
/** 横条宽度百分比:按分母等比,有值时最少 1.5% 免得看不见 */
const barW = (n, den) => (n > 0 && den > 0 ? Math.min(100, Math.max(1.5, (n / den) * 100)) : 0)

/* ───── 概览 ───── */
const dur = computed(() => (s.value && s.value.duration) || {})
const sources = computed(() => ((s.value && s.value.sources) || []).filter((x) => x && Number(x.n) > 0))

/* ───── 每日趋势:北京日按天补零(没人填的日子也要占一格,折线才不说谎) ───── */
const days = computed(() => {
    const list = ((s.value && s.value.daily) || []).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.day))
    if (!list.length) return []
    const map = new Map()
    for (const d of list) map.set(d.day, (map.get(d.day) || 0) + (Number(d.n) || 0))
    const keys = Array.from(map.keys()).sort()
    const a = Date.parse(`${keys[0]}T00:00:00Z`)
    const b = Date.parse(`${keys[keys.length - 1]}T00:00:00Z`)
    /* 跨度异常(>400 天,多半是脏时间)就不补零,防止撑出上百个空点 */
    if ((b - a) / DAY > 400) return keys.map((day) => ({ day, n: map.get(day) }))
    const out = []
    for (let t = a; t <= b; t += DAY) {
        const day = new Date(t).toISOString().slice(0, 10)
        out.push({ day, n: map.get(day) || 0 })
    }
    return out
})
const dayLabels = computed(() => days.value.map((d) => d.day.slice(5)))
const daySeries = computed(() => [{ name: '填写', color: C[0], values: days.value.map((d) => d.n) }])
const cumSeries = computed(() => {
    let acc = 0
    return [{ name: '累计', color: C[2], values: days.value.map((d) => (acc += d.n)) }]
})
const cumTotal = computed(() => days.value.reduce((a, d) => a + d.n, 0))
const dayAvg = computed(() => (days.value.length ? Math.round((s.value.total / days.value.length) * 10) / 10 : 0))
const peakText = computed(() => {
    const p = days.value.reduce((m, d) => (d.n > m.n ? d : m), { day: '', n: -1 })
    return p.n > 0 ? `峰值 ${p.day.slice(5)} · ${p.n} 份` : ''
})

/* ───── 逐题统计 ───── */
const statMap = computed(() => {
    const m = {}
    for (const x of (s.value && s.value.questions) || []) if (x && x.id) m[x.id] = x
    return m
})

const qNo = (id) => {
    const mm = /^q(\d+)$/i.exec(String(id || ''))
    return mm ? `Q${mm[1]}` : String(id || '').toUpperCase()
}

/**
 * 一道题的展示模型:题目定义(可无)+ 统计 → 卡片要的全部字段。
 * 选项次数取 max(options[k], extras[k]):云端「options 是否已含带补充的 E_xxx」口径未定,
 * 而前端提交时「其他」的补充文字是必填,两种口径下 max 都等于真实人数。
 */
const viewOf = (id, def) => {
    const st = statMap.value[id] || {}
    const optN = {}
    const exN = {}
    for (const o of Array.isArray(st.options) ? st.options : []) if (o && o.key) optN[o.key] = Number(o.n) || 0
    const extrasRaw = (Array.isArray(st.extras) ? st.extras : []).filter((e) => e && e.key)
    for (const e of extrasRaw) exN[e.key] = Number(e.n) || 0

    /* 字母集合 = 定义里的选项(0 票也列)∪ 数据里出现的字母(定义外的也列) */
    const keys = optionList(def).map((o) => o.key)
    for (const k of Object.keys(optN).concat(Object.keys(exN)).sort()) if (!keys.includes(k)) keys.push(k)
    const counts = keys.map((k) => ({ key: k, label: optionLabel(def, k), n: Math.max(optN[k] || 0, exN[k] || 0) }))
    const optSum = counts.reduce((a, o) => a + o.n, 0)
    const textN = Number(st.text_n) || 0

    /* 题型:有定义听定义;没定义(或未知题型)时 text_n > 选项总次数 视为问答题 */
    let type = def && TYPE_LABEL[def.type] ? def.type : ''
    if (!type) type = textN > optSum ? 'text' : (st.multi ? 'checkbox' : 'radio')
    const kind = type === 'text' ? 'text' : 'choice'
    const multi = type === 'checkbox' || (kind === 'choice' && !!st.multi)
    const answered = Number(st.answered) || (kind === 'text' ? textN : (multi ? 0 : optSum))
    /* 占比分母 = 作答人数;缺 answered 时退回选项总次数,只防除零 */
    const den = answered || optSum
    const maxN = counts.reduce((m, o) => Math.max(m, o.n), 0)

    return {
        id,
        no: qNo(id),
        title: def ? qText(def.title) : '',
        type,
        typeLabel: TYPE_LABEL[type] || '',
        kind,
        multi,
        answered,
        isContact: !!(def && (def.wechat || def.phone)),
        /* 定义明确是问答题(区别于无定义时按形态推断):查全部回答时让云端「非空即文本」 */
        asText: !!(def && def.type === 'text'),
        options: counts.map((o) => ({ ...o, pct: den ? o.n / den : 0, w: barW(o.n, den), top: maxN > 0 && o.n === maxN })),
        extras: extrasRaw
            .map((e) => {
                const texts = (Array.isArray(e.texts) ? e.texts : []).filter((t) => t && t.text).map((t) => ({ text: String(t.text), n: Number(t.n) || 1 }))
                const n = Number(e.n) || 0
                const listed = texts.reduce((a, t) => a + t.n, 0)
                return { key: e.key, label: optionLabel(def, e.key), n, texts, more: texts.length > 10 || listed < n }
            })
            .filter((e) => e.n > 0 || e.texts.length),
        text_n: textN,
        samples: (Array.isArray(st.samples) ? st.samples : []).filter((x) => x && x.text).slice(0, 5),
    }
}

/**
 * 分组:有定义且有 sections → 按 PART;定义里不在任何 PART 的题收进「其他题目」;
 * 答卷里有、定义里没有的题另起一组;完全没有定义 → 按题号自然序平铺。
 */
const groups = computed(() => {
    if (!s.value) return []
    const v = props.ver
    const defs = v.hasDef && Array.isArray(v.questions) ? v.questions : []
    const qmap = v.qmap || {}
    if (!defs.length) {
        const items = Object.keys(statMap.value).sort(qidCompare).map((id) => viewOf(id, undefined))
        return items.length ? [{ key: 'all', eyebrow: '', title: '', sub: '', items }] : []
    }
    const out = []
    const used = new Set()
    ;(v.sections || []).forEach((sec, i) => {
        const items = []
        for (const id of sec.qids || []) {
            if (!qmap[id] || used.has(id)) continue
            used.add(id)
            items.push(viewOf(id, qmap[id]))
        }
        if (items.length) out.push({ key: `p${i}`, eyebrow: sec.eyebrow || '', title: sec.title || '', sub: sec.sub || '', items })
    })
    const rest = defs.filter((q) => !used.has(q.id))
    rest.forEach((q) => used.add(q.id))
    if (rest.length) out.push({ key: 'rest', eyebrow: '', title: out.length ? '其他题目' : '', sub: '', items: rest.map((q) => viewOf(q.id, q)) })
    const extra = Object.keys(statMap.value).filter((id) => !used.has(id)).sort(qidCompare)
    if (extra.length) out.push({ key: 'extra', eyebrow: '定义之外', title: '答卷里有、题目定义里没有的题', sub: '', items: extra.map((id) => viewOf(id, undefined)) })
    return out
})

/** 点选项条 → 交给外壳切到「填写明细」并按该选项筛;0 票的条不下钻 */
const drillTo = (q, o) => {
    if (!o.n) return
    emit('drill', { qid: q.id, opt: o.key, label: `${q.no} · ${o.label}` })
}

/* 补充内容折叠态 */
const opened = ref({})
const isOpen = (qid, key) => !!opened.value[`${qid}:${key}`]
const toggle = (qid, key) => { const k = `${qid}:${key}`; opened.value[k] = !opened.value[k] }

/* ───── 文本抽屉 ───── */
const dw = reactive({ visible: false, title: '', sub: '', qid: '', opt: '', asText: false, kw: '', kwOn: '', page: 1, size: 20, total: 0, list: [], loading: false, err: '' })
let dwSeq = 0

const openTexts = (q, ex) => {
    Object.assign(dw, {
        visible: true, qid: q.id, opt: ex ? ex.key : '', asText: !ex && !!q.asText, kw: '', kwOn: '', page: 1, total: 0, list: [], err: '',
        title: ex ? `${q.no} · 「${ex.label}」补充内容` : `${q.no} · 全部回答`,
        sub: q.title,
    })
    loadTexts(1)
}

const loadTexts = async (p) => {
    if (p) dw.page = p
    const kw = String(dw.kw || '').trim()
    const params = { version: props.ver.version, qid: dw.qid, page: dw.page, size: dw.size }
    if (dw.opt) params.opt = dw.opt
    if (dw.asText) params.asText = true
    if (kw) params.kw = kw
    const tk = ++dwSeq
    dw.loading = true
    const r = await surveyApi('surveyTexts', params)
    if (tk !== dwSeq) return
    dw.loading = false
    if (!r || r.errMsg || !r.data) {
        dw.list = []
        dw.total = 0
        dw.err = `加载失败:${(r && r.errMsg) || '无响应'}`
        return ElMessage.error(dw.err)
    }
    dw.err = ''
    dw.kwOn = kw
    dw.list = r.data.list || []
    dw.total = Number(r.data.total) || 0
}

/** 关键字高亮:按「当前生效的关键字」切段,不用 v-html */
const segs = (text) => {
    const t = String(text == null ? '' : text)
    const kw = dw.kwOn
    if (!kw) return [{ t, hit: false }]
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const out = []
    let last = 0
    let m
    while ((m = re.exec(t))) {
        if (m.index > last) out.push({ t: t.slice(last, m.index), hit: false })
        out.push({ t: m[0], hit: true })
        last = m.index + m[0].length
        if (!m[0].length) re.lastIndex++
    }
    if (last < t.length) out.push({ t: t.slice(last), hit: false })
    return out
}
</script>

<style lang="scss" scoped>
.sp {
    min-height: 240px;
    .tip { margin-bottom: 12px; }
    .sec-tt { font-size: 14px; font-weight: 600; color: #303133; margin: 14px 0 8px; display: flex; align-items: baseline; gap: 8px;
        .sub { font-size: 12px; font-weight: 400; color: #c0c4cc; }
    }
    .muted { font-size: 12px; color: #c0c4cc; padding: 6px 0; }

    /* 概览卡:与小剧场总览 .kpis 同规格 */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
        .kpi { background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 12px 14px; min-width: 0;
            .kv { font-size: 24px; font-weight: 700; color: #303133; font-variant-numeric: tabular-nums; line-height: 1.1;
                i { font-style: normal; font-size: 13px; color: #909399; font-weight: 500; }
                &.sm { font-size: 15px; line-height: 1.5; }
            }
            .kl { font-size: 13px; color: #606266; margin-top: 4px; }
            .kl-top { margin: 0 0 6px; display: flex; align-items: baseline; gap: 6px;
                .kl-sub { font-size: 12px; color: #c0c4cc; }
            }
            .ks { font-size: 12px; color: #909399; margin-top: 2px; line-height: 1.5; }
        }
        .src { display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 22px;
            .src-n { flex: 0 0 64px; color: #606266; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; &.none { color: #c0c4cc; } }
            .src-t { flex: 1; min-width: 20px; height: 6px; background: #f2f3f5; border-radius: 3px; overflow: hidden;
                i { display: block; height: 100%; background: #a0cfff; border-radius: 3px; }
            }
            .src-v { flex: 0 0 auto; color: #909399; font-variant-numeric: tabular-nums; b { color: #303133; } }
        }
    }

    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 12px 14px; min-width: 0;
        &.one-day { font-size: 13px; color: #606266; }
    }

    /* PART 段标题 */
    .part { margin: 18px 0 10px; padding-left: 10px; border-left: 3px solid #409eff;
        .part-eb { font-size: 11px; font-weight: 600; letter-spacing: 1px; color: #409eff; }
        .part-tt { font-size: 15px; font-weight: 600; color: #303133; margin-top: 2px; }
        .part-sub { font-size: 12px; font-weight: 400; color: #909399; margin-left: 8px; }
    }

    /* 题卡 */
    /* 480px:1440 宽笔记本排两列铺满,1920 宽排三列;auto-fill 保证各 PART 之间列宽对齐 */
    .qgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 12px; align-items: start; }
    .qc { background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 12px 14px; min-width: 0; }
    .qc-hd { display: flex; align-items: center; gap: 6px; }
    .qno { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 20px; padding: 0 6px; box-sizing: border-box;
        border-radius: 4px; background: #303133; color: #fff; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .qc-n { margin-left: auto; font-size: 12px; color: #909399; white-space: nowrap;
        b { font-size: 16px; color: #303133; font-variant-numeric: tabular-nums; margin-right: 2px; }
    }
    .qc-tt { font-size: 14px; font-weight: 500; color: #303133; line-height: 1.55; margin: 8px 0 8px; }
    .qc-note { font-size: 12px; color: #e6a23c; margin: -2px 0 6px; }
    .lock { margin-top: 10px; font-size: 13px; color: #606266; background: #f5f7fa; border-radius: 6px; padding: 10px 12px;
        b { color: #303133; font-variant-numeric: tabular-nums; }
    }

    /* 选项横条:标签行在上、条在下(选项多是长句,并排会挤) */
    .opts { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
    .opt { padding: 6px 8px; margin: 0 -8px; border-radius: 6px; transition: background .15s;
        .opt-hd { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; line-height: 18px; }
        .opt-k { flex: 0 0 18px; height: 18px; text-align: center; border-radius: 4px; background: #f0f2f5; color: #606266; font-size: 11px; font-weight: 700; }
        .opt-l { flex: 1; min-width: 0; color: #606266; word-break: break-all; }
        .opt-v { flex: 0 0 auto; color: #909399; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap;
            b { color: #303133; font-size: 13px; }
        }
        .opt-go { flex: 0 0 auto; width: 48px; text-align: right; color: #409eff; font-size: 12px; white-space: nowrap; opacity: 0; transition: opacity .15s; }
        .opt-track { height: 8px; margin: 5px 54px 0 24px; background: #f2f3f5; border-radius: 4px; overflow: hidden; }
        .opt-fill { height: 100%; background: #a0cfff; border-radius: 4px; transition: width .3s; }
        &.click { cursor: pointer;
            &:hover { background: #f5f9ff; .opt-go { opacity: 1; } }
        }
        &.top {
            .opt-k { background: #409eff; color: #fff; }
            .opt-l { color: #303133; font-weight: 600; }
            .opt-fill { background: #409eff; }
        }
        &.zero { .opt-l, .opt-v, .opt-v b { color: #c0c4cc; } }
    }

    /* 补充内容折叠区 */
    .ex { margin-top: 8px; border-top: 1px dashed #ebeef5; padding-top: 8px;
        .ex-hd { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #606266; cursor: pointer; user-select: none;
            &:hover { color: #409eff; }
        }
        .ex-arr { transition: transform .2s; &.open { transform: rotate(90deg); } }
        .ex-bd { margin-top: 6px; padding: 6px 10px; background: #fafafa; border-radius: 6px; }
        .ex-r { display: flex; align-items: baseline; gap: 8px; font-size: 12px; line-height: 1.6; padding: 2px 0;
            .ex-t { flex: 1; min-width: 0; color: #303133; word-break: break-all; }
            .ex-c { flex: 0 0 auto; color: #909399; font-variant-numeric: tabular-nums; }
        }
    }

    /* 问答题样本 */
    .txt { margin-top: 6px;
        .smp { padding: 8px 0; border-bottom: 1px dashed #ebeef5;
            &:last-of-type { border-bottom: 0; }
        }
        /* 多行截断自己写(el-text 加 display:block 会让 line-clamp 失效) */
        .smp-t { font-size: 13px; color: #303133; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
            display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
        .smp-m { display: flex; align-items: center; gap: 4px; margin-top: 2px; font-size: 12px; color: #909399; }
        .more { margin-top: 6px; }
    }

    /* 文本抽屉 */
    .dw { display: flex; flex-direction: column; gap: 10px; }
    .dw-sub { font-size: 13px; color: #606266; line-height: 1.6; background: #f5f7fa; border-radius: 6px; padding: 8px 10px; }
    .dw-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        .dw-total { font-size: 12px; color: #909399; margin-left: auto; }
    }
    .dw-list { min-height: 120px; }
    .dw-it { padding: 10px 0; border-bottom: 1px solid #f2f3f5;
        .dw-who { display: flex; align-items: center; gap: 6px; font-size: 13px; }
        .dw-n { max-width: 160px; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dw-time { margin-left: auto; font-size: 12px; color: #909399; font-variant-numeric: tabular-nums; }
        .dw-txt { margin: 6px 0 0 30px; font-size: 13px; color: #303133; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
            mark { background: #fdf6ec; color: #e6a23c; padding: 0 1px; border-radius: 2px; }
        }
    }
}
</style>
