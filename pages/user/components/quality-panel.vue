<template>
    <div v-loading="loading" :element-loading-text="loadingText" class="qp">
        <!-- 第一行:候选池 + 权重 -->
        <div class="filters">
            <span class="fl">候选池</span>
            <el-radio-group v-model="pool" size="small" @change="fetchRows">
                <el-radio-button value="contact">留了联系方式</el-radio-button>
                <el-radio-button value="active">近期活跃老用户</el-radio-button>
            </el-radio-group>
            <template v-if="pool === 'active'">
                <span class="muted">注册满</span>
                <el-input-number v-model="minRegDays" :min="0" :max="3650" :controls="false" size="small" style="width: 60px;" @change="fetchRows" />
                <span class="muted">天，近</span>
                <el-input-number v-model="activeDays" :min="1" :max="365" :controls="false" size="small" style="width: 52px;" @change="fetchRows" />
                <span class="muted">天登录过</span>
            </template>
            <span class="fl">权重</span>
            <el-radio-group v-model="presetKey" size="small" @change="applyPreset">
                <el-radio-button v-for="p in QUALITY_PRESETS" :key="p.key" :value="p.key">{{ p.label }}</el-radio-button>
                <el-radio-button v-if="presetKey === 'custom'" value="custom">自定义</el-radio-button>
            </el-radio-group>
            <el-popover placement="bottom" :width="380" trigger="click">
                <template #reference><el-button size="small">调权重</el-button></template>
                <div class="wt">
                    <div v-for="g in QUALITY_GROUPS" :key="g.key" class="wt-row">
                        <span class="wt-l"><i :style="{ background: g.color }"></i>{{ g.label }}</span>
                        <el-slider v-model="weights[g.key]" :min="0" :max="60" :step="5" size="small" class="wt-s" @input="onWeightInput" />
                        <b class="wt-v">{{ weightPct(g.key) }}%</b>
                    </div>
                    <div class="wt-ft">按占比算，不用凑满 100<el-button link type="primary" size="small" @click="applyPreset('balanced')">恢复均衡</el-button></div>
                </div>
            </el-popover>
            <el-popover placement="bottom-start" :width="520" trigger="click">
                <template #reference><el-button size="small" link type="primary">打分说明</el-button></template>
                <div class="explain">
                    <p><b>优质分</b> = 六个维度按权重加权（每维 0-100），再乘近况系数；异常账号再乘 0.3。</p>
                    <p v-for="g in QUALITY_GROUPS" :key="g.key"><i :style="{ background: g.color }"></i><b>{{ g.label }}</b>：{{ g.desc }}</p>
                    <p><b>近况系数</b>：最近登录 3 天内 ×1，7 天 ×0.95，14 天 ×0.9，30 天 ×0.8，60 天 ×0.65，90 天 ×0.5，更久 ×0.35。</p>
                    <p><b>异常</b>：领取采贝次数远超注册天数，或累计获得采贝超过 10 万、免费余额超过 5 万，疑似刷采贝。</p>
                    <p><b>分档</b>：<template v-for="t in TIERS" :key="t.key">{{ t.label }} {{ t.min ? `≥${t.min}` : '其余' }}　</template></p>
                </div>
            </el-popover>
        </div>

        <!-- 第二行:筛选 + 排序 -->
        <div class="filters">
            <el-checkbox v-model="todoOnly" size="small" border @change="clearSticky">只看待加</el-checkbox>
            <span class="fl">档位</span>
            <el-checkbox-group v-model="tiers" size="small" @change="toFirst">
                <el-checkbox-button v-for="t in TIERS" :key="t.key" :value="t.key">{{ t.key }}</el-checkbox-button>
            </el-checkbox-group>
            <span class="fl">标签</span>
            <el-checkbox-group v-model="tags" size="small" @change="toFirst">
                <el-checkbox-button value="creator">创作者</el-checkbox-button>
                <el-checkbox-button value="paid">付费过</el-checkbox-button>
                <el-checkbox-button v-if="pool === 'active'" value="contact">有联系方式</el-checkbox-button>
                <el-checkbox-button value="notBeta">没进体验版</el-checkbox-button>
            </el-checkbox-group>
            <span class="fl">排序</span>
            <el-select v-model="sortKey" size="small" style="width: 120px;" @change="toFirst">
                <el-option v-for="o in SORTS" :key="o.key" :value="o.key" :label="o.label" />
            </el-select>
            <el-button size="small" :icon="dir === 'desc' ? SortDown : SortUp" @click="dir = dir === 'desc' ? 'asc' : 'desc'; toFirst()">{{ dir === 'desc' ? '从高到低' : '从低到高' }}</el-button>
            <el-input v-model="keyword" size="small" placeholder="昵称 / 微信号 / 手机号 / uid" clearable style="width: 190px;" @input="toFirst" />
            <el-button type="primary" size="small" @click="fetchRows">🔄 重新汇总</el-button>
        </div>

        <!-- 汇总 -->
        <div v-if="rows.length || generatedAt" class="summary">
            <span>候选 <b>{{ scored.length }}</b> 人<template v-if="filtered.length !== scored.length"> · 当前筛出 <b>{{ filtered.length }}</b></template></span>
            <span v-for="t in TIERS" :key="t.key" class="tier-count"><em :class="'tier tier-' + t.key">{{ t.key }}</em><b>{{ tierCount[t.key] || 0 }}</b></span>
            <span>创作者 <b>{{ stat.creators }}</b></span>
            <span>付费过 <b>{{ stat.paid }}</b></span>
            <span v-if="pool === 'active'">有联系方式 <b>{{ stat.contact }}</b></span>
            <span>已跟进 <b>{{ stat.followed }}</b> · 已进内测 <b>{{ stat.joined }}</b></span>
            <span v-if="stat.anomaly" class="warn">异常 {{ stat.anomaly }}</span>
            <span v-if="truncated" class="warn">候选超过 3000 人，按最近登录截断</span>
            <span v-if="errors.length" class="warn" :title="errors.join('\n')">{{ errors.length }} 张表汇总失败，相关分数按 0 计</span>
            <span class="hint">数据汇总于 {{ generatedAt ? dayjs(generatedAt).format('HH:mm:ss') : '—' }} · 耗时 {{ (costMs / 1000).toFixed(1) }} 秒；切权重、筛选、排序不用重新汇总</span>
        </div>

        <el-table :data="pageRows" size="small" stripe row-key="_id" :row-class-name="rowClass" style="width: 100%;">
            <el-table-column type="expand" width="36">
                <template #default="{ row }">
                    <div class="detail">
                        <div class="dg"><em class="dt" :style="{ color: GC.creation }">创作力 {{ row.q.groups.creation }}</em>
                            上线捏崽 <b>{{ row.f.roles_pub }}</b> 个（优质 {{ row.f.roles_hq }}）· 捏崽提交/草稿 <b>{{ row.f.roles_my }}</b> · 写自由本 <b>{{ row.f.scripts }}</b> 本（公开 {{ row.f.scripts_pub }} · 被玩 {{ row.f.script_players }} 人）· 微调身份 <b>{{ row.f.prompts }}</b> 次 · AI 出图 <b>{{ row.f.ai_imgs }}</b> 张 · 问卷会写吗 <b>{{ (row.survey && row.survey.q8) || '—' }}</b></div>
                        <div class="dg"><em class="dt" :style="{ color: GC.sticky }">黏性 {{ row.q.groups.sticky }}</em>
                            登录 <b>{{ row.f.login }}</b> · 聊天 <b>{{ row.f.chat }}</b> · 累计获得采贝 <b>{{ row.f.cb_total }}</b> · 领取采贝 <b>{{ row.f.cb_count }}</b> 次 · 看广告 <b>{{ row.f.ad }}</b> · 喜欢过角色 <b>{{ row.f.likes_given }}</b> · 加到我的小程序 <b>{{ row.f.add_mp ? '是' : '否' }}</b></div>
                        <div class="dg"><em class="dt" :style="{ color: GC.tenure }">资历 {{ row.q.groups.tenure }}</em>
                            注册 <b>{{ fmtD(row.register_date) }}</b>（{{ row.q.tenureDays }} 天）· 最近登录 <b>{{ fmt(row.last_login_date) }}</b>（{{ agoText(row.q.loginAgoDays) }}，近况 ×{{ row.q.recency }}）</div>
                        <div class="dg"><em class="dt" :style="{ color: GC.pay }">付费 {{ row.q.groups.pay }}</em>
                            总充值 <b>{{ yuan(row.f.pay_fen) }}</b> 元 · <b>{{ row.f.pay_n }}</b> 次 · 近 30 天 <b>{{ yuan(row.f.pay30_fen) }}</b> 元 · 最近付费 <b>{{ row.f.last_paid ? fmtD(row.f.last_paid) : '—' }}</b> · 会员 <b>{{ row.f.vip ? '中' : '否' }}</b></div>
                        <div class="dg"><em class="dt" :style="{ color: GC.influence }">影响力 {{ row.q.groups.influence }}</em>
                            作品被喜欢 <b>{{ row.f.roles_likes }}</b> · 作品被聊 <b>{{ row.f.roles_talks }}</b> · 自由本被玩 <b>{{ row.f.script_players }}</b> 人 · 邀请 <b>{{ row.f.invites }}</b>（成功 {{ row.f.invites_ok }}）</div>
                        <div class="dg"><em class="dt" :style="{ color: GC.intent }">反馈意愿 {{ row.q.groups.intent }}</em>
                            填过问卷 <b>{{ row.f.surveys }}</b> 期<template v-if="row.survey"> · 想和谁重逢 <b>{{ row.survey.q2 || '—' }}</b> · 希望多长 <b>{{ row.survey.q4 || '—' }}</b> · 付费方式 <b>{{ row.survey.q6 || '—' }}</b> · 定价 <b>{{ row.survey.q7 || '—' }}</b></template><template v-else> · 没填三期问卷</template></div>
                        <div class="dg"><em class="dt">体验版</em>{{ row.theater.entered ? `进过 · ${row.theater.sessions} 局 · 首次 ${fmtD(row.theater.first)}` : '没进过' }}</div>
                        <div v-if="row.q.anomaly.length" class="dg warn"><em class="dt">异常</em>{{ row.q.anomaly.join('；') }}</div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="排名" width="60" align="center">
                <template #default="{ row }"><div class="rank" :class="'rk-' + row.q.tier.key">{{ row.rank }}</div></template>
            </el-table-column>
            <el-table-column label="用户" min-width="180">
                <template #default="{ row }">
                    <div class="who">
                        <el-avatar :size="30" :src="row.avatar || undefined">{{ (row.nickname || '?').slice(0, 1) }}</el-avatar>
                        <div class="who-t">
                            <div class="who-n"><span class="nick">{{ row.nickname || '(无昵称)' }}</span>
                                <el-tooltip v-if="row.q.anomaly.length" :content="row.q.anomaly.join('；')" placement="top"><el-tag size="small" type="danger" effect="dark">异常</el-tag></el-tooltip>
                            </div>
                            <div class="muted">注册 {{ row.q.tenureDays }} 天 · {{ agoText(row.q.loginAgoDays) }}登录<id-copy :id="row._id" label="uid" /></div>
                        </div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="优质分" min-width="80" align="center">
                <template #default="{ row }">
                    <div class="score" :class="'sc-' + row.q.tier.key">{{ row.q.total }}</div>
                    <em :class="'tier tier-' + row.q.tier.key">{{ row.q.tier.label }}</em>
                </template>
            </el-table-column>
            <el-table-column label="六维" min-width="210">
                <template #default="{ row }">
                    <div class="bars">
                        <div v-for="g in QUALITY_GROUPS" :key="g.key" class="bar" :title="`${g.label} ${row.q.groups[g.key]}：${g.desc}`">
                            <span class="bl">{{ g.short }}</span>
                            <span class="bt"><i :style="{ width: row.q.groups[g.key] + '%', background: g.color }"></i></span>
                            <b class="bv">{{ row.q.groups[g.key] }}</b>
                        </div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="推荐理由" min-width="220">
                <template #default="{ row }">
                    <div class="reasons">
                        <span v-for="(r, i) in row.q.reasons.slice(0, 5)" :key="i" class="rs" :style="{ borderColor: GC[r.group] }"><i :style="{ background: GC[r.group] }"></i>{{ r.text }}</span>
                        <span v-if="!row.q.reasons.length" class="muted">没有突出项</span>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="联系方式" min-width="170">
                <template #default="{ row }">
                    <template v-if="row.contact.wechat_id || row.contact.beta_phone">
                        <div class="ct"><span class="ct-k">微信</span><b v-if="row.contact.wechat_id">{{ row.contact.wechat_id }}</b><span v-else class="muted">—</span><id-copy :id="row.contact.wechat_id" label="微信号" /></div>
                        <div class="ct"><span class="ct-k">手机</span><b v-if="row.contact.beta_phone">{{ row.contact.beta_phone }}</b><span v-else class="muted">—</span><id-copy :id="row.contact.beta_phone" label="手机号" /></div>
                    </template>
                    <span v-else class="muted">没留联系方式</span>
                </template>
            </el-table-column>
            <el-table-column label="体验版" width="72" align="center">
                <template #default="{ row }">
                    <el-tag v-if="row.theater.entered" size="small" type="success" :title="`${row.theater.sessions} 局 · 首次 ${fmtD(row.theater.first)}`">进过</el-tag>
                    <span v-else class="muted center">没进</span>
                </template>
            </el-table-column>
            <el-table-column label="跟进" min-width="250">
                <template #default="{ row }">
                    <follow-cell :user-id="row._id" :invite="row.invite" @saved="(v) => onSaved(row, v)" />
                </template>
            </el-table-column>
        </el-table>
        <el-empty v-if="!loading && generatedAt && !filtered.length" description="没有符合条件的用户" />

        <div class="pagination">
            <el-pagination v-model:currentPage="page" v-model:page-size="size" :total="filtered.length" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" small />
        </div>
    </div>
</template>

<script setup>
/**
 * 内测招募 · 优质老用户(09-13 黎令:把最优质的老用户筛出来,按顺序加进私域)。
 * 取数:drama-admin.listQualityUsers 一次拉齐候选池全部用户的原始特征(联系方式池 138 人约 2 秒,活跃老用户池 1600 人约 5 秒)。
 * 打分:utils/quality-score.js(纯函数),切权重 / 筛选 / 排序都在本地即时算,不重新请求。
 * 排名列 = 当前权重下全池按优质分的名次(和筛选、排序无关,方便按名次一路往下加)。
 * 「只看待加」下刚标记的行不会立刻消失(本次操作过的保留到下次汇总或改筛选),免得列表跳动找不到位置。
 */
import { ref, shallowRef, triggerRef, reactive, computed, watch, onMounted } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { SortDown, SortUp } from '@element-plus/icons-vue'
import { dramaApi, INVITE_DONE } from '@/utils/drama'
import { QUALITY_GROUPS, QUALITY_PRESETS, DEFAULT_WEIGHTS, TIERS, scoreRow } from '@/utils/quality-score'
import IdCopy from '@/pages/drama/components/id-copy.vue'
import FollowCell from './follow-cell.vue'

const PREF_KEY = 'admin_quality_prefs' // 后台本机偏好(权重/候选池/排序),丢了按默认
const GC = Object.fromEntries(QUALITY_GROUPS.map((g) => [g.key, g.color]))
const SORTS = [
    { key: 'total', label: '优质分' },
    ...QUALITY_GROUPS.map((g) => ({ key: 'g.' + g.key, label: g.label })),
    { key: 'tenure', label: '注册天数' }, { key: 'recent', label: '最近登录' }, { key: 'chat', label: '聊天次数' },
    { key: 'cb_total', label: '累计获得采贝' }, { key: 'ad', label: '看广告次数' }, { key: 'pay', label: '总充值' },
    { key: 'roles_pub', label: '上线捏崽数' }, { key: 'prompts', label: '微调身份次数' },
]

const loadPrefs = () => { try { return uni.getStorageSync(PREF_KEY) || {} } catch (e) { return {} } }
const prefs = loadPrefs()

const pool = ref(prefs.pool === 'active' ? 'active' : 'contact')
const minRegDays = ref(Number.isFinite(prefs.minRegDays) ? prefs.minRegDays : 30)
const activeDays = ref(Number.isFinite(prefs.activeDays) ? prefs.activeDays : 30)
const presetKey = ref(prefs.presetKey || 'balanced')
const weights = reactive({ ...DEFAULT_WEIGHTS, ...(prefs.weights || {}) })
const todoOnly = ref(!!prefs.todoOnly)
const sortKey = ref(prefs.sortKey || 'total')
const dir = ref(prefs.dir === 'asc' ? 'asc' : 'desc')
const tiers = ref([])
const tags = ref([])
const keyword = ref('')
const page = ref(1)
const size = ref(20)

const rows = shallowRef([]) // 上千行原始特征不需要深度响应;改了跟进手动 triggerRef
const loading = ref(false)
const generatedAt = ref(0)
const costMs = ref(0)
const truncated = ref(false)
const errors = ref([])
const sticky = ref(new Set()) // 本次标记过跟进的 uid(「只看待加」时暂留)

const loadingText = computed(() => (pool.value === 'active' ? '正在汇总近期活跃老用户的 16 项数据，约 5 秒…' : '正在汇总…'))

watch([pool, minRegDays, activeDays, presetKey, todoOnly, sortKey, dir], savePrefs)
watch(weights, savePrefs, { deep: true })
function savePrefs () {
    try { uni.setStorageSync(PREF_KEY, { pool: pool.value, minRegDays: minRegDays.value, activeDays: activeDays.value, presetKey: presetKey.value, weights: { ...weights }, todoOnly: todoOnly.value, sortKey: sortKey.value, dir: dir.value }) } catch (e) { /* 本机偏好存不上不影响使用 */ }
}

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '—')
const fmtD = (ms) => (ms ? dayjs(ms).format('YY-MM-DD') : '—')
const yuan = (fen) => { const v = (Number(fen) || 0) / 100; return Number.isInteger(v) ? String(v) : v.toFixed(2) }
const agoText = (d) => (d >= 9999 ? '从未' : d === 0 ? '今天' : `${d} 天前`)

const fetchRows = async () => {
    loading.value = true
    const t0 = Date.now()
    const r = await dramaApi('listQualityUsers', { pool: pool.value, minRegDays: minRegDays.value, activeDays: activeDays.value })
    loading.value = false
    if (!r || r.errMsg) return ElMessage.error((r && r.errMsg) || '汇总失败')
    rows.value = r.data.list || []
    generatedAt.value = r.data.generated_at || Date.now()
    costMs.value = Date.now() - t0
    truncated.value = !!r.data.truncated
    errors.value = r.data.errors || []
    clearSticky()
    page.value = 1
}

/* 权重 */
const applyPreset = (key) => {
    const p = QUALITY_PRESETS.find((x) => x.key === key)
    if (!p) return
    presetKey.value = key
    Object.assign(weights, p.weights)
}
const onWeightInput = () => {
    const hit = QUALITY_PRESETS.find((p) => QUALITY_GROUPS.every((g) => p.weights[g.key] === weights[g.key]))
    presetKey.value = hit ? hit.key : 'custom'
}
const weightPct = (k) => { const s = QUALITY_GROUPS.reduce((a, g) => a + (weights[g.key] || 0), 0); return s ? Math.round((weights[k] || 0) / s * 100) : 0 }

/* 打分(权重变了整池重算,1600 行也就几毫秒) */
const scored = computed(() => {
    const nowMs = generatedAt.value || Date.now()
    const w = { ...weights }
    const list = rows.value.map((r) => ({ ...r, q: scoreRow(r, w, nowMs) }))
    const byTotal = list.slice().sort((a, b) => b.q.total - a.q.total)
    byTotal.forEach((x, i) => { x.rank = i + 1 })
    return list
})

const sortVal = (x) => {
    const k = sortKey.value
    if (k === 'total') return x.q.total
    if (k.startsWith('g.')) return x.q.groups[k.slice(2)]
    if (k === 'tenure') return x.q.tenureDays
    if (k === 'recent') return -x.q.loginAgoDays
    if (k === 'pay') return x.f.pay_fen
    return x.f[k] || 0
}

const filtered = computed(() => {
    const kw = String(keyword.value || '').trim().toLowerCase()
    const out = scored.value.filter((x) => {
        if (todoOnly.value && INVITE_DONE.has(x.invite.status) && !sticky.value.has(x._id)) return false
        if (tiers.value.length && !tiers.value.includes(x.q.tier.key)) return false
        if (tags.value.includes('creator') && !(x.f.roles_pub > 0 || x.f.scripts > 0)) return false
        if (tags.value.includes('paid') && !(x.f.pay_fen > 0)) return false
        if (tags.value.includes('contact') && !(x.contact.wechat_id || x.contact.beta_phone)) return false
        if (tags.value.includes('notBeta') && x.theater.entered) return false
        if (kw && ![x.nickname, x.contact.wechat_id, x.contact.beta_phone, x._id].some((v) => String(v || '').toLowerCase().includes(kw))) return false
        return true
    })
    const sgn = dir.value === 'desc' ? -1 : 1
    return out.sort((a, b) => (sortVal(a) - sortVal(b)) * sgn || a.rank - b.rank)
})
const pageRows = computed(() => filtered.value.slice((page.value - 1) * size.value, page.value * size.value))

const tierCount = computed(() => scored.value.reduce((a, x) => { a[x.q.tier.key] = (a[x.q.tier.key] || 0) + 1; return a }, {}))
const stat = computed(() => scored.value.reduce((a, x) => {
    if (x.f.roles_pub > 0 || x.f.scripts > 0) a.creators++
    if (x.f.pay_fen > 0) a.paid++
    if (x.contact.wechat_id || x.contact.beta_phone) a.contact++
    if (x.invite.status) a.followed++
    if (x.invite.status === 'joined') a.joined++
    if (x.q.anomaly.length) a.anomaly++
    return a
}, { creators: 0, paid: 0, contact: 0, followed: 0, joined: 0, anomaly: 0 }))

const rowClass = ({ row }) => [INVITE_DONE.has(row.invite.status) ? 'row-done' : '', row.q.anomaly.length ? 'row-anomaly' : ''].join(' ')
const toFirst = () => { page.value = 1; clearSticky() }
function clearSticky () { sticky.value = new Set() }

/** 跟进保存成功:改原始行(打分结果随之重算),记入本次操作过 */
const onSaved = (row, v) => {
    const raw = rows.value.find((x) => x._id === row._id)
    if (raw) raw.invite = v
    sticky.value = new Set([...sticky.value, row._id])
    triggerRef(rows)
}

onMounted(fetchRows)
</script>

<style lang="scss" scoped>
.qp {
    min-height: 240px;
    .filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;
        .fl { font-size: 13px; color: #606266; margin-left: 6px; }
    }
    .muted { font-size: 12px; color: #909399; line-height: 1.6; display: inline-flex; align-items: center; gap: 2px; flex-wrap: wrap; &.center { justify-content: center; } }
    .summary { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 13px; color: #606266; background: #f5f7fa; border-radius: 6px; padding: 8px 12px; margin: 4px 0 10px;
        b { color: #303133; font-size: 15px; margin-left: 2px; }
        .tier-count { display: inline-flex; align-items: center; gap: 4px; }
        .warn { color: #e6a23c; }
        .hint { color: #c0c4cc; font-size: 12px; }
    }
    /* 档位徽标:序数不是状态色,用调色板暖→冷 */
    .tier { font-style: normal; font-size: 11px; line-height: 16px; padding: 0 5px; border-radius: 3px; display: inline-block; white-space: nowrap; }
    .tier-S { background: #eb6834; color: #fff; }
    .tier-A { background: #fdf0e0; color: #b35c00; }
    .tier-B { background: #ecf5ff; color: #1c5cab; }
    .tier-C { background: #f4f4f5; color: #909399; }
    .rank { font-size: 16px; font-weight: 700; color: #909399; font-variant-numeric: tabular-nums;
        &.rk-S { color: #eb6834; } &.rk-A { color: #b35c00; }
    }
    .score { font-size: 20px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; color: #303133;
        &.sc-S { color: #eb6834; } &.sc-A { color: #b35c00; } &.sc-C { color: #909399; }
    }
    .who { display: flex; align-items: center; gap: 8px;
        .who-t { min-width: 0; }
        .who-n { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #303133;
            .nick { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
        }
    }
    .bars { display: flex; flex-direction: column; gap: 2px; }
    .bar { display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 13px;
        .bl { flex: 0 0 26px; color: #606266; }
        .bt { flex: 1; height: 6px; background: #f0f2f5; border-radius: 3px; overflow: hidden; i { display: block; height: 100%; border-radius: 3px; } }
        .bv { flex: 0 0 22px; text-align: right; color: #303133; font-weight: 600; font-variant-numeric: tabular-nums; }
    }
    .reasons { display: flex; flex-wrap: wrap; gap: 4px; }
    .rs { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; line-height: 18px; padding: 0 6px; border: 1px solid #dcdfe6; border-radius: 9px; color: #303133; background: #fff; white-space: nowrap;
        i { width: 6px; height: 6px; border-radius: 50%; }
    }
    .ct { display: flex; align-items: center; gap: 4px; font-size: 13px; line-height: 1.7;
        .ct-k { color: #909399; font-size: 12px; flex: 0 0 28px; white-space: nowrap; }
        b { color: #303133; font-weight: 600; user-select: all; word-break: break-all; }
    }
    .detail { padding: 6px 16px 10px 56px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #606266; line-height: 1.7;
        b { color: #303133; }
        .dt { font-style: normal; font-weight: 600; display: inline-block; min-width: 86px; color: #303133; }
        .warn { color: #f56c6c; }
    }
    :deep(.el-table .cell) { line-height: 1.4; }
    :deep(.row-done) td { opacity: .5; }
    :deep(.row-done:hover) td { opacity: 1; }
    :deep(.row-anomaly) td { background: #fef0f0 !important; }
}
.wt { display: flex; flex-direction: column; gap: 2px;
    .wt-row { display: flex; align-items: center; gap: 10px; }
    .wt-l { flex: 0 0 72px; font-size: 13px; color: #303133; display: flex; align-items: center; gap: 6px; i { width: 8px; height: 8px; border-radius: 50%; } }
    .wt-s { flex: 1; }
    .wt-v { flex: 0 0 36px; text-align: right; font-size: 13px; color: #303133; font-variant-numeric: tabular-nums; }
    .wt-ft { font-size: 12px; color: #909399; display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
}
.explain { font-size: 12px; color: #606266; line-height: 1.7;
    p { margin: 0 0 4px; }
    i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    b { color: #303133; }
}
</style>
