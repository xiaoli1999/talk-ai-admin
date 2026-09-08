<template>
    <el-drawer v-model="visible" :title="d ? `《${d.title || '(未命名)'}》` : '自由本详情'" size="720px" destroy-on-close @closed="d = null">
        <div v-loading="loading" class="sd">
            <template v-if="d">
                <!-- 状态行 -->
                <div class="sd-tags">
                    <el-tag :type="SCRIPT_STATUS_TAG[d.status]" size="small">{{ SCRIPT_STATUS[d.status] || d.status }}</el-tag>
                    <el-tag :type="AUDIT_TAG[d.audit_status] || 'info'" size="small">审核 {{ AUDIT_LABEL[d.audit_status] || d.audit_status || '—' }}</el-tag>
                    <el-tag :type="VIS_TAG[d.visibility] || 'info'" size="small">{{ VIS_LABEL[d.visibility] || d.visibility || '—' }}</el-tag>
                    <el-tag v-if="d.report_count" type="danger" size="small" :effect="d.report_flag ? 'dark' : 'plain'">举报 ×{{ d.report_count }}</el-tag>
                    <el-tag v-if="d.spec" size="small" type="info" effect="plain">{{ d.spec }}</el-tag>
                    <el-tag v-if="d.genre" size="small" type="info" effect="plain">{{ d.genre }}</el-tag>
                    <el-tag v-if="d.gen_state && d.gen_state !== 'done'" size="small" type="warning" effect="plain">gen {{ d.gen_state }}{{ d.fail_reason ? ' · ' + d.fail_reason : '' }}</el-tag>
                    <id-copy :id="d._id" label="本ID" />
                </div>

                <!-- 愿望原文 -->
                <div class="sd-sec">
                    <div class="sd-lb">执笔愿望<el-tag v-if="d.wish_type" size="small" type="warning" effect="plain" style="margin-left:6px;">{{ WISH_TYPE_LABEL[d.wish_type] || d.wish_type }}</el-tag></div>
                    <div class="sd-wish">{{ d.wish || '(空)' }}</div>
                    <div v-if="s.goal_anchor" class="sd-sub">目标锚:{{ s.goal_anchor }}</div>
                </div>

                <!-- 作者 / 崽 -->
                <div class="sd-sec sd-row">
                    <div class="sd-who">
                        <el-avatar :size="36" :src="d.creator.avatar || undefined">{{ (d.creator.nickname || '?').slice(0, 1) }}</el-avatar>
                        <div>
                            <div class="sd-who-n">{{ d.creator.nickname || '(无昵称)' }}</div>
                            <id-copy :id="d.creator._id" label="作者 uid" />
                        </div>
                    </div>
                    <div v-if="d.role" class="sd-who">
                        <el-avatar :size="36" :src="d.role.avatar || undefined">{{ (d.role.name || '?').slice(0, 1) }}</el-avatar>
                        <div>
                            <div class="sd-who-n">绑定崽 · {{ d.role.name }}</div>
                            <id-copy :id="d.role._id" label="崽 id" />
                        </div>
                    </div>
                    <div class="sd-time">
                        <div>创建 {{ fmt(d.create_time) }}</div>
                        <div>更新 {{ fmt(d.update_time) }}</div>
                    </div>
                </div>

                <!-- 数据 -->
                <div class="sd-sec">
                    <div class="sd-lb">数据</div>
                    <div class="sd-kpis">
                        <div class="k"><b>{{ d.heat_score }}</b><span>热度分</span></div>
                        <div class="k"><b>{{ d.heat }}</b><span>终身热度</span></div>
                        <div class="k"><b>{{ d.stat_player_count }}</b><span>玩家(去重)</span></div>
                        <div class="k live"><b>{{ d.playing }}</b><span>在玩</span></div>
                        <div class="k"><b>{{ d.play_count }}</b><span>开局</span></div>
                        <div class="k"><b>{{ d.stat_settle_count }}</b><span>完局</span></div>
                        <div class="k"><b>{{ d.abandoned }}</b><span>弃局</span></div>
                        <div class="k pay"><b>{{ d.stat_full_count }}</b><span>买断</span></div>
                        <div class="k"><b>{{ d.endings_unlocked }}<i>/{{ d.endings_total }}</i></b><span>结局 已解锁/位</span></div>
                        <div class="k"><b>{{ d.ending_unlocks }}</b><span>结局解锁总次数</span></div>
                        <div class="k"><b>{{ d.stat_rerun_count }}</b><span>复玩</span></div>
                        <div class="k"><b>{{ d.likes }}</b><span>喜欢</span></div>
                    </div>
                    <div class="sd-sub">局数合计 {{ d.sessions_total }}（进行中 {{ d.playing }} · 已落幕 {{ d.settled }} · 弃局 {{ d.abandoned }} · 其他 {{ d.sessions_other }}）· {{ d.last_played_at ? '最近一局 ' + fmt(d.last_played_at) : '还没人玩过' }}</div>
                </div>

                <!-- 最近 10 局 -->
                <div class="sd-sec">
                    <div class="sd-lb">最近 {{ d.sessions_recent.length }} 局</div>
                    <el-empty v-if="!d.sessions_recent.length" description="还没有局" :image-size="40" />
                    <el-table v-else :data="d.sessions_recent" size="small" border>
                        <el-table-column label="玩家" min-width="120">
                            <template #default="{ row }">
                                <div class="sd-cell-who">
                                    <el-avatar :size="18" :src="row.user.avatar || undefined">{{ (row.user.nickname || '?').slice(0, 1) }}</el-avatar>
                                    <span>{{ row.user.nickname || '(无昵称)' }}</span>
                                    <id-copy :id="row.user._id" />
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column label="状态" width="76" align="center">
                            <template #default="{ row }"><el-tag size="small" :type="SESSION_STATE_TAG[row.state] || 'info'">{{ SESSION_STATE_LABEL[row.state] || row.state || '—' }}</el-tag></template>
                        </el-table-column>
                        <el-table-column label="轮" width="44" align="center" prop="turn_count" />
                        <el-table-column label="计费" width="90" align="center">
                            <template #default="{ row }">{{ row.unlocked ? '买断' : (PAY_MODE_LABEL[row.pay_mode] || row.pay_mode || '—') }}<span v-if="row.revenue_cb" class="sd-muted"> · {{ row.revenue_cb }}贝</span></template>
                        </el-table-column>
                        <el-table-column label="结局" min-width="90">
                            <template #default="{ row }">{{ endingName(row.ending_id) }}</template>
                        </el-table-column>
                        <el-table-column label="开局 / 最近" width="118" align="center">
                            <template #default="{ row }"><div class="sd-muted">{{ fmt(row.create_time) }}</div><div class="sd-muted">{{ fmt(row.update_time) }}</div></template>
                        </el-table-column>
                        <el-table-column label="" width="40" align="center">
                            <template #default="{ row }"><id-copy :id="row._id" /></template>
                        </el-table-column>
                    </el-table>
                </div>

                <!-- 简介与场景图 -->
                <div class="sd-sec">
                    <div class="sd-lb">钩子</div>
                    <div class="sd-txt">{{ d.hook || '(空)' }}</div>
                </div>
                <div v-if="d.scene_imgs.length" class="sd-sec">
                    <div class="sd-lb">场景图（{{ d.scene_imgs.length }}）</div>
                    <div class="sd-imgs">
                        <el-image v-for="(u, i) in d.scene_imgs" :key="i" :src="u" :preview-src-list="d.scene_imgs" :initial-index="i" preview-teleported fit="cover" class="sd-img" />
                    </div>
                </div>

                <!-- 设定 -->
                <div class="sd-sec">
                    <div class="sd-lb">设定</div>
                    <el-descriptions :column="1" size="small" border>
                        <el-descriptions-item label="世界观">{{ (s.default_skin && s.default_skin.setting) || '—' }}</el-descriptions-item>
                        <el-descriptions-item label="角色位">{{ (s.default_skin && s.default_skin.cast) || '—' }}</el-descriptions-item>
                        <el-descriptions-item label="张力钩子">{{ s.tension_seed || '—' }}</el-descriptions-item>
                        <el-descriptions-item v-if="s.play_focus" label="看点">{{ s.play_focus }}</el-descriptions-item>
                        <el-descriptions-item v-if="s.role_anchor" label="底色锚">{{ s.role_anchor }}</el-descriptions-item>
                        <el-descriptions-item v-if="s.relation_type" label="关系">{{ s.relation_type }}</el-descriptions-item>
                    </el-descriptions>
                </div>

                <!-- 章 -->
                <div v-if="acts.length" class="sd-sec">
                    <div class="sd-lb">章（{{ acts.length }}）</div>
                    <el-table :data="acts" size="small" border>
                        <el-table-column label="#" width="40" align="center"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
                        <el-table-column prop="name" label="名" min-width="80" />
                        <el-table-column prop="goal" label="目标" min-width="200" show-overflow-tooltip />
                        <el-table-column prop="tension" label="张力" width="56" align="center" />
                        <el-table-column prop="max_turns" label="轮" width="48" align="center" />
                    </el-table>
                </div>

                <!-- 结局(带解锁人数/次数) -->
                <div v-if="endings.length" class="sd-sec">
                    <div class="sd-lb">结局（{{ endings.length }} 位 · 已解锁 {{ d.endings_unlocked }}）</div>
                    <el-table :data="endings" size="small" border :row-class-name="({ row }) => (endStat(row).n ? 'row-unlocked' : '')">
                        <el-table-column prop="slot_type" label="位" min-width="90" />
                        <el-table-column prop="rarity" label="稀有度" width="70" align="center">
                            <template #default="{ row }"><el-tag size="small" :type="rarityTag(row.rarity)">{{ row.rarity || '常规' }}</el-tag></template>
                        </el-table-column>
                        <el-table-column label="解锁 人/次" width="80" align="center">
                            <template #default="{ row }"><b v-if="endStat(row).n">{{ endStat(row).users }} / {{ endStat(row).n }}</b><span v-else class="sd-muted">—</span></template>
                        </el-table-column>
                        <el-table-column prop="tease" label="tease" min-width="220" show-overflow-tooltip />
                    </el-table>
                </div>

                <!-- 开场 -->
                <div v-if="openings.length" class="sd-sec">
                    <div class="sd-lb">开场变体（{{ openings.length }}）</div>
                    <div v-for="(o, i) in openings" :key="i" class="sd-txt sd-opening">{{ o }}</div>
                </div>

                <!-- 举报 -->
                <div class="sd-sec">
                    <div class="sd-lb">最近举报（{{ d.reports.length }}）</div>
                    <el-empty v-if="!d.reports.length" description="没有举报" :image-size="40" />
                    <div v-for="r in d.reports" :key="r._id" class="sd-rp">
                        <el-tag size="small" :type="REPORT_STATUS_TAG[r.status]">{{ REPORT_STATUS_LABEL[r.status] || r.status }}</el-tag>
                        <span class="sd-rp-r">{{ r.reason }}</span>
                        <span v-if="r.detail" class="sd-rp-d">{{ r.detail }}</span>
                        <span class="sd-rp-m">{{ r.reporter.nickname || '(无昵称)' }}<id-copy :id="r.reporter._id" /> · {{ fmt(r.create_time) }}<template v-if="r.handler"> · {{ r.handler }} {{ fmt(r.handle_time) }}{{ r.handle_note ? '：' + r.handle_note : '' }}</template></span>
                    </div>
                </div>

                <!-- 人工处置留痕 -->
                <div class="sd-sec">
                    <div class="sd-lb">人工处置留痕（{{ d.trail.length }}）</div>
                    <el-empty v-if="!d.trail.length" description="还没有人工处置" :image-size="40" />
                    <div v-for="(t, i) in d.trail" :key="i" class="sd-rp">
                        <el-tag size="small" :type="decisionTag(t.decision)">{{ DECISION_LABEL[t.decision] || t.decision }}</el-tag>
                        <span class="sd-rp-r">{{ t.note || '' }}</span>
                        <span class="sd-rp-m">{{ t.by }} · {{ fmt(t.t) }}<template v-if="t.prev"> · 原 {{ AUDIT_LABEL[t.prev.audit_status] || t.prev.audit_status }}/{{ VIS_LABEL[t.prev.visibility] || t.prev.visibility }}</template><template v-if="t.siblings"> · 连带 {{ t.siblings }} 条举报</template></span>
                    </div>
                </div>
            </template>
            <el-empty v-else-if="!loading" :description="err || '没有数据'" />
        </div>

        <!-- 底部动作:人工审核三键(备注必填) -->
        <template #footer>
            <div v-if="d" class="sd-ft">
                <span class="sd-ft-note" v-if="d.audit_by">上次:{{ d.audit_by }} · {{ fmt(d.audit_time) }} · {{ d.audit_note }}</span>
                <span v-else class="sd-ft-note">还没有人工处置</span>
                <div class="sd-ft-btns">
                    <el-button type="success" :disabled="d.status !== 1 || (d.audit_status === 'pass' && d.visibility === 'public')" :loading="acting === 'pass'" @click="review('pass')">通过并公开</el-button>
                    <el-tooltip content="内容有问题:审核态记「未过」并转私有" placement="top">
                        <el-button type="danger" :disabled="d.audit_status === 'fail'" :loading="acting === 'fail'" @click="review('fail')">拒绝</el-button>
                    </el-tooltip>
                    <el-tooltip content="内容没问题只是不公开:仅转私有,审核态不动" placement="top">
                        <el-button type="warning" plain :disabled="d.visibility === 'private'" :loading="acting === 'private'" @click="review('private')">转私有</el-button>
                    </el-tooltip>
                </div>
            </div>
        </template>
    </el-drawer>
</template>

<script setup>
/**
 * 自由本详情抽屉(自由本列表与举报列表共用):愿望原文 / 数据与最近 10 局 / 设定 / 章 / 结局(带解锁人次)/ 场景图 / 举报 / 留痕 + 三个人工审核动作。
 * 动作全部经 drama-admin.reviewScript(备注必填),成功后重拉详情并向父组件 emit('changed') 让列表刷新。
 */
import { ref, computed } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import {
    dramaApi, SCRIPT_STATUS, SCRIPT_STATUS_TAG, AUDIT_LABEL, AUDIT_TAG, VIS_LABEL, VIS_TAG,
    WISH_TYPE_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_TAG, DECISION_LABEL, SESSION_STATE_LABEL, SESSION_STATE_TAG, PAY_MODE_LABEL,
} from '@/utils/drama'
import IdCopy from './id-copy.vue'

const emit = defineEmits(['changed'])

const visible = ref(false)
const loading = ref(false)
const acting = ref('')
const err = ref('')
const d = ref(null)

const s = computed(() => (d.value && d.value.script) || {})
const acts = computed(() => Array.isArray(s.value.acts) ? s.value.acts : [])
const endings = computed(() => Array.isArray(s.value.endings) ? s.value.endings : [])
const openings = computed(() => Array.isArray(s.value.openings) ? s.value.openings : [])

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '—')
const rarityTag = (r) => ({ 稀有: 'warning', 隐藏: 'danger' }[r] || 'info')
const decisionTag = (k) => ({ pass: 'success', fail: 'danger', private: 'warning', takedown: 'danger', dismiss: 'info' }[k] || 'info')
const endStat = (row) => (d.value && d.value.ending_stats && d.value.ending_stats[row.id]) || { n: 0, users: 0 }
const endingName = (id) => { if (!id) return '—'; const e = endings.value.find((x) => x.id === id); return e ? `${e.slot_type || id}${e.rarity && e.rarity !== '常规' ? '·' + e.rarity : ''}` : id }

const load = async (id) => {
    loading.value = true
    err.value = ''
    const r = await dramaApi('getScript', { id })
    loading.value = false
    if (!r || r.errMsg) { err.value = (r && r.errMsg) || '加载失败'; d.value = null; return }
    d.value = r.data
}

/** 对外:打开某本 */
const open = (id) => { visible.value = true; d.value = null; load(id) }

const DECISION_TIP = {
    pass: '通过后立刻在广场公开可玩',
    fail: '内容有问题:审核态记「未过」并转私有(作者自己仍可玩,不再公开)',
    private: '内容没问题只是不公开:仅转私有,审核态不动(作者自己仍可玩)',
}
const review = async (decision) => {
    if (!d.value || acting.value) return
    const r = await ElMessageBox.prompt(
        `《${d.value.title || '(未命名)'}》· ${DECISION_TIP[decision]}。请填写备注（必填，留痕给下一次处置的人看）`,
        DECISION_LABEL[decision],
        { confirmButtonText: '确认', cancelButtonText: '取消', inputPlaceholder: '备注（≤200 字）', inputPattern: /^[\s\S]{1,200}$/, inputErrorMessage: '备注必填且不超过 200 字', type: decision === 'pass' ? 'success' : 'warning' }
    ).catch(() => null)
    if (!r || r.action !== 'confirm') return
    acting.value = decision
    const res = await dramaApi('reviewScript', { id: d.value._id, decision, note: r.value })
    acting.value = ''
    if (!res || res.errMsg) return ElMessage.error((res && res.errMsg) || '处置失败')
    ElMessage.success(`已${DECISION_LABEL[decision]}：审核 ${AUDIT_LABEL[res.data.audit_status] || res.data.audit_status} · ${VIS_LABEL[res.data.visibility]}`)
    await load(d.value._id)
    emit('changed', res.data)
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.sd {
    min-height: 200px;
    .sd-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .sd-sec { margin-bottom: 16px; }
    .sd-lb { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px; display: flex; align-items: center; }
    .sd-wish { font-size: 15px; line-height: 1.6; color: #303133; background: #fdf6ec; border-left: 3px solid #e6a23c; padding: 10px 12px; border-radius: 4px; white-space: pre-wrap; }
    .sd-sub { font-size: 12px; color: #909399; margin-top: 6px; }
    .sd-muted { font-size: 12px; color: #909399; }
    .sd-txt { font-size: 13px; line-height: 1.6; color: #606266; white-space: pre-wrap; }
    .sd-opening { background: #f5f7fa; padding: 8px 10px; border-radius: 4px; margin-bottom: 6px; }
    .sd-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
    .sd-who { display: flex; align-items: center; gap: 8px;
        .sd-who-n { font-size: 13px; color: #303133; }
    }
    .sd-cell-who { display: flex; align-items: center; gap: 4px; font-size: 12px; }
    .sd-time { margin-left: auto; font-size: 12px; color: #909399; line-height: 1.6; text-align: right; }
    .sd-imgs { display: flex; gap: 8px; flex-wrap: wrap; }
    .sd-img { width: 120px; height: 120px; border-radius: 6px; }
    .sd-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;
        .k { background: #f5f7fa; border-radius: 6px; padding: 8px 4px; text-align: center;
            b { display: block; font-size: 18px; color: #303133; font-variant-numeric: tabular-nums; i { font-style: normal; font-size: 12px; color: #c0c4cc; font-weight: 400; } }
            span { font-size: 11px; color: #909399; }
            &.live b { color: #409eff; }
            &.pay b { color: #67c23a; }
        }
    }
    .sd-rp { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px dashed #ebeef5; font-size: 12px;
        .sd-rp-r { color: #303133; }
        .sd-rp-d { color: #606266; }
        .sd-rp-m { color: #909399; margin-left: auto; display: inline-flex; align-items: center; gap: 2px; }
    }
    :deep(.row-unlocked) td { background: #f0f9eb !important; }
}
.sd-ft { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    .sd-ft-note { font-size: 12px; color: #909399; flex: 1; min-width: 120px; }
    .sd-ft-btns { display: flex; gap: 8px; }
}
</style>
