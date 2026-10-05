<template>
    <div v-loading="loading" class="ap">
        <!-- 第一行:关键字 / 排序(字段 + 升降序) / 按选项筛(题 → 选项两级联动;与「本期总结」钻取是同一个筛选态的两种入口) -->
        <div class="filters">
            <el-input v-model="kw" placeholder="用户 ID / 昵称" clearable style="width: 240px;" @keyup.enter="reload" @clear="reload">
                <template #append><el-button :icon="Search" @click="reload" /></template>
            </el-input>
            <span class="fi">
                <span class="fl">排序</span>
                <el-select v-model="sort" style="width: 112px;" @change="reload">
                    <el-option v-for="o in SORTS" :key="o.key" :label="o.label" :value="o.key" />
                </el-select>
                <el-button :icon="dir === 'desc' ? SortDown : SortUp" @click="toggleDir">{{ dirLabel }}</el-button>
            </span>
            <template v-if="ver.hasDef && choiceQs.length">
                <span class="fl">按选项筛</span>
                <el-select v-model="qid" placeholder="全部题目" clearable filterable style="width: 230px;" @change="onPickQ">
                    <el-option v-for="q in choiceQs" :key="q.id" :label="q.label" :value="q.id" />
                </el-select>
                <el-select v-model="opt" :placeholder="qid ? '全部选项' : '先选题目'" clearable :disabled="!qid" style="width: 220px;" @change="onPickOpt">
                    <el-option v-for="o in qOpts" :key="o.key" :label="`${o.key} · ${o.label}`" :value="o.key">
                        <span class="opt-i" :title="o.label"><b>{{ o.key }}</b> · {{ o.label }}</span>
                    </el-option>
                </el-select>
            </template>
            <el-tag v-if="drill" type="primary" closable disable-transitions class="drill" :title="drill.label" @close="emit('clear-drill')">只看 {{ drill.label }}</el-tag>
            <span class="total">共 <b>{{ total }}</b> 份</span>
        </div>

        <!-- 第二行:用户维度筛选(付费 / 联系方式 / 性别 / 来源 / 提交时间 / 注册时间);每组 label+控件不拆行,窄屏按组换行 -->
        <div class="filters f2">
            <span class="f-tag">筛选</span>
            <span class="fi">
                <span class="fl">付费</span>
                <el-select v-model="f.pay" placeholder="全部" clearable style="width: 132px;" @change="onFilter">
                    <el-option v-for="o in PAY_OPTS" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
            </span>
            <span class="fi">
                <span class="fl">联系方式</span>
                <el-select v-model="f.contact" placeholder="全部" clearable style="width: 124px;" @change="onFilter">
                    <el-option v-for="o in CONTACT_OPTS" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
            </span>
            <span class="fi">
                <span class="fl">性别</span>
                <el-select v-model="f.gender" placeholder="全部" clearable style="width: 84px;" @change="onFilter">
                    <el-option v-for="o in GENDER_OPTS" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
            </span>
            <span class="fi">
                <span class="fl">来源</span>
                <el-select v-model="f.source" placeholder="全部" clearable filterable style="width: 150px;" @change="onFilter">
                    <el-option v-for="s in sourceOpts" :key="s.source" :label="`${s.source}(${s.n})`" :value="s.source" />
                </el-select>
            </span>
            <span class="fi">
                <span class="fl">提交时间</span>
                <!-- v-model 直接用 Date 数组,不配 value-format="x"(2.7 给字符串毫秒初值会显示成 1794 年);宽度走 CSS 变量,行内 style 不生效 -->
                <span class="range-box"><el-date-picker v-model="timeRange" type="daterange" :shortcuts="TIME_SHORTCUTS" unlink-panels range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" clearable @change="reload" /></span>
            </span>
            <span class="fi">
                <span class="fl">注册时间</span>
                <span class="range-box"><el-date-picker v-model="regRange" type="daterange" :shortcuts="REG_SHORTCUTS" unlink-panels range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" clearable @change="reload" /></span>
            </span>
            <el-button v-if="hasFilter" link type="primary" class="reset" @click="resetAll">重置</el-button>
        </div>

        <el-alert v-if="truncated" type="warning" :closable="false" show-icon title="这一期答卷超过单次统计上限,按用户维度的筛选 / 排序只覆盖了部分答卷" class="trunc" />

        <!-- 列宽全部 min-width 吃剩余空间,不用 fixed 列免横滑;点整行开答卷抽屉;当前排序字段所在列的列头高亮 + 箭头 -->
        <div ref="tableTop" class="tbl">
            <el-table :data="rows" size="small" border stripe row-key="_id" :row-class-name="rowClass" :header-cell-class-name="headerCls" style="width: 100%;" @row-click="openAt">
                <el-table-column label="用户" min-width="170">
                    <template #default="{ row }">
                        <div class="who">
                            <el-avatar :size="40" :src="row.user.avatar || undefined" class="who-av">
                                <span v-if="row.user.nickname">{{ String(row.user.nickname).slice(0, 1) }}</span>
                                <el-icon v-else :size="20"><UserFilled /></el-icon>
                            </el-avatar>
                            <div class="who-t">
                                <div class="who-n">
                                    <span class="nk" :class="{ none: !row.user.nickname }">{{ row.user.nickname || '未设置昵称' }}</span>
                                    <span v-if="GENDER[row.user.gender]" class="gd" :class="'g' + row.user.gender">{{ GENDER[row.user.gender] }}</span>
                                </div>
                                <id-copy :id="row.user_id" label="uid" />
                            </div>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column :label="hd('time', '提交时间')" column-key="time" min-width="100">
                    <template #default="{ row }">
                        <div class="tm">{{ row.tm[0] }}</div>
                        <div class="muted">{{ row.tm[1] }}</div>
                    </template>
                </el-table-column>
                <el-table-column :label="hd('duration', '用时')" column-key="duration" min-width="86" align="center">
                    <template #default="{ row }">
                        <div :class="{ fast: row.fast }">{{ fmtDuration(row.duration) }}</div>
                        <el-tag v-if="row.fast" type="warning" size="small" effect="light" disable-transitions>过快</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="来源" min-width="84" align="center">
                    <template #default="{ row }">
                        <span v-if="row.source" class="src">{{ row.source }}</span>
                        <span v-else class="muted">—</span>
                    </template>
                </el-table-column>
                <el-table-column :label="hd('pay', '付费')" column-key="pay" min-width="96" align="center">
                    <template #default="{ row }">
                        <template v-if="row.user.pay_total > 0">
                            <div class="pay">{{ yuan(row.user.pay_total) }} 元<span v-if="row.vip" class="vip">会员</span></div>
                            <div class="muted">{{ row.user.pay_count || 0 }} 次</div>
                        </template>
                        <el-tag v-else type="info" size="small" effect="plain" disable-transitions class="unpaid">未付费</el-tag>
                    </template>
                </el-table-column>
                <el-table-column :label="hd('reg', '注册 / 活跃')" column-key="reg" min-width="150">
                    <template #default="{ row }">
                        <div class="ra"><span class="seg">注册 {{ row.regDay }}</span><span v-if="row.regDays != null" class="seg muted days">{{ num(row.regDays) }} 天</span></div>
                        <div class="muted"><span class="seg">最近登录 {{ row.lastLogin }}</span><span class="seg"> · 聊天 {{ num(row.user.chat_total) }}</span><span class="seg"> · 登录 {{ num(row.user.login_count) }}</span></div>
                    </template>
                </el-table-column>
                <el-table-column label="联系方式" min-width="160">
                    <template #default="{ row }">
                        <template v-if="row.user.wechat_id || row.user.beta_phone">
                            <div v-if="row.user.wechat_id" class="ct">
                                <span class="ct-k">微信</span><span class="ct-v" :title="row.user.wechat_id">{{ row.user.wechat_id }}</span>
                                <el-button link size="small" class="cp" :icon="CopyDocument" title="复制微信号" @click.stop="copy(row.user.wechat_id, '微信号')" />
                            </div>
                            <div v-if="row.user.beta_phone" class="ct">
                                <span class="ct-k">手机</span><span class="ct-v">{{ row.user.beta_phone }}</span>
                                <el-button link size="small" class="cp" :icon="CopyDocument" title="复制手机号" @click.stop="copy(row.user.beta_phone, '手机号')" />
                            </div>
                        </template>
                        <span v-else class="muted">—</span>
                    </template>
                </el-table-column>
                <el-table-column label="答案预览" min-width="230">
                    <template #default="{ row }">
                        <div v-if="row.pv.length" class="pv">
                            <div v-for="(p, i) in row.pv" :key="i" class="pv-l">
                                <span class="pv-no">{{ p.no }}</span><span class="pv-t">{{ p.text }}</span>
                            </div>
                            <div class="pv-more">{{ row.pvMore ? '…' : '' }}共 {{ row.answered }} 题</div>
                        </div>
                        <span v-else class="muted">{{ row.answered ? `只填了联系方式 · 共 ${row.answered} 题` : '没有作答内容' }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="88" align="center">
                    <template #default="{ row }">
                        <el-button type="primary" link size="small" @click.stop="openAt(row)">查看答卷</el-button>
                    </template>
                </el-table-column>
                <template #empty>
                    <el-empty v-if="!loading" :description="filtered ? '没有符合条件的答卷' : '这一期还没有人填写'" :image-size="72" />
                    <div v-else class="empty-ph" />
                </template>
            </el-table>
        </div>

        <div class="pagination">
            <el-pagination v-model:currentPage="page" v-model:page-size="size" :total="total" :page-sizes="[20, 50]" layout="total, sizes, prev, pager, next" small @size-change="onSize" @current-change="onPage" />
        </div>

        <answer-drawer v-model="drawerOpen" :row="curRow" :ver="ver" :index="idx" :count="rows.length" @prev="step(-1)" @next="step(1)" />
    </div>
</template>

<script setup>
/**
 * 问卷后台 · 填写明细面板:看某一期里每个用户的答卷(用户 / 时间 / 用时 / 来源 / 付费 / 注册活跃 / 联系方式 / 答案预览),点行开整份答卷抽屉。
 * 数据经 drama-admin.surveyAnswers 服务端分页 + 筛选 + 排序;原始答案只在前端用 buildSheet 解码(题目定义缺失时退化为题号 + 字母,照样能看)。
 * 外壳切期时用 :key 重建本面板,所以这里不监听 ver 变化;「本期总结」点选项条钻取过来走 drill,与「按选项筛」两个下拉共用同一个筛选态。
 * 10-05 二调:按充值 / 填写时间 / 注册时间等多角度筛选与排序(排序 = 字段 + 升降序两个参数;空值一律不传)。
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { Search, UserFilled, CopyDocument, SortDown, SortUp } from '@element-plus/icons-vue'
import { surveyApi, qText, optionList, buildSheet, fmtDuration, fmtTime } from '@/utils/survey'
import { copyText } from '@/utils/common'
import { genderEnums } from '@/config/enums'
import IdCopy from '@/pages/drama/components/id-copy.vue'
import AnswerDrawer from './answer-drawer.vue'

const props = defineProps({
    /* 当前期(mergeVersions 的一项) */
    ver: { type: Object, required: true },
    /* 总结面板钻取:{ qid, opt, label } | null */
    drill: { type: Object, default: null },
})
const emit = defineEmits(['clear-drill'])

/*
 * 排序字段(key = 云对象 sort 白名单)。col = 该字段落在哪一列(列头高亮 + 箭头);
 * hd = 一列承载多个字段时列头补的小字;kind 决定升降序按钮文案(时间说新旧、用时说长短、数值说高低)。
 */
const SORTS = [
    { key: 'time', label: '提交时间', col: 'time', hd: '', kind: 'time' },
    { key: 'duration', label: '填写用时', col: 'duration', hd: '', kind: 'dur' },
    { key: 'pay_total', label: '累计充值', col: 'pay', hd: '累计', kind: 'num' },
    { key: 'pay_count', label: '充值次数', col: 'pay', hd: '次数', kind: 'num' },
    { key: 'register_date', label: '注册时间', col: 'reg', hd: '注册', kind: 'time' },
    { key: 'last_login_date', label: '最近登录', col: 'reg', hd: '最近登录', kind: 'time' },
    { key: 'chat_total', label: '聊天次数', col: 'reg', hd: '聊天', kind: 'num' },
    { key: 'login_count', label: '登录次数', col: 'reg', hd: '登录', kind: 'num' },
]
const DIR_LABEL = { time: ['从新到旧', '从旧到新'], dur: ['从长到短', '从短到长'], num: ['从高到低', '从低到高'] }
/* 付费下拉:前两项传 pay,充值门槛三项传 payMin(单位元),互斥 */
const PAY_OPTS = [
    { value: 'paid', label: '付费过', param: { pay: 'paid' } },
    { value: 'unpaid', label: '未付费', param: { pay: 'unpaid' } },
    { value: 'min50', label: '充值 ≥ 50 元', param: { payMin: 50 } },
    { value: 'min200', label: '充值 ≥ 200 元', param: { payMin: 200 } },
    { value: 'min500', label: '充值 ≥ 500 元', param: { payMin: 500 } },
]
const CONTACT_OPTS = [{ value: 'yes', label: '留了联系方式' }, { value: 'no', label: '没留' }]
/* 性别用字符串当 v-model:0 是有效值,el-select 只有空串才显示占位符,数字 0 / 空串都会和「全部」混淆;发请求时转数字 */
const GENDER_OPTS = [{ value: '2', label: genderEnums[2] }, { value: '1', label: genderEnums[1] }, { value: '0', label: genderEnums[0] }]

/* 日期快捷项:按自然日;近 N 天 = 含今天往前 N 个自然日 */
const daysBack = (n) => () => [dayjs().subtract(n - 1, 'day').startOf('day').toDate(), dayjs().endOf('day').toDate()]
const TIME_SHORTCUTS = [
    { text: '今天', value: daysBack(1) },
    { text: '昨天', value: () => [dayjs().subtract(1, 'day').startOf('day').toDate(), dayjs().subtract(1, 'day').endOf('day').toDate()] },
    { text: '近3天', value: daysBack(3) },
    { text: '近7天', value: daysBack(7) },
    { text: '近30天', value: daysBack(30) },
]
/* daterange 起点不能留空,「一年以前注册」的起点用一个足够早的日期兜住 */
const REG_SHORTCUTS = [
    { text: '近7天注册', value: daysBack(7) },
    { text: '近30天注册', value: daysBack(30) },
    { text: '近90天注册', value: daysBack(90) },
    { text: '一年以前注册', value: () => [new Date(2000, 0, 1), dayjs().subtract(1, 'year').endOf('day').toDate()] },
]

/* 用时低于这个秒数标「过快」:多半是没读题乱点的,看答案时心里有数 */
const FAST_SEC = 60
/* 只标男 / 女;0 未知不占位(对象键是字符串,数字 / 字符串形态的 gender 都能命中) */
const GENDER = { 1: genderEnums[1], 2: genderEnums[2] }
/* 这些参数出现在请求里 = 「有筛选」(决定空态文案);sort / dir 不算 */
const FILTER_KEYS = ['kw', 'qid', 'pay', 'payMin', 'contact', 'gender', 'source', 'timeFrom', 'regFrom']

const kw = ref('')
const sort = ref('time')
const dir = ref('desc')
const qid = ref('')
const opt = ref('')
const f = reactive({ pay: '', contact: '', gender: '', source: '' })
const timeRange = ref(null) // [Date, Date] | null
const regRange = ref(null)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const list = ref([])
const sources = ref([]) // 本期来源分布:只有第 1 页的响应带,拿到就缓存,翻页不清
const truncated = ref(false)
const loading = ref(false)
const filtered = ref(false) // 最近一次生效的请求是否带筛选(输入框里还没回车的字不算)
const tableTop = ref(null)
const drawerOpen = ref(false)
const idx = ref(-1)

/* 钻取进来时先把两个下拉同步成钻取值,首拉就带上(外壳可能带着 drill 新建本面板) */
if (props.drill) {
    qid.value = props.drill.qid || ''
    opt.value = props.drill.opt || ''
}

let seq = 0 // 请求自增序号:只采纳最后一次请求的结果
let appliedKey = '' // 最近一次发出的请求里生效的「题|选项」,改下拉后据此判断要不要重拉

const short = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s)
const qNo = (id) => { const m = /^q(\d+)$/i.exec(String(id || '')); return m ? `Q${m[1]}` : String(id || '').toUpperCase() }
/** 分 → 元:按约定保留到元;不足 1 元的小额单(测试单)显示 <1,免得付过费却显示 0 */
const yuan = (fen) => { const v = Math.round((Number(fen) || 0) / 100); return v > 0 ? String(v) : '<1' }
/** 计数千分位:1234 → 1,234;缺省按 0 */
const num = (n) => (Number(n) || 0).toLocaleString('en-US')
/** 日期区间 → [起始日 00:00:00.000, 结束日 23:59:59.999] 毫秒;没选 → null */
const span = (r) => (r && r[0] && r[1] ? [dayjs(r[0]).startOf('day').valueOf(), dayjs(r[1]).endOf('day').valueOf()] : null)
/* 题目定义出问题时只坏这一行的预览,不让整张表渲染崩掉 */
const sheetOf = (answers) => {
    try { return buildSheet(props.ver, answers) || [] } catch (e) { console.warn('[answers-panel] buildSheet 失败', e); return [] }
}
/** 一题 → 预览单行文本:选择题 = 选项文本(带补充),问答 = 原文压成一行 */
const brief = (it) => (it.kind === 'text'
    ? String(it.text || '').replace(/\s+/g, ' ')
    : (it.items || []).map((x) => (x.label || x.key) + (x.extra ? `：${x.extra}` : '')).join('、'))

/* 「按选项筛」第一级:本期的单选 / 多选题 */
const choiceQs = computed(() => (props.ver.questions || [])
    .filter((q) => q && (q.type === 'radio' || q.type === 'checkbox'))
    .map((q) => ({ id: q.id, label: `${qNo(q.id)} · ${short(qText(q.title), 16)}`, q })))
/* 第二级:所选题的选项(字母 ↔ 文本口径与 decodeAnswer 同源) */
const qOpts = computed(() => {
    const hit = choiceQs.value.find((x) => x.id === qid.value)
    return hit ? optionList(hit.q) : []
})
/* 来源下拉:空来源不列 */
const sourceOpts = computed(() => (sources.value || [])
    .filter((s) => s && s.source != null && String(s.source) !== '')
    .map((s) => ({ source: String(s.source), n: Number(s.n) || 0 })))

const sortMeta = computed(() => SORTS.find((s) => s.key === sort.value) || SORTS[0])
const dirLabel = computed(() => DIR_LABEL[sortMeta.value.kind][dir.value === 'desc' ? 0 : 1])
/** 列头:当前排序字段所在列拼上小字与箭头,一眼看出按什么排的 */
const hd = (col, base) => {
    const m = sortMeta.value
    if (m.col !== col) return base
    return `${base}${m.hd ? ' · ' + m.hd : ''} ${dir.value === 'desc' ? '↓' : '↑'}`
}
const headerCls = ({ column }) => (column && column.columnKey && column.columnKey === sortMeta.value.col ? 'col-sorted' : '')

/* 「重置」只在有筛选时出现(含关键字、按选项筛、钻取、第二行各项;排序不算) */
const hasFilter = computed(() => !!(kw.value.trim() || qid.value || opt.value || props.drill
    || f.pay || f.contact || f.gender || f.source || span(timeRange.value) || span(regRange.value)))

/* 列表行 = 接口行 + 展示用派生字段(只在 list 变化时算一次,不在模板里反复解码) */
const rows = computed(() => {
    const now = Date.now()
    return list.value.map((r) => {
        const u = r.user || {}
        const sheet = sheetOf(r.answers)
        const answered = sheet.filter((it) => it.kind !== 'empty')
        const pv = answered.filter((it) => !it.isContact)
        const tm = fmtTime(r.time).split(' ')
        const dur = Number(r.duration) || 0
        const reg = Number(u.register_date) || 0
        const ll = Number(u.last_login_date) || 0
        return {
            ...r,
            user: u,
            tm: [tm[0], tm[1] || ''],
            fast: dur > 0 && dur < FAST_SEC,
            vip: (Number(u.pay_total) || 0) > 0 && (Number(u.vip_end_time) || 0) > now,
            regDay: reg ? dayjs(reg).format('YYYY-MM-DD') : '—',
            regDays: reg ? Math.max(0, Math.floor((now - reg) / 86400000)) : null,
            lastLogin: ll ? dayjs(ll).format('MM-DD HH:mm') : '—',
            pv: pv.slice(0, 3).map((it) => ({ no: it.no, text: brief(it) })),
            pvMore: pv.length > 3,
            answered: answered.length,
        }
    })
})
const curRow = computed(() => rows.value[idx.value] || null)
/* 抽屉开着时,表格里同步标出当前看的那一行 */
/* 按 _id 比:el-table 回传的 row 是它内部响应式代理,和本面板 rows 里的原对象不是同一个引用 */
const rowClass = ({ row }) => (drawerOpen.value && curRow.value && row && row._id === curRow.value._id ? 'row-cur' : '')

const curKey = () => (qid.value && opt.value ? `${qid.value}|${opt.value}` : '')

/**
 * 拼请求参数:version / page / size / sort / dir 必带,其余空值一律不传。
 * 付费下拉二选一传 pay 或 payMin;性别字符串转数字;日期区间转含端点的毫秒。
 */
const buildParams = () => {
    const p = { version: props.ver.version, page: page.value, size: size.value, sort: sort.value, dir: dir.value }
    const k = kw.value.trim()
    if (k) p.kw = k
    if (curKey()) { p.qid = qid.value; p.opt = opt.value }
    const po = PAY_OPTS.find((o) => o.value === f.pay)
    if (po) Object.assign(p, po.param)
    if (f.contact) p.contact = f.contact
    if (f.gender !== '') p.gender = Number(f.gender)
    if (f.source) p.source = f.source
    const t = span(timeRange.value)
    if (t) { p.timeFrom = t[0]; p.timeTo = t[1] }
    const g = span(regRange.value)
    if (g) { p.regFrom = g[0]; p.regTo = g[1] }
    return p
}

const load = async (pg) => {
    if (pg) page.value = pg
    const my = ++seq
    appliedKey = curKey()
    const params = buildParams()
    loading.value = true
    const r = await surveyApi('surveyAnswers', params)
    if (my !== seq) return // 期间又发了新请求:这次的结果作废,防止慢的旧结果盖掉新筛选
    loading.value = false
    filtered.value = FILTER_KEYS.some((k) => k in params)
    if (!r || r.errMsg) { list.value = []; total.value = 0; truncated.value = false; return ElMessage.error((r && r.errMsg) || '加载失败') }
    const d = r.data || {}
    list.value = Array.isArray(d.list) ? d.list : []
    total.value = Number(d.total) || 0
    truncated.value = !!d.truncated
    if (Array.isArray(d.sources)) sources.value = d.sources
}
const reload = () => load(1)
const toggleDir = () => { dir.value = dir.value === 'desc' ? 'asc' : 'desc'; reload() }
/* 第二行下拉:el-select 2.7 清空时回 undefined,统一成空串再重拉 */
const onFilter = () => {
    Object.keys(f).forEach((k) => { f[k] = f[k] || '' })
    reload()
}

/** 若当前筛选来自钻取,手动动了下拉就脱离钻取(外壳把 drill 置空,标签消失) */
const leaveDrill = () => { if (props.drill) emit('clear-drill') }
/* 换题:选项跟着清空;el-select 2.7 清空时回 undefined,统一成空串 */
const onPickQ = () => {
    qid.value = qid.value || ''
    opt.value = ''
    leaveDrill()
    if (curKey() !== appliedKey) reload()
}
const onPickOpt = () => {
    opt.value = opt.value || ''
    leaveDrill()
    if (curKey() !== appliedKey) reload()
}
/** 重置:清空全部筛选(排序保留)并重拉;存在钻取时一并脱离(drill 置空后 watch 见下拉已清空,不会再拉第二次) */
const resetAll = () => {
    kw.value = ''
    qid.value = ''
    opt.value = ''
    Object.assign(f, { pay: '', contact: '', gender: '', source: '' })
    timeRange.value = null
    regRange.value = null
    leaveDrill()
    reload()
}

/*
 * drill 变化:非空 → 两个下拉同步成钻取值并从第 1 页拉;
 * 置空 → 若下拉还停在旧钻取值上(= 点了标签上的 ×),筛选一并清掉重拉;若是手动改下拉 / 重置触发的,下拉已是新值且已重拉,不动。
 */
watch(() => props.drill, (d, old) => {
    if (d) {
        qid.value = d.qid || ''
        opt.value = d.opt || ''
        reload()
        return
    }
    if (old && qid.value === (old.qid || '') && opt.value === (old.opt || '')) {
        qid.value = ''
        opt.value = ''
        reload()
    }
})

/**
 * 翻页回到表格顶部。只在表头已滚出可视区时才滚:页面外壳是 el-scrollbar(顶上还压着导航条),
 * 所以拿滚动容器的上沿而不是视口 0 来比,表头还看得见就不动,免得页面无谓跳一下。
 */
const toTop = () => {
    const el = tableTop.value
    if (!el || !el.scrollIntoView) return
    const box = el.closest ? el.closest('.el-scrollbar__wrap') : null
    const limit = box ? box.getBoundingClientRect().top : 0
    if (el.getBoundingClientRect().top < limit) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
const onPage = () => { load(); toTop() }
const onSize = () => { load(1); toTop() }

/** 点行 / 「查看答卷」:按当前页里的位置打开抽屉,抽屉内上一份 / 下一份在本页切换 */
const openAt = (row) => {
    /* 不能用 indexOf(row):el-table 把 data 存进自己的响应式 store,row-click / 插槽给出来的是代理对象,引用对不上(10-05 真机:点行抽屉不开) */
    const i = row ? rows.value.findIndex((r) => r._id === row._id) : -1
    if (i < 0) return
    idx.value = i
    drawerOpen.value = true
}
const step = (d) => {
    const i = idx.value + d
    if (i >= 0 && i < rows.value.length) idx.value = i
}

const copy = async (text, label) => {
    if (!text) return
    const ok = await copyText(String(text)).catch(() => false)
    ElMessage[ok ? 'success' : 'error'](ok ? `已复制${label}：${text}` : '复制失败')
}

onMounted(() => load(1))
</script>

<style lang="scss" scoped>
.ap {
    .filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;
        .fl { font-size: 13px; color: #606266; margin-left: 4px; }
        /* 一组「标签 + 控件」不拆行,窄屏按组换行 */
        .fi { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .drill { max-width: 340px;
            :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }
        .total { margin-left: auto; font-size: 13px; color: #909399; white-space: nowrap;
            b { color: #303133; font-size: 15px; font-variant-numeric: tabular-nums; margin: 0 2px; }
        }
        /* element-plus 2.7 日期区间默认 350px,行内 style 不生效,用变量压窄(与访客页内测招募同法) */
        .range-box :deep(.el-date-editor) { --el-date-editor-width: 240px; width: 240px !important; }
    }
    .f2 { gap: 8px 12px;
        .f-tag { font-size: 11px; color: #909399; background: #f4f4f5; border-radius: 3px; padding: 0 6px; line-height: 20px; }
        .fl { margin-left: 0; }
        .reset { margin-left: 2px; }
    }
    .trunc { margin: -2px 0 10px; }
    .opt-i { display: block; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        b { font-weight: 600; color: #409eff; }
    }
    .tbl { scroll-margin-top: 8px; }
    /* 全局 .pagination 是透明吸底(App.vue),滚动时会和表格行叠字;这里补白底 + 上沿细线,让它读起来是一条工具栏 */
    .pagination { background: #fff; padding: 10px 0; margin-top: 6px; border-top: 1px solid #ebeef5; }
    .muted { font-size: 12px; color: #909399; line-height: 1.5; }
    /* 一段文字不拆开,换行只发生在「 · 」分隔处 */
    .seg { white-space: nowrap; }

    .who { display: flex; align-items: center; gap: 10px; min-width: 0;
        .who-av { flex: 0 0 40px; background: #ecf5ff; color: #409eff; font-size: 16px; }
        .who-t { min-width: 0; flex: 1; }
        .who-n { display: flex; align-items: center; gap: 4px; min-width: 0; line-height: 1.5; }
        .nk { font-size: 13px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            &.none { color: #c0c4cc; font-weight: 400; }
        }
    }
    .gd { flex: 0 0 auto; font-size: 11px; line-height: 16px; padding: 0 4px; border-radius: 3px;
        &.g1 { color: #409eff; background: #ecf5ff; }
        &.g2 { color: #f56c6c; background: #fef0f0; }
    }
    .tm { font-size: 13px; color: #303133; font-variant-numeric: tabular-nums; }
    .fast { color: #e6a23c; font-weight: 600; margin-bottom: 2px; }
    .src { font-size: 12px; color: #606266; word-break: break-all; }
    .pay { font-size: 14px; font-weight: 600; color: #67c23a; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .vip { display: inline-block; margin-left: 4px; font-size: 10px; font-weight: 600; line-height: 15px; padding: 0 4px; border-radius: 3px; color: #b88230; background: #fdf6ec; border: 1px solid #f5dab1; vertical-align: 2px; }
    .unpaid { opacity: .7; }
    .ra { font-size: 12px; color: #303133; line-height: 1.6; font-variant-numeric: tabular-nums;
        /* 间距用 margin 给:模板里 span 开头的纯空格会被 Vue 的空白压缩吃掉,日期和天数会粘在一起 */
        .days { margin-left: 6px; }
    }

    .ct { display: flex; align-items: center; gap: 4px; font-size: 12px; line-height: 1.7; min-width: 0;
        .ct-k { flex: 0 0 auto; color: #909399; }
        .ct-v { color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
        .cp { flex: 0 0 auto; height: 18px; padding: 0 2px; color: #909399; &:hover { color: #409eff; } }
    }

    /* 预览:每题一行单行省略(自己写截断,不靠 el-text line-clamp) */
    .pv { min-width: 0; }
    .pv-l { display: flex; align-items: baseline; gap: 6px; min-width: 0; font-size: 12px; line-height: 1.7; }
    .pv-no { flex: 0 0 auto; font-size: 11px; font-weight: 600; color: #409eff; font-variant-numeric: tabular-nums; }
    .pv-t { flex: 1; min-width: 0; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pv-more { font-size: 11px; color: #c0c4cc; line-height: 1.5; }

    .empty-ph { height: 160px; }
    /* el-table 把 #empty 插槽包在 line-height:60px、width:50% 的 span 里,el-empty 放进去会被撑歪,这里还原 */
    :deep(.el-table__empty-text) { width: auto; line-height: 1.5; }
    :deep(.el-table .cell) { line-height: 1.4; }
    :deep(th.col-sorted) { background: #ecf5ff !important; }
    :deep(th.col-sorted .cell) { color: #409eff; }
    :deep(.el-table__row) { cursor: pointer; }
    :deep(.el-table__row:hover > td) { background: #ecf5ff !important; }
    :deep(.row-cur > td) { background: #d9ecff !important; }
}
</style>
