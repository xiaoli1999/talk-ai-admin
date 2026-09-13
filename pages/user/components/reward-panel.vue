<template>
    <div v-loading="loading" class="rw">
        <!-- 第一步:找人 -->
        <div class="filters">
            <el-select v-model="by" style="width: 120px;">
                <el-option value="auto" label="自动识别" />
                <el-option value="_id" label="用户 _id" />
                <el-option value="username" label="用户名" />
                <el-option value="nickname" label="昵称" />
            </el-select>
            <el-input v-model="q" placeholder="用户 _id / 用户名 / 昵称" clearable style="width: 320px;" @keyup.enter="search" @clear="clear" />
            <el-button type="primary" @click="search">搜索</el-button>
            <span class="hint">只找到一个人会直接展开详情;昵称重名时全等的排在前面,点一行选中</span>
        </div>

        <!-- 多个结果:列表(选中后收起) -->
        <el-table v-if="results.length > 1 && showList" :data="results" size="small" highlight-current-row :row-class-name="({ row }) => (sel && row._id === sel._id ? 'row-sel' : '')" style="width: 100%; margin-bottom: 12px;" @row-click="pickFromList">
            <el-table-column label="用户" min-width="170">
                <template #default="{ row }">
                    <div class="who"><el-avatar :size="26" :src="row.avatar || undefined">{{ (row.nickname || '?').slice(0, 1) }}</el-avatar><span class="who-n">{{ row.nickname || '(无昵称)' }}</span><el-tag v-if="row.gender" size="small" effect="plain" :type="row.gender === 1 ? 'primary' : 'danger'">{{ genderEnums[row.gender] }}</el-tag></div>
                </template>
            </el-table-column>
            <el-table-column label="匹配" width="64" align="center"><template #default="{ row }"><el-tag size="small" :type="row.exact ? 'success' : 'info'" effect="plain">{{ row.exact ? '全等' : '相似' }}</el-tag></template></el-table-column>
            <el-table-column label="用户名" min-width="110"><template #default="{ row }">{{ row.username || '—' }}</template></el-table-column>
            <el-table-column label="uid" width="60" align="center"><template #default="{ row }"><id-copy :id="row._id" label="uid" /></template></el-table-column>
            <el-table-column label="注册" min-width="120"><template #default="{ row }">{{ fmtD(row.register_date) }}<span class="muted">（{{ row.register_days }} 天）</span></template></el-table-column>
            <el-table-column label="最近登录" min-width="110"><template #default="{ row }"><span class="muted">{{ fmt(row.last_login_date) }}</span></template></el-table-column>
            <el-table-column label="采贝 免费 / 付费" min-width="110"><template #default="{ row }">{{ row.cb_num }} / {{ row.cb_pay_num }}</template></el-table-column>
            <el-table-column label="总充值" min-width="80"><template #default="{ row }"><b class="pay" :class="{ zero: !row.pay_total }">{{ yuan(row.pay_total) }} 元</b></template></el-table-column>
            <el-table-column label="联系方式" min-width="130"><template #default="{ row }"><span v-if="row.wechat_id || row.beta_phone" class="muted">{{ row.wechat_id || row.beta_phone }}</span><span v-else class="muted">—</span></template></el-table-column>
        </el-table>
        <!-- 多个结果且已选中:收起成一行,可换人 -->
        <div v-else-if="results.length > 1 && sel" class="picked">
            共找到 {{ results.length }}{{ capped ? '+' : '' }} 人（昵称全等 {{ exactCount }} 人），已选中 <b>{{ sel.nickname || sel._id.slice(-6) }}</b>
            <el-button link type="primary" size="small" @click="showList = true">换一个</el-button>
        </div>
        <el-empty v-else-if="searched && !loading && !results.length" description="没找到这样的用户" :image-size="60" />

        <!-- 第二步:详情 + 赠送 -->
        <div v-if="sel" class="detail">
            <el-card shadow="never" class="card">
                <template #header>
                    <div class="card-hd">
                        <el-avatar :size="40" :src="sel.avatar || undefined">{{ (sel.nickname || '?').slice(0, 1) }}</el-avatar>
                        <div>
                            <div class="card-t">{{ sel.nickname || '(无昵称)' }}<el-tag v-if="sel.gender" size="small" effect="plain" :type="sel.gender === 1 ? 'primary' : 'danger'" style="margin-left: 6px;">{{ genderEnums[sel.gender] }}</el-tag><el-tag v-if="sel.vip_end_time > now" size="small" type="warning" style="margin-left: 6px;">会员</el-tag><el-tag v-if="sel.talk_card_end_time > now" size="small" type="success" style="margin-left: 6px;">畅聊卡</el-tag></div>
                            <div class="muted">uid <id-copy :id="sel._id" label="uid" /> · 用户名 {{ sel.username || '—' }}</div>
                        </div>
                        <el-button link type="primary" style="margin-left: auto;" @click="reloadDetail">刷新</el-button>
                    </div>
                </template>
                <el-descriptions :column="3" size="small" border>
                    <el-descriptions-item label="注册">{{ fmt(sel.register_date) }}（{{ sel.register_days }} 天）</el-descriptions-item>
                    <el-descriptions-item label="注册来源">{{ sel.inviter_uid ? '邀请' : (platformEnums[sel.register_platform] || sel.register_platform || '—') }}</el-descriptions-item>
                    <el-descriptions-item label="最近登录">{{ fmt(sel.last_login_date) }} · {{ sel.login_count }} 次</el-descriptions-item>
                    <el-descriptions-item label="免费采贝余额"><b class="num">{{ sel.cb_num }}</b></el-descriptions-item>
                    <el-descriptions-item label="付费采贝余额"><b class="num">{{ sel.cb_pay_num }}</b></el-descriptions-item>
                    <el-descriptions-item label="领取采贝累计"><b class="num">{{ sel.receive_cb_total }}</b><span class="muted"> · {{ sel.receive_cb_count }} 次 · 上次 {{ sel.receive_cb_date || '—' }}</span></el-descriptions-item>
                    <el-descriptions-item label="总充值"><b class="pay" :class="{ zero: !sel.pay_total }">{{ yuan(sel.pay_total) }} 元</b><span class="muted"> · {{ sel.pay_count }} 次</span></el-descriptions-item>
                    <el-descriptions-item label="会员到期">{{ sel.vip_end_time ? fmtD(sel.vip_end_time) : '—' }}</el-descriptions-item>
                    <el-descriptions-item label="畅聊卡到期">{{ sel.talk_card_end_time ? fmtD(sel.talk_card_end_time) : '—' }}</el-descriptions-item>
                    <el-descriptions-item label="聊天次数">{{ sel.chat_total }}</el-descriptions-item>
                    <el-descriptions-item label="微信号"><span v-if="sel.wechat_id">{{ sel.wechat_id }}<id-copy :id="sel.wechat_id" label="微信号" /></span><span v-else class="muted">—</span></el-descriptions-item>
                    <el-descriptions-item label="手机号"><span v-if="sel.beta_phone || sel.mobile">{{ sel.beta_phone || sel.mobile }}<id-copy :id="sel.beta_phone || sel.mobile" label="手机号" /></span><span v-else class="muted">—</span></el-descriptions-item>
                </el-descriptions>
            </el-card>

            <el-card shadow="never" class="card">
                <template #header><div class="card-t">赠送采贝<span class="muted" style="margin-left: 8px; font-weight: 400;">进「免费采贝余额」,同时计入「领取采贝累计」;每笔留痕</span></div></template>
                <div class="grant">
                    <el-input-number v-model="amount" :min="1" :max="10000" :step="10" controls-position="right" style="width: 140px;" />
                    <span class="muted">采贝</span>
                    <el-input v-model="note" placeholder="备注（点下面的常用备注，或自己写）" maxlength="200" clearable style="width: 320px;" @keyup.enter="grant" />
                    <el-button type="primary" :loading="granting" :disabled="!(amount >= 1)" @click="grant">赠送给 {{ sel.nickname || sel._id.slice(-6) }}</el-button>
                    <span class="muted">发后余额 {{ Math.ceil(sel.cb_num + (amount || 0)) }} · 累计 {{ sel.receive_cb_total + (amount || 0) }}</span>
                </div>
                <div class="notes">
                    <span class="muted">常用备注</span>
                    <el-check-tag v-for="n in NOTE_PRESETS" :key="n" :checked="note === n" size="small" @change="note = note === n ? '' : n">{{ n }}</el-check-tag>
                </div>
            </el-card>

            <el-card shadow="never" class="card">
                <template #header><div class="card-t">最近赠送记录<span class="muted" style="margin-left: 8px; font-weight: 400;">最多 10 条</span></div></template>
                <el-empty v-if="!grants.length" description="还没有后台赠送记录" :image-size="40" />
                <el-table v-else :data="grants" size="small" style="width: 100%;">
                    <el-table-column label="时间" width="130"><template #default="{ row }">{{ fmt(row.create_time) }}</template></el-table-column>
                    <el-table-column label="数量" width="80" align="center"><template #default="{ row }"><b class="num">+{{ row.amount }}</b></template></el-table-column>
                    <el-table-column label="操作人" width="90"><template #default="{ row }">{{ row.operator }}</template></el-table-column>
                    <el-table-column label="余额 前 → 后" min-width="140"><template #default="{ row }"><span class="muted">{{ row.before.cb_num }} → {{ row.after.cb_num }}</span></template></el-table-column>
                    <el-table-column label="累计 前 → 后" min-width="140"><template #default="{ row }"><span class="muted">{{ row.before.receive_cb_total }} → {{ row.after.receive_cb_total }}</span></template></el-table-column>
                    <el-table-column label="备注" min-width="160"><template #default="{ row }">{{ row.note || '—' }}</template></el-table-column>
                </el-table>
            </el-card>
        </div>
    </div>
</template>

<script setup>
/**
 * 访客页 · 发放奖励面板(09-09 黎令从「最近」里独立出来):找人(_id / 用户名 / 昵称)→ 看详情 → 赠送采贝。
 * 赠送经 drama-admin.grantCb:免费采贝余额与领取采贝累计一起涨,每笔落 admin_cb_grants 留痕;不再走用户表 JQL 读改写。
 * 09-13 二调:
 *   - 只找到一个人(或昵称全等只有一个)直接展开详情,不再多点一下;多个结果点一行即选中并收起列表。
 *   - 每次搜索先清掉上一个选中的人(原来搜出多人时详情还停在上一个人,容易发错人)。
 *   - 常用备注一点即填,备注发完不清空、下次打开记住上次用的(连着给多人发同一种福利少一步)。
 */
import { ref, computed } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { genderEnums, platformEnums } from '@/config/enums'
import { dramaApi } from '@/utils/drama'
import IdCopy from '@/pages/drama/components/id-copy.vue'

const NOTE_PRESETS = ['小剧场内测福利', '客服充值福利', '老用户福利', '活动奖励', '问题补偿', '评价奖励']
const NOTE_KEY = 'admin_grant_note' // 后台本机记住上次用的备注,存不上不影响

const by = ref('auto')
const q = ref('')
const results = ref([])
const exactCount = ref(0)
const capped = ref(false)
const showList = ref(true)
const searched = ref(false)
const sel = ref(null)
const grants = ref([])
const amount = ref(20)
const note = ref((() => { try { return uni.getStorageSync(NOTE_KEY) || '' } catch (e) { return '' } })())
const loading = ref(false)
const granting = ref(false)
const now = Date.now()

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '—')
const fmtD = (ms) => (ms ? dayjs(ms).format('YY-MM-DD') : '—')
const yuan = (fen) => { const v = (Number(fen) || 0) / 100; return Number.isInteger(v) ? String(v) : v.toFixed(2) }

const clear = () => { results.value = []; searched.value = false; sel.value = null; grants.value = [] }

const search = async () => {
    const kw = String(q.value || '').trim()
    if (!kw) return ElMessage.warning('请输入 _id、用户名或昵称')
    sel.value = null
    grants.value = []
    showList.value = true
    loading.value = true
    const r = await dramaApi('findUsers', { q: kw, by: by.value })
    loading.value = false
    searched.value = true
    if (!r || r.errMsg) { results.value = []; return ElMessage.error((r && r.errMsg) || '搜索失败') }
    results.value = r.data.list || []
    exactCount.value = r.data.exact_count || 0
    capped.value = !!r.data.capped
    const exact = results.value.filter((x) => x.exact)
    /* 唯一结果,或全等的只有一个 → 直接展开详情 */
    if (results.value.length === 1) await pick(results.value[0])
    else if (exact.length === 1) { await pick(exact[0]); showList.value = false }
}

/** 选中一行 → 拉详情与流水 */
const pick = async (row) => {
    sel.value = row
    await reloadDetail()
}
const pickFromList = async (row) => {
    showList.value = false
    await pick(row)
}
const reloadDetail = async () => {
    if (!sel.value) return
    const id = sel.value._id
    const r = await dramaApi('userDetail', { user_id: id })
    if (!sel.value || sel.value._id !== id) return // 拉详情途中又换了人
    if (!r || r.errMsg) return ElMessage.error((r && r.errMsg) || '详情加载失败')
    sel.value = r.data.user
    grants.value = r.data.grants || []
}

const grant = async () => {
    if (!sel.value || granting.value) return
    const amt = Math.floor(Number(amount.value) || 0)
    if (!(amt >= 1 && amt <= 10000)) return ElMessage.warning('赠送数量须为 1~10000 的整数')
    const ok = await ElMessageBox.confirm(
        `给「${sel.value.nickname || sel.value._id}」赠送 ${amt} 采贝${note.value ? `（${note.value}）` : ''}？余额 ${sel.value.cb_num} → ${Math.ceil(sel.value.cb_num + amt)}，累计 ${sel.value.receive_cb_total} → ${sel.value.receive_cb_total + amt}。`,
        '确认赠送', { confirmButtonText: '确认赠送', cancelButtonText: '取消', type: 'warning' }
    ).catch(() => false)
    if (!ok) return
    granting.value = true
    const r = await dramaApi('grantCb', { user_id: sel.value._id, amount: amt, note: note.value })
    granting.value = false
    if (!r || r.errMsg) return ElMessage.error((r && r.errMsg) || '赠送失败')
    sel.value = r.data.user
    grants.value = r.data.grants || []
    const i = results.value.findIndex((x) => x._id === sel.value._id)
    if (i > -1) results.value[i] = { ...results.value[i], cb_num: sel.value.cb_num, receive_cb_total: sel.value.receive_cb_total }
    try { uni.setStorageSync(NOTE_KEY, note.value || '') } catch (e) { /* 本机记不住不影响 */ }
    ElMessage.success(`已赠送 ${amt} 采贝，余额 ${sel.value.cb_num}，累计 ${sel.value.receive_cb_total}${r.data.grant.logged ? '' : '（流水落库失败，已发放）'}`)
}
</script>

<style lang="scss" scoped>
.rw {
    .filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;
        .hint { font-size: 12px; color: #c0c4cc; }
    }
    .who { display: flex; align-items: center; gap: 6px; .who-n { font-size: 13px; color: #303133; } }
    .muted { font-size: 12px; color: #909399; display: inline-flex; align-items: center; gap: 2px; }
    .pay { color: #67c23a; &.zero { color: #c0c4cc; } }
    .num { color: #303133; font-variant-numeric: tabular-nums; }
    .picked { font-size: 13px; color: #606266; background: #f5f7fa; border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        b { color: #303133; }
    }
    .detail { display: flex; flex-direction: column; gap: 12px; max-width: 1100px; }
    .card { :deep(.el-card__header) { padding: 10px 16px; } :deep(.el-card__body) { padding: 12px 16px; } }
    .card-hd { display: flex; align-items: center; gap: 10px; }
    .card-t { font-size: 14px; font-weight: 600; color: #303133; display: flex; align-items: center; }
    .grant { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .notes { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
    :deep(.row-sel) td { background: #ecf5ff !important; }
    :deep(.el-table__row) { cursor: pointer; }
}
</style>
