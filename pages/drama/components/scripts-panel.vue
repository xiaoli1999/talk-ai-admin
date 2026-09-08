<template>
    <div v-loading="loading" class="sp">
        <!-- 分栏 -->
        <div class="filters">
            <el-radio-group v-model="tab" @change="reload">
                <el-radio-button v-for="t in TABS" :key="t.key" :value="t.key">{{ t.label }}<span v-if="counts[t.key] != null">（{{ counts[t.key] }}）</span></el-radio-button>
            </el-radio-group>
            <span class="hint">创建时 AI 初审已定公开/私有;这里只对「被举报」的本人工再看一遍,决定要不要转私</span>
        </div>
        <!-- 搜索 + 排序 -->
        <div class="filters">
            <el-input v-model="keyword" placeholder="标题 / 钩子 / 愿望" clearable style="width: 220px;" @keyup.enter="reload" @clear="reload" />
            <span class="fl">排序</span>
            <el-select v-model="sort" style="width: 170px;" @change="reload">
                <el-option v-for="o in SCRIPT_SORTS" :key="o.key" :label="o.label" :value="o.key" />
            </el-select>
            <el-button :icon="dir === 'desc' ? SortDown : SortUp" @click="toggleDir">{{ dir === 'desc' ? '从高到低' : '从低到高' }}</el-button>
            <el-button type="primary" @click="reload">🔄 刷新</el-button>
            <span class="hint">共 {{ total }} 本 · 双击行开详情 · 悬停 ID 图标看全、点一下复制</span>
        </div>

        <el-table :data="list" size="small" :row-class-name="rowClass" style="width: 100%;" @row-dblclick="(row) => openDrawer(row._id)">
            <el-table-column label="封面" width="64" align="center">
                <template #default="{ row }">
                    <el-image v-if="row.cover" :src="row.cover" :preview-src-list="row.scene_imgs.length ? row.scene_imgs : [row.cover]" preview-teleported fit="cover" class="cover" />
                    <span v-else class="muted">无图</span>
                </template>
            </el-table-column>
            <el-table-column label="本 · 执笔愿望" min-width="280">
                <template #default="{ row }">
                    <div class="tt" @click="openDrawer(row._id)">{{ row.title || '(未命名)' }}</div>
                    <el-text :line-clamp="1" size="small" class="hook">{{ row.hook || '—' }}</el-text>
                    <el-tooltip placement="top" :disabled="!row.wish">
                        <template #content><div style="max-width: 420px; white-space: pre-wrap;">{{ row.wish }}</div></template>
                        <el-text :line-clamp="2" size="small" class="wish">{{ row.wish || '(没有愿望原文)' }}</el-text>
                    </el-tooltip>
                    <div class="tags">
                        <el-tag v-if="row.spec" size="small" type="info" effect="plain">{{ row.spec }}</el-tag>
                        <el-tag v-if="row.genre" size="small" type="info" effect="plain">{{ row.genre }}</el-tag>
                        <el-tag v-if="row.wish_type" size="small" type="warning" effect="plain">{{ WISH_TYPE_LABEL[row.wish_type] || row.wish_type }}</el-tag>
                        <id-copy :id="row._id" label="本ID" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="作者 / 崽" width="150">
                <template #default="{ row }">
                    <div class="who">
                        <el-avatar :size="22" :src="row.creator.avatar || undefined">{{ (row.creator.nickname || '?').slice(0, 1) }}</el-avatar>
                        <span class="who-n">{{ row.creator.nickname || '(无昵称)' }}</span>
                        <id-copy :id="row.creator._id" />
                    </div>
                    <div v-if="row.role" class="who muted">
                        <el-avatar :size="18" :src="row.role.avatar || undefined">{{ (row.role.name || '?').slice(0, 1) }}</el-avatar>
                        <span class="who-n">{{ row.role.name }}</span>
                        <id-copy :id="row.role._id" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="状态" width="92" align="center">
                <template #default="{ row }">
                    <div class="tags col">
                        <el-tag :type="SCRIPT_STATUS_TAG[row.status]" size="small">{{ SCRIPT_STATUS[row.status] || row.status }}</el-tag>
                        <el-tag v-if="row.status === 1" :type="AUDIT_TAG[row.audit_status] || 'info'" size="small" effect="plain">{{ AUDIT_LABEL[row.audit_status] || row.audit_status || '—' }}</el-tag>
                        <el-tag v-if="row.status === 1" :type="VIS_TAG[row.visibility] || 'info'" size="small" effect="plain">{{ VIS_LABEL[row.visibility] || row.visibility || '—' }}</el-tag>
                        <el-tag v-if="row.report_count" type="danger" size="small" :effect="row.report_flag ? 'dark' : 'plain'">举报 ×{{ row.report_count }}</el-tag>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="数据" width="236">
                <template #default="{ row }">
                    <div class="dg">
                        <div class="dgi" title="热度分 = 近7天×2 + 终身×1,广场最热排序用"><span>热度</span><b>{{ row.heat_score }}</b></div>
                        <div class="dgi" title="去重玩家数"><span>玩家</span><b>{{ row.stat_player_count }}</b></div>
                        <div class="dgi" :class="{ live: row.playing }" title="进行中的局"><span>在玩</span><b>{{ row.playing }}</b></div>
                        <div class="dgi" title="开局次数"><span>开局</span><b>{{ row.play_count }}</b></div>
                        <div class="dgi" title="已落幕的局 / 完局数"><span>完局</span><b>{{ row.stat_settle_count }}</b></div>
                        <div class="dgi" title="整本买断次数"><span>买断</span><b class="pay">{{ row.stat_full_count }}</b></div>
                        <div class="dgi" title="已被解锁的结局数 / 结局位总数(解锁总次数见详情)"><span>结局</span><b>{{ row.endings_unlocked }}<i>/{{ row.endings_total }}</i></b></div>
                        <div class="dgi" title="同一玩家第二局起"><span>复玩</span><b>{{ row.stat_rerun_count }}</b></div>
                        <div class="dgi" title="喜欢数"><span>喜欢</span><b>{{ row.likes }}</b></div>
                    </div>
                    <div class="muted dg-ft">
                        <span v-if="row.abandoned">弃局 {{ row.abandoned }} · </span>{{ row.last_played_at ? '最近一局 ' + fmt(row.last_played_at) : '还没人玩过' }}
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="时间 / 人工留痕" width="150">
                <template #default="{ row }">
                    <div class="muted">创建 {{ fmt(row.create_time) }}</div>
                    <div class="muted">更新 {{ fmt(row.update_time) }}</div>
                    <template v-if="row.audit_by">
                        <div class="audit-by">{{ row.audit_by }} · {{ fmt(row.audit_time) }}</div>
                        <el-tooltip placement="top" :content="row.audit_note"><el-text :line-clamp="1" size="small">{{ row.audit_note }}</el-text></el-tooltip>
                    </template>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="110" align="center">
                <template #default="{ row }">
                    <div class="ops">
                        <el-button type="primary" size="small" link @click="openDrawer(row._id)">详情</el-button>
                        <el-button type="danger" size="small" link :disabled="row.visibility === 'private'" @click="takePrivate(row)">转私</el-button>
                    </div>
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
 * 09-08 黎令二调:加排序(热度/创建/玩家/结局…服务端排)、每行玩况(在玩/落幕/结局解锁/喜欢/最近一局)、
 * 表格不横滑(列宽收口、不用 fixed 列)、长 id 全部换成小复制件。
 * 行内三键与抽屉三键同一入口 drama-admin.reviewScript(备注必填)。
 */
import { ref, reactive, onMounted } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { SortDown, SortUp } from '@element-plus/icons-vue'
import {
    dramaApi, SCRIPT_STATUS, SCRIPT_STATUS_TAG, AUDIT_LABEL, AUDIT_TAG, VIS_LABEL, VIS_TAG, WISH_TYPE_LABEL, SCRIPT_SORTS,
} from '@/utils/drama'
import ScriptDrawer from './script-drawer.vue'
import IdCopy from './id-copy.vue'

const emit = defineEmits(['badge'])

/* 09-09 黎定流程:没有「待审/通过/拒绝」;被举报 = report_count>0,人工处置过 = 有 audit_by */
const TABS = [
    { key: 'all', label: '全部' }, { key: 'public', label: '已公开' }, { key: 'private', label: '私有' },
    { key: 'reported', label: '被举报' }, { key: 'handled', label: '人工处置过' }, { key: 'writing', label: '执笔中' }, { key: 'dead', label: '判死·已删' },
]
const tab = ref('all')
const keyword = ref('')
const sort = ref('create_time')
const dir = ref('desc')
const page = ref(1)
const size = ref(20)
const total = ref(0)
const list = ref([])
const counts = reactive({})
const loading = ref(false)
const drawerRef = ref(null)

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '—')
/* 行底色:3 人以上举报标红;有举报但未达阈值标黄 */
const rowClass = ({ row }) => (row.report_flag ? 'row-flag' : (row.report_count > 0 && row.visibility === 'public' ? 'row-pending' : ''))

const load = async (p) => {
    if (p) page.value = p
    loading.value = true
    const r = await dramaApi('listScripts', { tab: tab.value, keyword: keyword.value, sort: sort.value, dir: dir.value, page: page.value, size: size.value })
    loading.value = false
    if (!r || r.errMsg) { list.value = []; return ElMessage.error((r && r.errMsg) || '加载失败') }
    list.value = r.data.list || []
    total.value = r.data.total || 0
    if (r.data.counts) { Object.assign(counts, r.data.counts); emit('badge', r.data.counts.reported) }
}
const reload = () => load(1)
const toggleDir = () => { dir.value = dir.value === 'desc' ? 'asc' : 'desc'; reload() }

const openDrawer = (id) => drawerRef.value && drawerRef.value.open(id)

/** 转私(不合规):本不再公开,作者自己仍可玩,作者端显示「仅自己」;备注必填。误转可在详情抽屉「撤销转私」 */
const takePrivate = async (row) => {
    const r = await ElMessageBox.prompt(
        `《${row.title || '(未命名)'}》转为私有：不再出现在广场，作者自己仍可玩，作者端显示「仅自己」。请填写原因（必填，留痕）`,
        '转私',
        { confirmButtonText: '确认转私', cancelButtonText: '取消', inputPlaceholder: '原因（≤200 字）', inputPattern: /^[\s\S]{1,200}$/, inputErrorMessage: '原因必填且不超过 200 字', type: 'warning' }
    ).catch(() => null)
    if (!r || r.action !== 'confirm') return
    const res = await dramaApi('reviewScript', { id: row._id, decision: 'private', note: r.value })
    if (!res || res.errMsg) return ElMessage.error((res && res.errMsg) || '处置失败')
    ElMessage.success(`已转私：${AUDIT_LABEL[res.data.audit_status] || res.data.audit_status} · ${VIS_LABEL[res.data.visibility]}`)
    await load()
}

onMounted(() => load(1))
</script>

<style lang="scss" scoped>
.sp {
    .filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;
        .fl { font-size: 13px; color: #606266; }
        .hint { font-size: 12px; color: #c0c4cc; }
    }
    .cover { width: 52px; height: 52px; border-radius: 6px; display: block; margin: 0 auto; }
    .tt { font-size: 14px; font-weight: 600; color: #303133; cursor: pointer; line-height: 1.3; &:hover { color: #409eff; } }
    /* 不能写 display:block——会盖掉 el-text line-clamp 的 -webkit-box,多行截断就失效(09-08 实测长愿望撑满 8 行) */
    .hook { color: #909399; margin: 2px 0; }
    .wish { color: #303133; white-space: pre-wrap; border-left: 2px solid #e6a23c; padding-left: 6px; margin: 2px 0; line-height: 1.5; }
    .tags { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 4px;
        &.col { flex-direction: column; align-items: center; }
    }
    .who { display: flex; align-items: center; gap: 4px; font-size: 13px; margin: 2px 0;
        .who-n { max-width: 84px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    .muted { font-size: 12px; color: #909399; line-height: 1.5; }
    .audit-by { font-size: 12px; color: #e6a23c; margin-top: 2px; }
    .dg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 6px;
        .dgi { display: flex; align-items: baseline; justify-content: space-between; font-size: 12px; line-height: 1.5;
            span { color: #909399; }
            b { color: #303133; font-variant-numeric: tabular-nums; i { font-style: normal; color: #c0c4cc; font-weight: 400; } }
            .pay { color: #67c23a; }
            &.live b { color: #409eff; }
        }
    }
    .dg-ft { margin-top: 2px; }
    .ops { display: flex; justify-content: center; gap: 2px; flex-wrap: nowrap; }
    :deep(.row-flag) td { background: #fef0f0 !important; }
    :deep(.row-pending) td { background: #fdf6ec !important; }
    :deep(.el-table .cell) { line-height: 1.4; }
}
</style>
