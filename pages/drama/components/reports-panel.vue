<template>
    <div v-loading="loading" class="rp">
        <div class="filters">
            <el-radio-group v-model="status" @change="reload">
                <el-radio-button value="pending">待处理<span v-if="counts.pending != null">（{{ counts.pending }}）</span></el-radio-button>
                <el-radio-button value="handled">已处理<span v-if="counts.handled != null">（{{ counts.handled }}）</span></el-radio-button>
                <el-radio-button value="dismissed">已驳回<span v-if="counts.dismissed != null">（{{ counts.dismissed }}）</span></el-radio-button>
                <el-radio-button value="all">全部</el-radio-button>
            </el-radio-group>
            <el-button type="primary" @click="reload">🔄 刷新</el-button>
            <span class="hint">转私 = 本记不合规转私有 + 同本其余待处理举报一并归档;驳回 = 举报不成立,本不动</span>
        </div>

        <el-table :data="list" size="small" stripe style="width: 100%;">
            <el-table-column label="举报时间" min-width="100" align="center">
                <template #default="{ row }"><span class="muted">{{ fmt(row.create_time) }}</span></template>
            </el-table-column>
            <el-table-column label="举报人" min-width="150">
                <template #default="{ row }">
                    <div class="who">
                        <el-avatar :size="22" :src="row.reporter.avatar || undefined">{{ (row.reporter.nickname || '?').slice(0, 1) }}</el-avatar>
                        <span class="who-n">{{ row.reporter.nickname || '(无昵称)' }}</span>
                        <id-copy :id="row.reporter._id" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="被举报的本" min-width="220">
                <template #default="{ row }">
                    <template v-if="row.script">
                        <div class="tt" @click="openDrawer(row.script._id)">{{ row.script.title || '(未命名)' }}<id-copy :id="row.script._id" /></div>
                        <div class="tags">
                            <el-tag :type="SCRIPT_STATUS_TAG[row.script.status]" size="small">{{ SCRIPT_STATUS[row.script.status] || row.script.status }}</el-tag>
                            <el-tag :type="AUDIT_TAG[row.script.audit_status] || 'info'" size="small" effect="plain">{{ AUDIT_LABEL[row.script.audit_status] || '—' }}</el-tag>
                            <el-tag :type="VIS_TAG[row.script.visibility] || 'info'" size="small" effect="plain">{{ VIS_LABEL[row.script.visibility] || '—' }}</el-tag>
                            <el-tag v-if="row.script.report_count" type="danger" size="small" :effect="row.script.report_flag ? 'dark' : 'plain'">×{{ row.script.report_count }}</el-tag>
                        </div>
                        <div class="muted who">作者 {{ row.script.creator.nickname || '(无昵称)' }}<id-copy :id="row.script.creator._id" /></div>
                    </template>
                    <span v-else class="muted who">本不存在<id-copy :id="row.script_id" /></span>
                </template>
            </el-table-column>
            <el-table-column label="理由" min-width="160">
                <template #default="{ row }">
                    <el-tag type="danger" size="small" effect="plain">{{ row.reason }}</el-tag>
                    <div v-if="row.detail" class="detail">{{ row.detail }}</div>
                </template>
            </el-table-column>
            <el-table-column label="处理态" min-width="180">
                <template #default="{ row }">
                    <el-tag :type="REPORT_STATUS_TAG[row.status]" size="small">{{ REPORT_STATUS_LABEL[row.status] || row.status }}</el-tag>
                    <div v-if="row.handler" class="muted">{{ row.handler }} · {{ fmt(row.handle_time) }}</div>
                    <el-text v-if="row.handle_note" :line-clamp="2" size="small">{{ row.handle_note }}</el-text>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="150" align="center">
                <template #default="{ row }">
                    <el-button type="primary" size="small" link :disabled="!row.script" @click="openDrawer(row.script && row.script._id)">看本</el-button>
                    <template v-if="row.status === 'pending'">
                        <el-button type="danger" size="small" link :disabled="!!row.script && row.script.visibility === 'private'" @click="handle(row, 'takedown')">转私</el-button>
                        <el-button type="info" size="small" link @click="handle(row, 'dismiss')">驳回</el-button>
                    </template>
                </template>
            </el-table-column>
        </el-table>
        <el-empty v-if="!loading && !list.length" description="这一栏没有举报" />

        <div class="pagination">
            <el-pagination v-model:currentPage="page" v-model:page-size="size" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" small @size-change="load(1)" @current-change="load()" />
        </div>

        <script-drawer ref="drawerRef" @changed="load()" />
    </div>
</template>

<script setup>
/**
 * 举报列表面板(③ 一期):按处理态分栏;下架 / 驳回 经 drama-admin.handleReport;「看本」复用详情抽屉。
 */
import { ref, reactive, onMounted } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import {
    dramaApi, shortId, SCRIPT_STATUS, SCRIPT_STATUS_TAG, AUDIT_LABEL, AUDIT_TAG, VIS_LABEL, VIS_TAG, REPORT_STATUS_LABEL, REPORT_STATUS_TAG,
} from '@/utils/drama'
import ScriptDrawer from './script-drawer.vue'
import IdCopy from './id-copy.vue'

const emit = defineEmits(['badge'])

const status = ref('pending')
const page = ref(1)
const size = ref(20)
const total = ref(0)
const list = ref([])
const counts = reactive({})
const loading = ref(false)
const drawerRef = ref(null)

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '—')

const load = async (p) => {
    if (p) page.value = p
    loading.value = true
    const r = await dramaApi('listReports', { status: status.value, page: page.value, size: size.value })
    loading.value = false
    if (!r || r.errMsg) { list.value = []; return ElMessage.error((r && r.errMsg) || '加载失败') }
    list.value = r.data.list || []
    total.value = r.data.total || 0
    if (r.data.counts) { Object.assign(counts, r.data.counts); emit('badge', r.data.counts.pending) }
}
const reload = () => load(1)

const openDrawer = (id) => id && drawerRef.value && drawerRef.value.open(id)

const handle = async (row, action) => {
    const isDown = action === 'takedown'
    const title = (row.script && row.script.title) || shortId(row.script_id)
    const r = await ElMessageBox.prompt(
        isDown
            ? `确认把《${title}》转为私有？记不合规、不再出现在广场(作者自己仍可玩),该本其余待处理举报一并归档。`
            : `驳回这条对《${title}》的举报（${row.reason}）？本不做任何改动。`,
        isDown ? '转私' : '驳回',
        { confirmButtonText: isDown ? '确认转私' : '确认驳回', cancelButtonText: '取消', inputPlaceholder: '备注（选填，≤200 字）', inputPattern: /^[\s\S]{0,200}$/, inputErrorMessage: '备注不超过 200 字', type: isDown ? 'warning' : 'info' }
    ).catch(() => null)
    if (!r || r.action !== 'confirm') return
    const res = await dramaApi('handleReport', { id: row._id, action, note: r.value || '' })
    if (!res || res.errMsg) return ElMessage.error((res && res.errMsg) || '处置失败')
    ElMessage.success(isDown ? `已转私${res.data.siblings ? `，连带归档 ${res.data.siblings} 条同本举报` : ''}` : '已驳回')
    await load()
}

onMounted(() => load(1))
</script>

<style lang="scss" scoped>
.rp {
    .filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;
        .hint { font-size: 12px; color: #c0c4cc; }
    }
    .tt { font-size: 14px; font-weight: 600; color: #303133; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; &:hover { color: #409eff; } }
    .tags { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin: 4px 0; }
    .who { display: flex; align-items: center; gap: 4px; font-size: 13px;
        .who-n { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    .detail { font-size: 12px; color: #606266; margin-top: 4px; white-space: pre-wrap; }
    .muted { font-size: 12px; color: #909399; }
}
</style>
