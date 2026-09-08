<template>
    <div v-loading="loading" class="ov">
        <!-- 时间筛选 -->
        <div class="filters">
            <el-radio-group v-model="preset" @change="onPreset">
                <el-radio-button v-for="p in PRESETS" :key="p.key" :value="p.key">{{ p.label }}</el-radio-button>
            </el-radio-group>
            <el-date-picker v-model="range" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" :default-time="defaultTime" style="width: 360px;" @change="onCustom" />
            <el-button type="primary" @click="load">🔄 刷新</el-button>
            <el-switch v-model="autoRefresh" inline-prompt active-text="自动" inactive-text="手动" @change="onAuto" />
            <span v-if="lastUpdate" class="upd">更新于 {{ lastUpdate }}</span>
            <span v-if="d" class="hint">{{ fmtRange }} · {{ d.bucket === 'hour' ? '按小时' : '按天' }}分桶 · 最长回看 31 天</span>
        </div>

        <template v-if="d">
            <!-- 此刻快照 -->
            <div class="sec-tt">此刻</div>
            <div class="tiles">
                <div class="tile"><div class="tv">{{ d.now.lanterns.playing }}</div><div class="tl">留灯（进行中的局）</div><div class="ts">长明 {{ d.now.lanterns.eternal }} · 限时 {{ d.now.lanterns.timed }}</div></div>
                <div class="tile" :class="d.now.reports_pending ? 'bad' : 'ok'"><div class="tv">{{ d.now.reports_pending }}</div><div class="tl">待处理举报</div><div class="ts">{{ d.now.reports_pending ? '去「举报」处理' : '没有积压' }}</div></div>
                <div class="tile"><div class="tv">{{ d.now.scripts.public }}<i> / {{ d.now.scripts.private }}</i></div><div class="tl">公开本 / 私有本</div><div class="ts">已交付的自由本</div></div>
                <div class="tile"><div class="tv">{{ d.now.scripts.writing }}</div><div class="tl">执笔中</div><div class="ts">正在生成的本</div></div>
            </div>

            <!-- 问题信号 -->
            <div class="sec-tt">问题信号 <span class="sub">按这段时间的数据自动判断，阈值见代码 INSIGHT</span></div>
            <div class="insights">
                <el-alert v-for="(it, i) in insights" :key="i" :type="it.type" :title="it.text" show-icon :closable="false" />
            </div>

            <!-- 这段时间的核心数 -->
            <div class="sec-tt">这段时间</div>
            <div class="kpis">
                <div class="kpi"><div class="kv">{{ d.create.n }}</div><div class="kl">新建本</div><div class="ks">交付 {{ d.create.delivered }} · 执笔中 {{ d.create.writing }} · 判死 {{ d.create.dead }}<template v-if="d.create.deleted"> · 已删 {{ d.create.deleted }}</template></div></div>
                <div class="kpi"><div class="kv">{{ d.create.creators }}</div><div class="kl">执笔人</div><div class="ks">初审公开 {{ d.create.public }} · 不合规 {{ d.create.ai_fail }}<template v-if="d.create.ai_pending"> · AI 未判 {{ d.create.ai_pending }}</template></div></div>
                <div class="kpi"><div class="kv">{{ d.play.sessions }}</div><div class="kl">开局</div><div class="ks">自由本 {{ d.play.by_source.free }} · 官方本 {{ d.play.by_source.official }} · 均 {{ d.play.avg_turns }} 轮</div></div>
                <div class="kpi"><div class="kv">{{ d.play.players }}</div><div class="kl">玩家（去重）</div><div class="ks">付费局占比 {{ pct(d.play.paid_share) }}</div></div>
                <div class="kpi" :class="toneRate(d.play.settle_rate, d.play.sessions, 0.3, true)"><div class="kv">{{ d.play.settled }}<i> {{ pct(d.play.settle_rate) }}</i></div><div class="kl">完局 · 完局率</div><div class="ks">进行中 {{ d.play.playing }} · 弃局 {{ d.play.abandoned }}（{{ pct(d.play.abandon_rate) }}）</div></div>
                <div class="kpi"><div class="kv">{{ d.endings.unlocks }}</div><div class="kl">结局解锁</div><div class="ks">{{ d.endings.users }} 人 · {{ d.endings.scripts }} 本<template v-for="(v, k) in d.endings.by_rarity" :key="k"> · {{ k }} {{ v }}</template></div></div>
                <div class="kpi" :class="d.money.warn ? 'bad' : ''"><div class="kv">{{ d.money.net }}<i> 贝</i></div><div class="kl">净实收</div><div class="ks">实收 {{ d.money.income }} · 退 {{ d.money.refund }} · 发放 {{ d.money.grant }}（{{ pct(d.money.ratio) }}）· 买断 {{ d.money.full_unlocks }}</div></div>
                <div class="kpi" :class="errTotal ? 'bad' : 'ok'"><div class="kv">{{ errTotal }}</div><div class="kl">错误</div><div class="ks">前端 {{ d.quality.errors.fe_error }} · 判死 {{ d.quality.errors.gen_dead }} · 等待失败 {{ d.quality.errors.create_wait_fail }} · BGM {{ d.quality.errors.bgm_error }}</div></div>
                <div class="kpi" :class="d.quality.reports ? 'warn' : ''"><div class="kv">{{ d.quality.reports }}</div><div class="kl">新举报</div><div class="ks"><template v-for="(v, k) in d.quality.reports_by_status" :key="k">{{ REPORT_STATUS_LABEL[k] || k }} {{ v }} · </template>累计待处理 {{ d.now.reports_pending }}</div></div>
            </div>

            <!-- 趋势(小倍数,一图一轴) -->
            <div class="sec-tt">趋势 <span class="sub">悬停看具体值</span></div>
            <div class="charts">
                <div class="card"><mini-chart title="开局 · 玩家 · 完局" :labels="labels" :series="[{ name: '开局', color: C[0], values: pick('sessions') }, { name: '玩家', color: C[1], values: pick('players') }, { name: '完局', color: C[2], values: pick('settled') }]" /></div>
                <div class="card"><mini-chart title="新建本 · 判死" :labels="labels" :series="[{ name: '新建本', color: C[0], values: pick('created') }, { name: '判死', color: C[7], values: pick('dead') }]" /></div>
                <div class="card"><mini-chart title="结局解锁" :labels="labels" :series="[{ name: '结局解锁', color: C[6], values: pick('unlocks') }]" /></div>
                <div class="card"><mini-chart title="实收 · 发放（贝）" unit=" 贝" :labels="labels" :series="[{ name: '实收', color: C[0], values: pick('income') }, { name: '发放', color: C[3], values: pick('grant') }]" /></div>
                <div class="card"><mini-chart title="错误 · 举报" :labels="labels" :series="[{ name: '错误', color: C[7], values: pick('errors') }, { name: '举报', color: C[6], values: pick('reports') }]" /></div>
            </div>

            <!-- 分布 -->
            <div class="sec-tt">分布</div>
            <div class="charts">
                <div class="card"><mini-chart type="hbar" title="计费模式" subtitle="按开局" :items="byModeItems" unit=" 局" /></div>
                <div class="card"><mini-chart type="hbar" title="局的状态" :items="stateItems" unit=" 局" /></div>
                <div class="card"><mini-chart type="hbar" title="初审结果" subtitle="这段时间交付的本" :items="auditItems" unit=" 本" /></div>
                <div class="card"><mini-chart type="hbar" title="结局稀有度" :items="rarityItems" unit=" 次" /></div>
                <div class="card"><mini-chart type="hbar" title="扣费构成" subtitle="贝" :items="chargeItems" unit=" 贝" /></div>
                <div class="card"><mini-chart type="hbar" title="前端异常分型" :items="feKindItems" unit=" 次" empty="没有前端异常" /></div>
            </div>

            <!-- 榜单 -->
            <div class="sec-tt">榜单</div>
            <div class="charts two">
                <div class="card">
                    <div class="card-tt">这段时间最多人玩的本</div>
                    <el-table :data="d.hot" size="small" style="width: 100%;">
                        <el-table-column label="本" min-width="180">
                            <template #default="{ row }">
                                <span class="tt" :class="{ link: row.source === 'free' }" @click="row.source === 'free' && openDrawer(row._id)">{{ row.title }}</span>
                                <el-tag size="small" :type="row.source === 'free' ? 'warning' : 'info'" effect="plain" style="margin-left: 4px;">{{ row.source === 'free' ? '自由本' : '官方本' }}</el-tag>
                                <el-tag v-if="row.source === 'free'" size="small" :type="VIS_TAG[row.visibility] || 'info'" effect="plain" style="margin-left: 4px;">{{ VIS_LABEL[row.visibility] || row.visibility }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column prop="sessions" label="开局" width="64" align="center" />
                        <el-table-column prop="players" label="玩家" width="64" align="center" />
                        <el-table-column prop="heat_score" label="热度" width="70" align="center" />
                    </el-table>
                    <div v-if="!d.hot.length" class="muted">这段时间没有开局</div>
                </div>
                <div class="card">
                    <div class="card-tt">自由本热度榜（当前）</div>
                    <el-table :data="d.heat_top" size="small" style="width: 100%;">
                        <el-table-column label="本" min-width="180">
                            <template #default="{ row }">
                                <span class="tt link" @click="openDrawer(row._id)">{{ row.title }}</span>
                                <el-tag size="small" :type="VIS_TAG[row.visibility] || 'info'" effect="plain" style="margin-left: 4px;">{{ VIS_LABEL[row.visibility] || row.visibility }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column prop="heat_score" label="热度分" width="70" align="center" />
                        <el-table-column prop="heat" label="终身" width="64" align="center" />
                        <el-table-column prop="players" label="玩家" width="64" align="center" />
                    </el-table>
                </div>
            </div>

            <el-alert v-if="anyTruncated" type="warning" show-icon :closable="false" style="margin-top: 12px;" title="某张表这段时间超过 1 万条被截断，数字偏小——缩小时间范围，或给相关表加时间索引" />
        </template>
        <el-empty v-else-if="!loading" :description="err || '没有数据'" />

        <script-drawer ref="drawerRef" @changed="load" />
    </div>
</template>

<script setup>
/**
 * 总览统计台(09-09 黎令:进小剧场监控第一眼看到的报表)。
 * 数据经 drama-admin.overview 一次拉齐(此刻快照 + 这段时间的执笔/玩/结局/钱/问题 + 趋势桶 + 榜单);
 * 「问题信号」在前端按阈值(INSIGHT)自动生成,红的先看;图表用零依赖 mini-chart,一图一轴不做双轴。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { dramaApi, CHART_PALETTE, PAY_MODE_LABEL, SESSION_STATE_LABEL, REPORT_STATUS_LABEL, CHARGE_TYPE_LABEL, VIS_LABEL, VIS_TAG } from '@/utils/drama'
import MiniChart from './mini-chart.vue'
import ScriptDrawer from './script-drawer.vue'

const C = CHART_PALETTE
const PRESETS = [
    { key: 'today', label: '今天' }, { key: 'yesterday', label: '昨天' }, { key: '3d', label: '近3天' },
    { key: '7d', label: '近7天' }, { key: '30d', label: '近30天' },
]
/* 问题信号阈值(体验版小样本先松一点;样本够了再收) */
const INSIGHT = { minCreate: 3, deadRate: 0.2, failRate: 0.5, minSessions: 5, settleRate: 0.3, abandonRate: 0.5, feError: 3 }

const preset = ref('today')
const range = ref(null)
const defaultTime = [new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)]
const d = ref(null)
const err = ref('')
const loading = ref(false)
const lastUpdate = ref('')
const autoRefresh = ref(false)
const drawerRef = ref(null)
let timer = null

/** 预设 → [from, to] 毫秒 */
const spanOf = () => {
    const now = dayjs()
    switch (preset.value) {
        case 'yesterday': return [now.subtract(1, 'day').startOf('day').valueOf(), now.subtract(1, 'day').endOf('day').valueOf()]
        case '3d': return [now.subtract(2, 'day').startOf('day').valueOf(), now.valueOf()]
        case '7d': return [now.subtract(6, 'day').startOf('day').valueOf(), now.valueOf()]
        case '30d': return [now.subtract(29, 'day').startOf('day').valueOf(), now.valueOf()]
        case 'custom': return range.value && range.value.length === 2 ? [new Date(range.value[0]).getTime(), new Date(range.value[1]).getTime()] : [now.startOf('day').valueOf(), now.valueOf()]
        default: return [now.startOf('day').valueOf(), now.valueOf()]
    }
}
const fmtRange = computed(() => (d.value ? `${dayjs(d.value.from).format('MM-DD HH:mm')} ~ ${dayjs(d.value.to).format('MM-DD HH:mm')}` : ''))

const load = async () => {
    const [from, to] = spanOf()
    loading.value = true
    const r = await dramaApi('overview', { from, to })
    loading.value = false
    if (!r || r.errMsg) { err.value = (r && r.errMsg) || '加载失败'; d.value = null; return ElMessage.error(err.value) }
    d.value = r.data
    lastUpdate.value = dayjs().format('HH:mm:ss')
}
const onPreset = () => { range.value = null; load() }
const onCustom = (v) => { if (v && v.length === 2) { preset.value = 'custom'; load() } }
const onAuto = (on) => { if (timer) { clearInterval(timer); timer = null }; if (on) timer = setInterval(load, 60000) }

const pct = (r) => (r >= 9 ? '∞' : Math.round((Number(r) || 0) * 1000) / 10 + '%')
const toneRate = (rate, n, th, lowIsBad) => (n < INSIGHT.minSessions ? '' : (lowIsBad ? (rate < th ? 'warn' : 'ok') : (rate > th ? 'warn' : 'ok')))
const errTotal = computed(() => (d.value ? Object.values(d.value.quality.errors).reduce((a, b) => a + b, 0) : 0))
const anyTruncated = computed(() => (d.value ? Object.values(d.value.truncated || {}).some(Boolean) : false))

/* 趋势 */
const labels = computed(() => (d.value ? d.value.series.map((b) => (d.value.bucket === 'hour' ? b.label.slice(6) : b.label)) : []))
const pick = (k) => (d.value ? d.value.series.map((b) => b[k] || 0) : [])

/* 分布 */
const toItems = (obj, labelOf, order) => {
    const keys = order ? order.filter((k) => obj[k] != null).concat(Object.keys(obj).filter((k) => !order.includes(k))) : Object.keys(obj)
    return keys.map((k) => ({ label: labelOf ? (labelOf[k] || k) : k, value: Number(obj[k]) || 0 })).filter((it) => it.value > 0).sort((a, b) => b.value - a.value)
}
const byModeItems = computed(() => (d.value ? toItems(d.value.play.by_mode, { ...PAY_MODE_LABEL, unknown: '未知' }) : []))
const stateItems = computed(() => (d.value ? toItems({ playing: d.value.play.playing, settled: d.value.play.settled, abandoned: d.value.play.abandoned, other: d.value.play.other }, { ...SESSION_STATE_LABEL, other: '其他' }) : []))
const auditItems = computed(() => {
    if (!d.value) return []
    const c = d.value.create
    return toItems({ 公开: c.public, 不合规: c.ai_fail, 'AI 未判': c.ai_pending, 合规但私有: Math.max(0, c.private - c.ai_fail - c.ai_pending) })
})
const rarityItems = computed(() => (d.value ? toItems(d.value.endings.by_rarity, null, ['常规', '稀有', '隐藏']) : []))
const chargeItems = computed(() => (d.value ? toItems(d.value.money.by_type, CHARGE_TYPE_LABEL) : []))
const feKindItems = computed(() => (d.value ? toItems(d.value.quality.fe_kinds, { voice_play: '语音播放', js: 'JS 报错', turn_fail: '一轮失败', enter: '进场失败', other: '其他' }) : []))

/* 问题信号(红的先看;没问题给一条绿的) */
const insights = computed(() => {
    if (!d.value) return []
    const o = d.value; const out = []
    const push = (type, text) => out.push({ type, text })
    if (o.now.reports_pending > 0) push('error', `${o.now.reports_pending} 条举报待处理`)
    if (o.money.warn) push('error', `发放 ${o.money.grant} 贝 / 净实收 ${o.money.net} 贝 = ${pct(o.money.ratio)}，超过 50% 护栏`)
    if (o.create.n >= INSIGHT.minCreate && o.create.dead_rate >= INSIGHT.deadRate) push('error', `执笔判死率 ${pct(o.create.dead_rate)}（${o.create.dead}/${o.create.n}），生成链路不稳`)
    if (o.quality.errors.fe_error >= INSIGHT.feError) push('error', `前端异常 ${o.quality.errors.fe_error} 次（${Object.entries(o.quality.fe_kinds).map(([k, v]) => `${{ voice_play: '语音播放', js: 'JS', turn_fail: '一轮失败', enter: '进场' }[k] || k} ${v}`).join('、')}），去「错误」看现场`)
    else if (o.quality.errors.fe_error > 0) push('warning', `前端异常 ${o.quality.errors.fe_error} 次`)
    if (o.quality.errors.create_wait_fail > 0) push('warning', `创建等待失败 ${o.quality.errors.create_wait_fail} 次（用户等不到本子）`)
    if (o.create.delivered >= INSIGHT.minCreate && o.create.fail_rate >= INSIGHT.failRate) push('warning', `AI 初审不合规率 ${pct(o.create.fail_rate)}，自由本尺度偏高或审核偏严`)
    if (o.play.sessions >= INSIGHT.minSessions && o.play.settle_rate < INSIGHT.settleRate) push('warning', `完局率只有 ${pct(o.play.settle_rate)}，多数局没走到结局`)
    if (o.play.sessions >= INSIGHT.minSessions && o.play.abandon_rate >= INSIGHT.abandonRate) push('warning', `弃局率 ${pct(o.play.abandon_rate)}`)
    if (o.quality.reports > 0) push('warning', `这段时间新增 ${o.quality.reports} 条举报`)
    const bad = out.length
    /* 亮点 */
    if (o.play.sessions >= INSIGHT.minSessions && o.play.paid_share >= 0.5) push('success', `付费局占比 ${pct(o.play.paid_share)}`)
    if (o.endings.unlocks > 0 && (o.endings.by_rarity['稀有'] || o.endings.by_rarity['隐藏'])) push('success', `解锁了 ${o.endings.by_rarity['稀有'] || 0} 个稀有、${o.endings.by_rarity['隐藏'] || 0} 个隐藏结局`)
    if (o.hot.length && o.hot[0].sessions >= 3) push('info', `最热的本《${o.hot[0].title}》${o.hot[0].sessions} 局 ${o.hot[0].players} 人`)
    if (!bad) out.unshift({ type: 'success', text: '这段时间没有异常信号' })
    return out
})

const openDrawer = (id) => id && drawerRef.value && drawerRef.value.open(id)

onMounted(load)
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style lang="scss" scoped>
.ov {
    .filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;
        .upd { font-size: 12px; color: #909399; }
        .hint { font-size: 12px; color: #c0c4cc; }
    }
    .sec-tt { font-size: 14px; font-weight: 600; color: #303133; margin: 14px 0 8px; display: flex; align-items: baseline; gap: 8px;
        .sub { font-size: 12px; font-weight: 400; color: #c0c4cc; }
    }
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;
        .tile { background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 14px 16px;
            .tv { font-size: 28px; font-weight: 700; color: #303133; font-variant-numeric: tabular-nums; line-height: 1.1; i { font-style: normal; font-size: 16px; color: #909399; font-weight: 500; } }
            .tl { font-size: 13px; color: #606266; margin-top: 6px; }
            .ts { font-size: 12px; color: #909399; margin-top: 2px; }
            &.bad { border-color: #f56c6c; background: #fef0f0; .tv { color: #f56c6c; } }
            &.ok .tv { color: #67c23a; }
        }
    }
    .insights { display: flex; flex-direction: column; gap: 6px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
        .kpi { background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 12px 14px;
            .kv { font-size: 24px; font-weight: 700; color: #303133; font-variant-numeric: tabular-nums; line-height: 1.1; i { font-style: normal; font-size: 13px; color: #909399; font-weight: 500; } }
            .kl { font-size: 13px; color: #606266; margin-top: 4px; }
            .ks { font-size: 12px; color: #909399; margin-top: 2px; line-height: 1.5; }
            &.bad { border-color: #f56c6c; .kv { color: #f56c6c; } }
            &.warn { border-color: #e6a23c; .kv { color: #e6a23c; } }
            &.ok .kv { color: #67c23a; }
        }
    }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px;
        &.two { grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); }
        .card { background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 12px 14px; min-width: 0; }
        .card-tt { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px; }
    }
    .tt { font-size: 13px; color: #303133; &.link { cursor: pointer; &:hover { color: #409eff; } } }
    .muted { font-size: 12px; color: #c0c4cc; text-align: center; padding: 8px 0; }
}
</style>
