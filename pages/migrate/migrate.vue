<template>
    <el-scrollbar v-loading="loading" class="migrate page">
        <!-- 顶部：标题 + 刷新 + 自动刷新 -->
        <div class="hd">
            <div class="hd-l">
                <span class="tt">聊天迁移监控</span>
                <el-tag size="small" type="info" effect="plain">灰度期看搬迁成功率 · 失败定位</el-tag>
            </div>
            <div class="hd-r">
                <span class="upd" v-if="lastUpdate">更新于 {{ lastUpdate }}</span>
                <el-switch v-model="autoRefresh" inline-prompt active-text="自动" inactive-text="手动" @change="onAutoChange" />
                <el-button type="primary" @click="loadAll">🔄 刷新</el-button>
            </div>
        </div>

        <!-- 筛选区 -->
        <div class="filters">
            <div class="fr">
                <span class="fl">时间</span>
                <el-date-picker
                    v-model="timeRange"
                    type="datetimerange"
                    :shortcuts="timeShortcuts"
                    :default-time="defaultTime"
                    range-separator="至"
                    start-placeholder="开始时间"
                    end-placeholder="结束时间"
                    value-format="x"
                    clearable
                    style="width: 400px;"
                    @change="loadAll"
                />
                <span class="fl" style="margin-left: 10px; color: #c0c4cc;">清空 = 全部时间</span>
            </div>
            <div class="fr">
                <span class="fl">状态</span>
                <el-radio-group v-model="status" @change="loadAll">
                    <el-radio-button value="all">全部</el-radio-button>
                    <el-radio-button value="need">需搬迁</el-radio-button>
                    <el-radio-button value="success">已成功</el-radio-button>
                    <el-radio-button value="fail">失败</el-radio-button>
                </el-radio-group>
                <span class="fl" style="margin-left:24px;">环境</span>
                <el-select v-model="env" style="width:150px;" @change="loadAll">
                    <el-option label="全部环境" value="" />
                    <el-option label="正式版 release" value="release" />
                    <el-option label="体验版 trial" value="trial" />
                    <el-option label="开发版 develop" value="develop" />
                </el-select>
            </div>
        </div>

        <!-- 成功率总览面板 -->
        <div class="panel">
            <div class="rate-card" :class="rateClass">
                <div class="rate-num">{{ summary.rate }}</div>
                <div class="rate-lb">搬迁成功率</div>
                <div class="rate-sub">成功 {{ summary.ok }} / 需搬迁 {{ summary.need }}</div>
            </div>
            <div class="kpis">
                <div class="kpi"><div class="kv">{{ summary.users }}</div><div class="kl">上报用户</div></div>
                <div class="kpi"><div class="kv">{{ summary.need }}</div><div class="kl">需搬迁（有旧数据）</div></div>
                <div class="kpi ok"><div class="kv">{{ summary.ok }}</div><div class="kl">已成功</div></div>
                <div class="kpi fail"><div class="kv">{{ summary.fail }}</div><div class="kl">失败（待重试）</div></div>
                <div class="kpi"><div class="kv">{{ summary.users - summary.need }}</div><div class="kl">新用户（无旧数据）</div></div>
            </div>
        </div>

        <!-- 分版本/环境明细（stats） -->
        <div class="sub-tt">按版本 · 环境（{{ statsRows.length }}）</div>
        <el-table :data="statsRows" border size="small" style="margin-bottom:16px;">
            <el-table-column prop="version" label="版本" align="center" min-width="90">
                <template #default="{ row }"><span>{{ row.version || '(未知)' }}</span></template>
            </el-table-column>
            <el-table-column prop="env" label="环境" align="center" min-width="90">
                <template #default="{ row }"><el-tag size="small" :type="envTag(row.env)">{{ row.env || '—' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="users" label="上报用户" align="center" min-width="80" />
            <el-table-column prop="need" label="需搬迁" align="center" min-width="80" />
            <el-table-column prop="ok" label="成功" align="center" min-width="70" />
            <el-table-column prop="fail" label="失败" align="center" min-width="70">
                <template #default="{ row }"><span :style="{ color: row.fail ? '#f56c6c' : '' }">{{ row.fail }}</span></template>
            </el-table-column>
            <el-table-column prop="rate" label="成功率" align="center" min-width="90">
                <template #default="{ row }">
                    <el-tag size="small" :type="rateTag(row.rate)">{{ row.rate }}</el-tag>
                </template>
            </el-table-column>
        </el-table>

        <!-- 用户明细（recent） -->
        <div class="sub-tt">
            用户明细（{{ list.length }}{{ list.length >= limit ? '，达上限' : '' }}）
            <el-select v-model="limit" size="small" style="width:110px;margin-left:8px;" @change="loadList">
                <el-option :value="50" label="显示 50" />
                <el-option :value="100" label="显示 100" />
                <el-option :value="200" label="显示 200" />
            </el-select>
        </div>
        <el-table :data="list" border size="small">
            <el-table-column label="用户/环境" align="center" min-width="150">
                <template #default="{ row }">
                    <div class="cell-uid">
                        <el-tag size="small" :type="envTag(row.env)" effect="plain">{{ row.env || '—' }}</el-tag>
                        <span class="ver">{{ row.app_version || '无版本号' }}</span>
                        <el-button link type="primary" size="small" @click="copyId(row.uid)">{{ shortId(row.uid) }}</el-button>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="结果" align="center" min-width="90">
                <template #default="{ row }">
                    <el-tag v-if="row.total === 0" size="small" type="info">新用户</el-tag>
                    <el-tag v-else-if="row.done" size="small" type="success">已搬完</el-tag>
                    <el-tag v-else size="small" type="danger">未完成</el-tag>
                </template>
            </el-table-column>
            <el-table-column label="旧包/迁移/回流/跳过/失败" align="center" min-width="170">
                <template #default="{ row }">
                    <span class="nums">
                        {{ row.total }} /
                        <b style="color:#67c23a;">{{ row.migrated }}</b> /
                        <b style="color:#409eff;">{{ row.updated }}</b> /
                        {{ row.skipped }} /
                        <b :style="{ color: row.failed ? '#f56c6c' : '#909399' }">{{ row.failed }}</b>
                    </span>
                </template>
            </el-table-column>
            <el-table-column prop="fail_reason" label="失败原因" align="left" min-width="220">
                <template #default="{ row }">
                    <el-text v-if="row.fail_reason" type="danger" size="small" :line-clamp="2">{{ row.fail_reason }}</el-text>
                    <span v-else style="color:#c0c4cc;">—</span>
                </template>
            </el-table-column>
            <el-table-column prop="model" label="机型/系统" align="center" min-width="130">
                <template #default="{ row }">
                    <div style="font-size:12px;line-height:1.5;">
                        <div>{{ row.model || '—' }}</div>
                        <div style="color:#909399;">{{ row.system || '' }}</div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="attempts" label="上报次数" align="center" min-width="70" />
            <el-table-column prop="update_date" label="最近上报" align="center" min-width="130" :formatter="(e) => e.update_date ? dayjs(e.update_date).format('MM-DD HH:mm:ss') : ''" />
        </el-table>

        <el-empty v-if="!loading && !list.length" description="该筛选条件下暂无上报数据" />
    </el-scrollbar>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

/* 与 talk-ai/chat-migrate/config.js 的 statsKey 一致（后台专用只读口令；本页仅 xiaoli 可进） */
const STATS_KEY = 'cl-migrate-stats-2026'
const MigrateCloud = uniCloud.importObject('chat-migrate', { customUI: true })

const loading = ref(false)
const lastUpdate = ref('')
const autoRefresh = ref(false)
let timer = null

/* 筛选态 */
/* 时间区间 [fromMs, toMs]（value-format=x 为字符串毫秒）；默认今天 00:00:00 ~ 23:59:59；清空=全部 */
const timeRange = ref([String(dayjs().startOf('day').valueOf()), String(dayjs().endOf('day').valueOf())])
/* 手动选日期时的默认时间：开始 00:00:00、结束 23:59:59 */
const defaultTime = [new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)]
/* 预设收进日期组件的快捷面板（中文） */
const timeShortcuts = [
    { text: '最近5分钟', value: () => [dayjs().subtract(5, 'minute').toDate(), new Date()] },
    { text: '最近1小时', value: () => [dayjs().subtract(1, 'hour').toDate(), new Date()] },
    { text: '最近3小时', value: () => [dayjs().subtract(3, 'hour').toDate(), new Date()] },
    { text: '今天', value: () => [dayjs().startOf('day').toDate(), dayjs().endOf('day').toDate()] },
    { text: '近7天', value: () => [dayjs().subtract(6, 'day').startOf('day').toDate(), dayjs().endOf('day').toDate()] }
]
const status = ref('all')          // all/need/success/fail
const env = ref('')                // ''/release/trial/develop
const limit = ref(50)

const statsRows = ref([])
const list = ref([])

/* 把时间区间翻译成云对象入参：有区间→fromMs/toMs，清空→不限时间 */
const buildTimeParams = () => {
    if (timeRange.value && timeRange.value.length === 2) {
        return { fromMs: Number(timeRange.value[0]), toMs: Number(timeRange.value[1]) }
    }
    return {}
}

const baseParams = () => ({ key: STATS_KEY, ...buildTimeParams(), env: env.value })

/* 汇总面板：按当前环境筛选后合计 stats 行 */
const summary = computed(() => {
    const rows = statsRows.value
    const s = rows.reduce((a, r) => {
        a.users += r.users; a.need += r.need; a.ok += r.ok; a.fail += r.fail; return a
    }, { users: 0, need: 0, ok: 0, fail: 0 })
    s.rate = s.need ? (Math.round(s.ok / s.need * 1000) / 10) + '%' : '—'
    return s
})
const rateClass = computed(() => {
    if (!summary.value.need) return 'r-none'
    const v = summary.value.ok / summary.value.need
    return v >= 0.95 ? 'r-good' : (v >= 0.8 ? 'r-warn' : 'r-bad')
})

const rateTag = (rate) => {
    if (!rate || rate === '—') return 'info'
    const v = parseFloat(rate)
    return v >= 95 ? 'success' : (v >= 80 ? 'warning' : 'danger')
}
const envTag = (e) => ({ release: 'success', trial: 'warning', develop: 'info' }[e] || 'info')
const shortId = (id) => id ? (String(id).slice(-6)) : '—'

const copyId = async (text) => {
    if (!text) return
    const ok = await copyText(text).catch(() => false)
    ElMessage[ok ? 'success' : 'error'](ok ? '已复制 uid' : '复制失败')
}

const loadStats = async () => {
    const r = await MigrateCloud.stats(baseParams()).catch((e) => ({ errMsg: e && e.message }))
    if (r && r.errMsg === 'ok') {
        /* 环境筛选：stats 后端按 版本+环境 分组，这里按选中环境过滤展示 */
        statsRows.value = (r.data || []).filter(row => !env.value || row.env === env.value)
    } else {
        statsRows.value = []
        if (r && r.errMsg === 'forbidden') ElMessage.error('口令无效（statsKey 不匹配）')
    }
}

const loadList = async () => {
    const r = await MigrateCloud.recent({ ...baseParams(), status: status.value, limit: limit.value }).catch((e) => ({ errMsg: e && e.message }))
    list.value = (r && r.errMsg === 'ok') ? (r.data || []) : []
}

const loadAll = async () => {
    loading.value = true
    await Promise.all([loadStats(), loadList()])
    loading.value = false
    lastUpdate.value = dayjs().format('HH:mm:ss')
}

const onAutoChange = (on) => {
    if (timer) { clearInterval(timer); timer = null }
    if (on) timer = setInterval(loadAll, 30000)  // 30s 自动刷新
}

onMounted(loadAll)
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style lang="scss" scoped>
.migrate {
    .hd {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        .hd-l { display: flex; align-items: center; gap: 10px;
            .tt { font-size: 18px; font-weight: 700; }
        }
        .hd-r { display: flex; align-items: center; gap: 12px;
            .upd { font-size: 12px; color: #909399; }
        }
    }

    .filters {
        background: #fff;
        border: 1px solid #ebeef5;
        border-radius: 8px;
        padding: 14px 16px;
        margin-bottom: 14px;
        .fr { display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
            & + .fr { margin-top: 12px; }
            .fl { font-size: 13px; color: #606266; margin-right: 6px; }
        }
    }

    .panel {
        display: flex;
        gap: 16px;
        margin-bottom: 18px;
        flex-wrap: wrap;
        .rate-card {
            flex: 0 0 200px;
            border-radius: 12px;
            padding: 18px;
            color: #fff;
            text-align: center;
            &.r-good { background: linear-gradient(135deg, #34d399, #059669); }
            &.r-warn { background: linear-gradient(135deg, #fbbf24, #d97706); }
            &.r-bad  { background: linear-gradient(135deg, #f87171, #dc2626); }
            &.r-none { background: linear-gradient(135deg, #cbd5e1, #94a3b8); }
            .rate-num { font-size: 40px; font-weight: 800; line-height: 1.1; }
            .rate-lb { font-size: 14px; margin-top: 6px; opacity: .95; }
            .rate-sub { font-size: 12px; margin-top: 8px; opacity: .85; }
        }
        .kpis {
            flex: 1;
            min-width: 300px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            .kpi {
                background: #fff;
                border: 1px solid #ebeef5;
                border-radius: 10px;
                padding: 14px;
                text-align: center;
                .kv { font-size: 26px; font-weight: 700; color: #303133; }
                .kl { font-size: 12px; color: #909399; margin-top: 4px; }
                &.ok .kv { color: #67c23a; }
                &.fail .kv { color: #f56c6c; }
            }
        }
    }

    .sub-tt { font-size: 14px; font-weight: 600; color: #303133; margin: 6px 0 10px; display: flex; align-items: center; }
    .cell-uid { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;
        .ver { font-size: 12px; color: #606266; }
    }
    .nums { font-size: 13px; font-variant-numeric: tabular-nums; }
}
</style>
