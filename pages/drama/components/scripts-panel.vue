<template>
    <div v-loading="loading" class="sp">
        <!-- 筛选:分栏 + 关键字 -->
        <div class="filters">
            <el-radio-group v-model="tab" @change="reload">
                <el-radio-button v-for="t in TABS" :key="t.key" :value="t.key">{{ t.label }}<span v-if="counts[t.key] != null">（{{ counts[t.key] }}）</span></el-radio-button>
            </el-radio-group>
            <el-input v-model="keyword" placeholder="标题 / 钩子 / 愿望" clearable style="width: 220px;" @keyup.enter="reload" @clear="reload" />
            <el-button type="primary" @click="reload">🔄 刷新</el-button>
            <span class="hint">全部 = 含执笔中 / 判死 / 已删;审核只看「待审 / AI拒 / 已公开 / 已转私」四栏(均为已交付本)</span>
        </div>

        <el-table :data="list" border size="small" :row-class-name="rowClass" @row-dblclick="(row) => openDrawer(row._id)">
            <el-table-column label="封面" width="72" align="center">
                <template #default="{ row }">
                    <el-image v-if="row.cover" :src="row.cover" :preview-src-list="row.scene_imgs.length ? row.scene_imgs : [row.cover]" preview-teleported fit="cover" class="cover" />
                    <span v-else class="muted">无图</span>
                </template>
            </el-table-column>
            <el-table-column label="本" min-width="180">
                <template #default="{ row }">
                    <div class="tt" @click="openDrawer(row._id)">{{ row.title || '(未命名)' }}</div>
                    <el-text :line-clamp="2" size="small" class="hook">{{ row.hook || '—' }}</el-text>
                    <div class="tags">
                        <el-tag v-if="row.spec" size="small" type="info" effect="plain">{{ row.spec }}</el-tag>
                        <el-tag v-if="row.genre" size="small" type="info" effect="plain">{{ row.genre }}</el-tag>
                        <el-button link type="primary" size="small" @click="copy(row._id)">…{{ shortId(row._id) }}</el-button>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="执笔愿望" min-width="200">
                <template #default="{ row }">
                    <el-tooltip placement="top" :disabled="!row.wish">
                        <template #content><div style="max-width: 360px; white-space: pre-wrap;">{{ row.wish }}</div></template>
                        <el-text :line-clamp="3" class="wish">{{ row.wish || '(空)' }}</el-text>
                    </el-tooltip>
                    <div v-if="row.wish_type" class="muted">{{ WISH_TYPE_LABEL[row.wish_type] || row.wish_type }}</div>
                </template>
            </el-table-column>
            <el-table-column label="作者 / 崽" min-width="130">
                <template #default="{ row }">
                    <div class="who">
                        <el-avatar :size="24" :src="row.creator.avatar || undefined">{{ (row.creator.nickname || '?').slice(0, 1) }}</el-avatar>
                        <span>{{ row.creator.nickname || '(无昵称)' }}</span>
                        <el-button link type="primary" size="small" @click="copy(row.creator._id)">…{{ shortId(row.creator._id) }}</el-button>
                    </div>
                    <div v-if="row.role" class="who muted">
                        <el-avatar :size="20" :src="row.role.avatar || undefined">{{ (row.role.name || '?').slice(0, 1) }}</el-avatar>
                        <span>{{ row.role.name }}</span>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="状态" width="110" align="center">
                <template #default="{ row }">
                    <div class="tags col">
                        <el-tag :type="SCRIPT_STATUS_TAG[row.status]" size="small">{{ SCRIPT_STATUS[row.status] || row.status }}</el-tag>
                        <el-tag v-if="row.status === 1" :type="AUDIT_TAG[row.audit_status] || 'info'" size="small" effect="plain">审 {{ AUDIT_LABEL[row.audit_status] || row.audit_status || '—' }}</el-tag>
                        <el-tag v-if="row.status === 1" :type="VIS_TAG[row.visibility] || 'info'" size="small" effect="plain">{{ VIS_LABEL[row.visibility] || row.visibility || '—' }}</el-tag>
                        <el-tag v-if="row.report_count" type="danger" size="small" :effect="row.report_flag ? 'dark' : 'plain'">举报 ×{{ row.report_count }}</el-tag>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="热度 / 开局 / 完局 / 买断" width="150" align="center">
                <template #default="{ row }">
                    <span class="nums"><b>{{ row.heat_score }}</b> / {{ row.play_count }} / {{ row.stat_settle_count }} / <b style="color:#67c23a;">{{ row.stat_full_count }}</b></span>
                </template>
            </el-table-column>
            <el-table-column label="人工留痕" min-width="140">
                <template #default="{ row }">
                    <template v-if="row.audit_by">
                        <div class="muted">{{ row.audit_by }} · {{ fmt(row.audit_time) }}</div>
                        <el-text :line-clamp="2" size="small">{{ row.audit_note }}</el-text>
                    </template>
                    <span v-else class="muted">—</span>
                </template>
            </el-table-column>
            <el-table-column label="创建" width="90" align="center">
                <template #default="{ row }"><span class="muted">{{ fmt(row.create_time) }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="230" align="center" fixed="right">
                <template #default="{ row }">
                    <el-button type="primary" size="small" link @click="openDrawer(row._id)">详情</el-button>
                    <el-button type="success" size="small" :disabled="row.status !== 1 || (row.audit_status === 'pass' && row.visibility === 'public')" @click="review(row, 'pass')">通过</el-button>
                    <el-button type="danger" size="small" :disabled="row.audit_status === 'fail'" @click="review(row, 'fail')">拒绝</el-button>
                    <el-button type="warning" size="small" plain :disabled="row.visibility === 'private'" @click="review(row, 'private')">转私</el-button>
                </template>
            </el-table-column>
        </el-table>
        <el-empty v-if="!loading && !list.length" description="这一栏没有本" />

        <div class="pagination">
            <el-pagination v-model:currentPage="page" v-model:page-size="size" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" small @size-change="load(1)" @current-change="load()" />
        </div>

        <script-drawer ref="drawerRef" @changed="load()" />
    </div>
</template>

<script setup>
/**
 * 自由本列表面板(② 一期):默认「全部」看所有自由本;审核时切「待审 / AI拒 / 已公开 / 已转私」。
 * 行内三键与抽屉三键同一入口 drama-admin.reviewScript(备注必填);列表数据经云对象分页(≤50)。
 */
import { ref, reactive, onMounted } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { copyText } from '@/utils/common'
import {
    dramaApi, shortId, SCRIPT_STATUS, SCRIPT_STATUS_TAG, AUDIT_LABEL, AUDIT_TAG, VIS_LABEL, VIS_TAG, WISH_TYPE_LABEL, DECISION_LABEL,
} from '@/utils/drama'
import ScriptDrawer from './script-drawer.vue'

const emit = defineEmits(['badge'])

const TABS = [
    { key: 'all', label: '全部' }, { key: 'pending', label: '待审' }, { key: 'fail', label: 'AI拒' },
    { key: 'public', label: '已公开' }, { key: 'private', label: '已转私' }, { key: 'writing', label: '执笔中' }, { key: 'dead', label: '判死·已删' },
]
const tab = ref('all')
const keyword = ref('')
const page = ref(1)
const size = ref(20)
const total = ref(0)
const list = ref([])
const counts = reactive({})
const loading = ref(false)
const drawerRef = ref(null)

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '—')
const rowClass = ({ row }) => (row.report_flag ? 'row-flag' : (row.status === 1 && row.audit_status === 'pending' ? 'row-pending' : ''))

const copy = async (text) => {
    if (!text) return
    const ok = await copyText(text).catch(() => false)
    ElMessage[ok ? 'success' : 'error'](ok ? '已复制' : '复制失败')
}

const load = async (p) => {
    if (p) page.value = p
    loading.value = true
    const r = await dramaApi('listScripts', { tab: tab.value, keyword: keyword.value, page: page.value, size: size.value })
    loading.value = false
    if (!r || r.errMsg) { list.value = []; return ElMessage.error((r && r.errMsg) || '加载失败') }
    list.value = r.data.list || []
    total.value = r.data.total || 0
    if (r.data.counts) { Object.assign(counts, r.data.counts); emit('badge', r.data.counts.pending) }
}
const reload = () => load(1)

const openDrawer = (id) => drawerRef.value && drawerRef.value.open(id)

const DECISION_TIP = {
    pass: '通过后立刻在广场公开可玩',
    fail: '标记审核未过并转私有(作者自己仍可玩,不再公开)',
    private: '仅转私有,审核态不动(作者自己仍可玩)',
}
const review = async (row, decision) => {
    const r = await ElMessageBox.prompt(
        `《${row.title || '(未命名)'}》· ${DECISION_TIP[decision]}。请填写备注（必填）`,
        DECISION_LABEL[decision],
        { confirmButtonText: '确认', cancelButtonText: '取消', inputPlaceholder: '备注（≤200 字）', inputPattern: /^[\s\S]{1,200}$/, inputErrorMessage: '备注必填且不超过 200 字', type: decision === 'pass' ? 'success' : 'warning' }
    ).catch(() => null)
    if (!r || r.action !== 'confirm') return
    const res = await dramaApi('reviewScript', { id: row._id, decision, note: r.value })
    if (!res || res.errMsg) return ElMessage.error((res && res.errMsg) || '处置失败')
    ElMessage.success(`已${DECISION_LABEL[decision]}：审核 ${AUDIT_LABEL[res.data.audit_status] || res.data.audit_status} · ${VIS_LABEL[res.data.visibility]}`)
    await load()
}

onMounted(() => load(1))
</script>

<style lang="scss" scoped>
.sp {
    .filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;
        .hint { font-size: 12px; color: #c0c4cc; }
    }
    .cover { width: 56px; height: 56px; border-radius: 6px; }
    .tt { font-size: 14px; font-weight: 600; color: #303133; cursor: pointer; &:hover { color: #409eff; } }
    .hook { display: block; color: #606266; margin: 2px 0; }
    .wish { color: #303133; white-space: pre-wrap; }
    .tags { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 4px;
        &.col { flex-direction: column; align-items: center; }
    }
    .who { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 2px 0; }
    .muted { font-size: 12px; color: #909399; }
    .nums { font-size: 13px; font-variant-numeric: tabular-nums; }
    :deep(.row-flag) td { background: #fef0f0 !important; }
    :deep(.row-pending) td { background: #fdf6ec !important; }
}
</style>
