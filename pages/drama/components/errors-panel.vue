<template>
    <div v-loading="loading" class="ep">
        <div class="filters">
            <div class="fr">
                <span class="fl">时间</span>
                <!-- 不用 value-format="x":element-plus 2.7 把字符串毫秒初值按 'x' 解析会显示成 1794 年(09-08 实测),模型直接用 Date -->
                <el-date-picker v-model="range" type="datetimerange" :shortcuts="shortcuts" :default-time="defaultTime" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width: 380px;" @change="reload" />
                <span class="fl" style="margin-left: 16px;">类型</span>
                <el-checkbox-group v-model="evs" @change="reload">
                    <el-checkbox v-for="e in ALL_EVS" :key="e" :value="e">{{ EV_LABEL[e] }}</el-checkbox>
                </el-checkbox-group>
            </div>
            <div class="fr">
                <el-switch v-model="autoRefresh" inline-prompt active-text="自动" inactive-text="手动" @change="onAuto" />
                <el-button type="primary" @click="reload">🔄 刷新</el-button>
                <span v-if="lastUpdate" class="upd">更新于 {{ lastUpdate }}</span>
                <span class="hint">最长回看 31 天;full 档现在全记,切 lite 后这三类仍在白名单不会断</span>
            </div>
        </div>

        <el-table :data="list" size="small" :row-class-name="rowClass" style="width: 100%;">
            <el-table-column type="expand">
                <template #default="{ row }">
                    <pre class="raw">{{ pretty(row.data) }}</pre>
                </template>
            </el-table-column>
            <el-table-column label="时间" width="130" align="center">
                <template #default="{ row }"><span class="nums">{{ fmt(row.t) }}</span></template>
            </el-table-column>
            <el-table-column label="事件" width="120" align="center">
                <template #default="{ row }">
                    <el-tag :type="EV_TAG[row.ev] || 'info'" size="small">{{ EV_LABEL[row.ev] || row.ev }}</el-tag>
                    <div class="muted">{{ row.src }}</div>
                </template>
            </el-table-column>
            <el-table-column label="用户" width="150">
                <template #default="{ row }">
                    <div class="who">
                        <el-avatar :size="22" :src="row.user.avatar || undefined">{{ (row.user.nickname || '?').slice(0, 1) }}</el-avatar>
                        <span class="who-n">{{ row.user.nickname || '(无昵称)' }}</span>
                        <id-copy :id="row.user._id" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="局 / 本" width="96" align="center">
                <template #default="{ row }">
                    <div class="idrow"><id-copy :id="row.session_id" label="局" /></div>
                    <div class="idrow"><id-copy :id="row.script_id" label="本" /></div>
                </template>
            </el-table-column>
            <el-table-column label="摘要" min-width="320">
                <template #default="{ row }">
                    <div class="sum">
                        <el-tag v-for="(v, k) in summary(row.data)" :key="k" size="small" type="info" effect="plain" class="kv">{{ k }}={{ v }}</el-tag>
                    </div>
                    <el-text v-if="row.data && row.data.trail" :line-clamp="2" size="small" class="trail">{{ row.data.trail }}</el-text>
                </template>
            </el-table-column>
        </el-table>
        <el-empty v-if="!loading && !list.length" description="这段时间没有这些错误" />

        <div class="pagination">
            <el-pagination v-model:currentPage="page" v-model:page-size="size" :total="total" :page-sizes="[20, 50]" layout="total, sizes, prev, pager, next" small @size-change="load(1)" @current-change="load()" />
        </div>
    </div>
</template>

<script setup>
/**
 * 错误面板(⑥ 一期):fe_error / gen_dead / create_wait_fail(+ bgm_error)实时列表,线上抓 bug 第一现场。
 * 默认最近 24h;展开行看 data 原文;30s 自动刷新可开。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { dramaApi, EV_LABEL, EV_TAG } from '@/utils/drama'
import IdCopy from './id-copy.vue'

const ALL_EVS = ['fe_error', 'gen_dead', 'create_wait_fail', 'bgm_error']
const SUMMARY_KEYS = ['kind', 'where', 'why', 'reason', 'msg', 'spec', 'ms', 'src', 'diag'] // 摘要抓这些常见键,其余展开看

/** 时间区间 [Date, Date](默认最近 24h);清空 = 云端按最近 24h 兜底 */
const last24h = () => [dayjs().subtract(24, 'hour').toDate(), new Date()]
const range = ref(last24h())
const defaultTime = [new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)]
const shortcuts = [
    { text: '最近1小时', value: () => [dayjs().subtract(1, 'hour').toDate(), new Date()] },
    { text: '最近24小时', value: () => [dayjs().subtract(24, 'hour').toDate(), new Date()] },
    { text: '近3天', value: () => [dayjs().subtract(3, 'day').toDate(), new Date()] },
    { text: '近7天', value: () => [dayjs().subtract(7, 'day').toDate(), new Date()] },
    { text: '近30天', value: () => [dayjs().subtract(30, 'day').toDate(), new Date()] },
]
const evs = ref(['fe_error', 'gen_dead', 'create_wait_fail'])
const page = ref(1)
const size = ref(20)
const total = ref(0)
const list = ref([])
const loading = ref(false)
const lastUpdate = ref('')
const autoRefresh = ref(false)
let timer = null

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm:ss') : '—')
const pretty = (d) => { try { return JSON.stringify(d || {}, null, 2) } catch (e) { return String(d) } }
const summary = (d) => {
    const out = {}
    for (const k of SUMMARY_KEYS) if (d && d[k] !== undefined && d[k] !== '') out[k] = String(d[k]).slice(0, 80)
    return out
}
const rowClass = ({ row }) => (row.ev === 'fe_error' ? 'row-err' : '')

const load = async (p) => {
    if (p) page.value = p
    if (!evs.value.length) { list.value = []; total.value = 0; return }
    loading.value = true
    const params = { evs: evs.value, page: page.value, size: size.value }
    if (range.value && range.value.length === 2) { params.from = new Date(range.value[0]).getTime(); params.to = new Date(range.value[1]).getTime() }
    const r = await dramaApi('listErrors', params)
    loading.value = false
    if (!r || r.errMsg) { list.value = []; return ElMessage.error((r && r.errMsg) || '加载失败') }
    list.value = r.data.list || []
    total.value = r.data.total || 0
    lastUpdate.value = dayjs().format('HH:mm:ss')
}
const reload = () => load(1)
const onAuto = (on) => {
    if (timer) { clearInterval(timer); timer = null }
    if (on) timer = setInterval(() => { range.value = last24h(); load(1) }, 30000)
}

onMounted(() => load(1))
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style lang="scss" scoped>
.ep {
    .filters { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px;
        .fr { display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
            & + .fr { margin-top: 10px; }
            .fl { font-size: 13px; color: #606266; margin-right: 6px; }
            .upd { font-size: 12px; color: #909399; }
            .hint { font-size: 12px; color: #c0c4cc; }
        }
    }
    .who { display: flex; align-items: center; gap: 4px; font-size: 13px;
        .who-n { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    .idrow { line-height: 1.4; }
    .muted { font-size: 12px; color: #909399; }
    .nums { font-size: 12px; font-variant-numeric: tabular-nums; }
    .sum { display: flex; flex-wrap: wrap; gap: 4px; .kv { max-width: 100%; } }
    .trail { display: block; margin-top: 4px; color: #909399; font-family: monospace; font-size: 11px; }
    .raw { margin: 0; padding: 8px 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; background: #f5f7fa; border-radius: 4px; max-height: 360px; overflow: auto; }
    :deep(.row-err) td { background: #fef0f0 !important; }
}
</style>
