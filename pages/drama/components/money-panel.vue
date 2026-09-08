<template>
    <div v-loading="loading" class="mp">
        <div class="filters">
            <el-radio-group v-model="days" @change="load">
                <el-radio-button :value="7">近 7 天</el-radio-button>
                <el-radio-button :value="14">近 14 天</el-radio-button>
                <el-radio-button :value="30">近 30 天</el-radio-button>
            </el-radio-group>
            <el-button type="primary" @click="load">🔄 刷新</el-button>
            <span class="hint">口径:drama_reward_log(钱账权威)按北京日汇总;发放 ≤ 净实收 50% 为不变式,超了标红;右侧「日报参照」来自 drama_stats(05:00 定时聚合昨日)</span>
        </div>

        <!-- 护栏与合计 -->
        <el-alert v-if="total.warn" type="error" show-icon :closable="false" style="margin-bottom: 12px;"
            :title="`护栏红了:近 ${days} 天发放 ${total.grant} 贝 / 净实收 ${total.net} 贝 = ${pct(total.ratio)}，超过 50%`" />
        <el-alert v-else-if="loaded" type="success" show-icon :closable="false" style="margin-bottom: 12px;"
            :title="`护栏正常:近 ${days} 天发放 ${total.grant} 贝 / 净实收 ${total.net} 贝 = ${pct(total.ratio)}`" />
        <el-alert v-if="truncated" type="warning" show-icon :closable="false" style="margin-bottom: 12px;" title="流水超过 2 万条被截断,数字偏小——该给 drama_reward_log 加 create_time 索引并缩小回看天数了" />

        <div class="kpis">
            <div class="kpi"><div class="kv">{{ total.income }}</div><div class="kl">实收（贝）</div></div>
            <div class="kpi"><div class="kv">{{ total.refund }}</div><div class="kl">退款（贝）</div></div>
            <div class="kpi ok"><div class="kv">{{ total.net }}</div><div class="kl">净实收（贝）</div></div>
            <div class="kpi" :class="total.warn ? 'bad' : ''"><div class="kv">{{ total.grant }}</div><div class="kl">发放（贝）</div></div>
            <div class="kpi" :class="total.warn ? 'bad' : ''"><div class="kv">{{ pct(total.ratio) }}</div><div class="kl">发放 / 净实收</div></div>
            <div class="kpi"><div class="kv">{{ total.n_charge }} / {{ total.n_grant }}</div><div class="kl">扣费笔数 / 发放笔数</div></div>
        </div>

        <el-table :data="rows" border size="small" :row-class-name="rowClass">
            <el-table-column prop="day" label="日期" width="110" align="center">
                <template #default="{ row }"><b>{{ row.day }}</b><div v-if="row.day === today" class="muted">今天（实时）</div></template>
            </el-table-column>
            <el-table-column prop="income" label="实收" width="80" align="center" />
            <el-table-column prop="refund" label="退款" width="70" align="center">
                <template #default="{ row }"><span :class="row.refund ? 'warn-txt' : 'muted'">{{ row.refund }}</span></template>
            </el-table-column>
            <el-table-column prop="net" label="净实收" width="80" align="center"><template #default="{ row }"><b>{{ row.net }}</b></template></el-table-column>
            <el-table-column prop="grant" label="发放" width="70" align="center" />
            <el-table-column label="发放/净实收" width="110" align="center">
                <template #default="{ row }">
                    <el-tag v-if="row.grant || row.net" size="small" :type="row.warn ? 'danger' : 'success'" :effect="row.warn ? 'dark' : 'plain'">{{ pct(row.ratio) }}</el-tag>
                    <span v-else class="muted">—</span>
                </template>
            </el-table-column>
            <el-table-column label="笔数(扣/退/发)" width="120" align="center">
                <template #default="{ row }"><span class="nums muted">{{ row.n_charge }} / {{ row.n_refund }} / {{ row.n_grant }}</span></template>
            </el-table-column>
            <el-table-column label="日报参照（drama_stats）" min-width="320">
                <template #default="{ row }">
                    <template v-if="row.stats">
                        <span class="nums">收 {{ row.stats.econ ? row.stats.econ.income : '—' }} · 发 {{ row.stats.econ ? row.stats.econ.grant : '—' }} · 开局 {{ row.stats.starts_n }} · 完局 {{ row.stats.settles_n }}</span>
                        <div v-for="(a, i) in row.stats.alerts" :key="i" class="alert-line">⚠ {{ a }}</div>
                    </template>
                    <span v-else class="muted">{{ row.day === today ? '今日日报明早 05:00 生成' : '无日报（定时器未跑或当天无事件）' }}</span>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<script setup>
/**
 * 钱账日报面板(④ 一期):近 N 天「实收 / 退款 / 净实收 / 发放」+ 不变式「发放 ≤ 净实收 50%」,红了才醒目。
 * 数据经 drama-admin.dailyMoney(reward_log 日汇总 + drama_stats 参照),不扫 events 明细。
 */
import { ref, reactive, onMounted } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { dramaApi } from '@/utils/drama'

const days = ref(7)
const rows = ref([])
const total = reactive({ income: 0, refund: 0, net: 0, grant: 0, ratio: 0, warn: false, n_charge: 0, n_refund: 0, n_grant: 0 })
const truncated = ref(false)
const loading = ref(false)
const loaded = ref(false)
const today = dayjs().format('YYYY-MM-DD')

const pct = (r) => (r >= 9 ? '∞' : Math.round((Number(r) || 0) * 1000) / 10 + '%')
const rowClass = ({ row }) => (row.warn ? 'row-warn' : '')

const load = async () => {
    loading.value = true
    const r = await dramaApi('dailyMoney', { days: days.value })
    loading.value = false
    if (!r || r.errMsg) { rows.value = []; return ElMessage.error((r && r.errMsg) || '加载失败') }
    rows.value = r.data.rows || []
    Object.assign(total, r.data.total || {})
    truncated.value = !!r.data.truncated
    loaded.value = true
}

onMounted(load)
</script>

<style lang="scss" scoped>
.mp {
    .filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;
        .hint { font-size: 12px; color: #c0c4cc; }
    }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 14px;
        .kpi { background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 14px; text-align: center;
            .kv { font-size: 24px; font-weight: 700; color: #303133; font-variant-numeric: tabular-nums; }
            .kl { font-size: 12px; color: #909399; margin-top: 4px; }
            &.ok .kv { color: #67c23a; }
            &.bad { border-color: #f56c6c; background: #fef0f0; .kv { color: #f56c6c; } }
        }
    }
    .muted { font-size: 12px; color: #909399; }
    .warn-txt { color: #e6a23c; }
    .nums { font-size: 12px; font-variant-numeric: tabular-nums; }
    .alert-line { font-size: 12px; color: #f56c6c; margin-top: 2px; }
    :deep(.row-warn) td { background: #fef0f0 !important; }
}
</style>
