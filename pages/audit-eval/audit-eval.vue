<template>
    <el-scrollbar v-loading="loading" class="audit-eval page">
        <div class="bar">
            <span class="title">审核质量评测</span>
            <span class="hint">从「审核未通过 state=1」抽真实角色 → 用线上规则 dryRun 重审（不写库/不发通知）→ 比对 AI 与人工</span>
            <div class="ctrl">
                <span>抽取</span><el-input-number v-model="n" :min="1" :max="1000" :step="50" size="small" controls-position="right" style="width:110px" /><span>个</span>
                <span style="margin-left:8px;">取样</span>
                <el-select v-model="mode" size="small" style="width:150px;">
                    <el-option label="随机分散（推荐）" value="random" />
                    <el-option label="按驳回原因均衡" value="byreason" />
                    <el-option label="顺位最新" value="latest" />
                </el-select>
                <span style="margin-left:8px;">每个审</span><el-input-number v-model="runs" :min="1" :max="5" size="small" controls-position="right" style="width:90px" /><span>次</span>
                <span style="margin-left:8px;">并发</span><el-input-number v-model="conc" :min="1" :max="10" size="small" controls-position="right" style="width:90px" />
                <el-button type="primary" :loading="running" @click="runEval" style="margin-left:12px;">开始评测</el-button>
                <el-button v-if="running" type="danger" plain @click="running = false">停止</el-button>
                <span v-if="total" style="margin-left:10px;">进度 {{ done }} / {{ total }}</span>
            </div>
        </div>

        <div v-if="total" class="stats">
            <div class="c"><span>角色数</span><b>{{ roles.length }}</b></div>
            <div class="c ok"><span>AI建议驳回（与人工一致）</span><b>{{ stat.reject }}</b><small>{{ pct(stat.reject) }}</small></div>
            <div class="c warn"><span>⚠️ AI放行（人工驳回但AI放过）</span><b>{{ stat.pass }}</b><small>{{ pct(stat.pass) }}</small><em>重点核：漏放 or 合理放宽</em></div>
            <div class="c"><span>AI异常</span><b>{{ stat.err }}</b></div>
            <div class="c"><span>{{ runs }}次一致</span><b>{{ stat.consist }}</b><small>{{ pct(stat.consist) }}</small></div>
            <div class="c"><span>平均分(放行)</span><b>{{ stat.avgGrade }}</b></div>
            <div class="c"><span>总成本</span><b>¥{{ stat.cost }}</b><small>{{ stat.tokens }} tokens</small></div>
        </div>

        <el-radio-group v-if="total" v-model="filter" size="small" style="margin:10px 0;">
            <el-radio-button value="all">全部（{{ rows.length }}）</el-radio-button>
            <el-radio-button value="pass">⚠️ AI放行的（{{ stat.pass }}）</el-radio-button>
            <el-radio-button value="inconsist">多次不一致（{{ stat.inconsist }}）</el-radio-button>
            <el-radio-button value="err">异常（{{ stat.err }}）</el-radio-button>
        </el-radio-group>

        <el-table :data="pagedRows" border size="small" class="tbl" :row-class-name="rowClass">
            <el-table-column type="expand">
                <template #default="{ row }">
                    <div class="expand">
                        <div v-for="(r, i) in row.runs" :key="i" class="run">
                            <div class="run-head">
                                <b>第 {{ i + 1 }} 次</b>
                                <span v-if="!r" class="muted">（未跑）</span>
                                <span v-else-if="r.ai_error" style="color:#e6a23c;">异常：{{ r.ai_error }}</span>
                                <template v-else>
                                    <el-tag size="small" :type="r.text_pass === false ? 'danger' : 'success'">设定 {{ r.text_pass === false ? '驳回' : '通过' }}</el-tag>
                                    <el-tag size="small" :type="r.image_pass === false ? 'danger' : 'success'">图片 {{ r.image_pass === false ? '驳回' : '通过' }}</el-tag>
                                    <span v-if="r.ai_grade != null" class="muted">{{ r.ai_grade }}分</span>
                                    <span v-if="r.ai_confidence != null" class="muted">置信 {{ Math.round(r.ai_confidence * 100) }}%</span>
                                </template>
                            </div>
                            <div v-if="r && r.text_reason" class="run-reason"><b>设定问题：</b>{{ r.text_reason }}</div>
                            <div v-if="r && r.image_reason" class="run-reason"><b>图片问题：</b>{{ r.image_reason }}</div>
                            <div v-if="r && !r.ai_error && !r.text_reason && !r.image_reason" class="muted" style="margin-top:4px;">设定、图片均通过，无问题。</div>
                        </div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="图片" width="104" align="center">
                <template #default="{ row }">
                    <div style="display:flex;gap:4px;justify-content:center;">
                        <el-image v-if="row.avatar" :src="thumb(row.avatar)" :preview-src-list="[row.avatar, row.avatar_long]" preview-teleported fit="cover" style="width:38px;height:38px;border-radius:50%;" />
                        <el-image v-if="row.avatar_long" :src="thumb(row.avatar_long)" :preview-src-list="[row.avatar_long, row.avatar]" preview-teleported fit="cover" style="width:38px;height:60px;border-radius:4px;" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" width="76" align="center" />
            <el-table-column label="简介 / 设定" min-width="220">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content><div style="max-width:440px;white-space:pre-wrap;">【简介】{{ row.desc }}

【设定】{{ row.prompt }}</div></template>
                        <el-text :line-clamp="3" style="font-size:12px;">{{ row.desc }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
            <el-table-column label="人工驳回原因" min-width="160">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content><div style="max-width:380px;white-space:pre-wrap;">{{ row.refuse_reason }}</div></template>
                        <el-text :line-clamp="3" style="font-size:12px;color:#f56c6c;">{{ row.refuse_reason || '（无记录）' }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
            <el-table-column :label="'AI判定 ×' + runs" width="158" align="center">
                <template #default="{ row }">
                    <div v-for="(r, i) in row.runs" :key="i" style="display:flex;gap:3px;justify-content:center;align-items:center;margin:1px 0;">
                        <el-tag v-if="!r" type="info" size="small" effect="plain">—</el-tag>
                        <el-tag v-else-if="r.ai_error" type="info" size="small">异常</el-tag>
                        <template v-else>
                            <el-tag :type="r.text_pass === false ? 'danger' : 'success'" size="small">设{{ r.text_pass === false ? '✗' : '✓' }}</el-tag>
                            <el-tag :type="r.image_pass === false ? 'danger' : 'success'" size="small">图{{ r.image_pass === false ? '✗' : '✓' }}</el-tag>
                            <span v-if="r.ai_grade != null" style="font-size:11px;color:#E239DA;">{{ r.ai_grade }}</span>
                        </template>
                    </div>
                    <span v-if="row.done >= runs && !row.consist" style="font-size:10px;color:#e6a23c;">不一致</span>
                </template>
            </el-table-column>
            <el-table-column label="AI理由（点行展开看3次对比）" min-width="220">
                <template #default="{ row }">
                    <el-tooltip placement="top" :disabled="!row.aiReason">
                        <template #content><div style="max-width:420px;white-space:pre-wrap;">{{ row.aiReason }}</div></template>
                        <el-text :line-clamp="3" style="font-size:12px;color:#8a38f5;">{{ row.aiReason || (row.aiErr ? ('异常：' + row.aiErr) : '') }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
        </el-table>

        <el-pagination v-if="rows.length" style="margin-top:10px;justify-content:flex-end;"
            v-model:current-page="pageNo" v-model:page-size="pageSize"
            :total="filteredRows.length" :page-sizes="[10, 20, 50, 100, 200]"
            layout="total, sizes, prev, pager, next, jumper" background small />
    </el-scrollbar>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

const RoleAuditCloud = uniCloud.importObject('role-audit', { customUI: true })
const db = uniCloud.database()
const rolesMyDb = db.collection('roles_my')

const globalData = ref(getApp().globalData)
const isAdmin = ref(globalData.value.name === 'xiaoli')

const n = ref(200)        // 抽取数量
const runs = ref(3)       // 每个角色审核次数
const conc = ref(5)       // 并发
const pageNo = ref(1)     // 分页：当前页
const pageSize = ref(10)  // 分页：每页条数（1000 行直接渲染会卡，故只渲染当前页）
const loading = ref(false)
const running = ref(false)
const roles = ref([])
const results = reactive({}) // roleId -> [run0, run1, ...]
const done = ref(0)
const total = ref(0)
const filter = ref('all')
const mode = ref('random') // 取样方式：random 随机分散 / byreason 按驳回原因均衡 / latest 顺位最新

// 按"人工驳回原因"关键词分桶（用于均衡取样，保证各违规类型都测到）
const REASON_BUCKETS = [
    { k: '色情低俗', re: '色情|低俗|暴露|擦边|性暗示|血腥' },
    { k: '图片', re: '形象图|头像|图片|9:16|水印|模糊|截图|裁剪|比例' },
    { k: '分类作品', re: '分类|作品' },
    { k: '凑数敷衍', re: '凑|字数|敷衍|认真|无意义|详细信息' },
    { k: '人称关系', re: '人称|关系|视角|主控' },
    { k: '标签', re: '标签' },
    { k: '明星真人', re: '明星|真人|素人' },
    { k: '暴力政治', re: '暴力|政治|军事' },
]

const thumb = (url) => url ? (url + (url.includes('?') ? '&' : '?') + 'x-oss-process=image/resize,l_200') : url
const pct = (x) => roles.value.length ? Math.round(x / roles.value.length * 100) + '%' : '0%'

const aggData = (r) => (r && r.result && r.result.data) || []

/* 拉取真实被驳角色（state=1）。三种取样方式，尽量覆盖各类边界 */
async function loadRoles () {
    roles.value = []
    if (mode.value === 'latest') {
        // 顺位：最新 N（按 update_time 倒序，100 分批）
        let acc = []
        for (let skip = 0; skip < n.value; skip += 100) {
            const lim = Math.min(100, n.value - skip)
            const { result } = await rolesMyDb.where({ state: 1 }).orderBy('update_time', 'desc').skip(skip).limit(lim).get().catch(() => ({ result: { data: [] } }))
            const d = (result && result.data) || []
            acc = acc.concat(d)
            if (d.length < lim) break
        }
        roles.value = acc
        return
    }
    if (mode.value === 'byreason') {
        // 按驳回原因分桶，每桶随机抽 ~N/桶数，跨桶去重，保证各违规类型都覆盖
        const per = Math.ceil(n.value / REASON_BUCKETS.length) + 2
        const seen = new Set(); const all = []
        for (const b of REASON_BUCKETS) {
            const r = await db.collection('roles_my').aggregate()
                .match({ state: 1, refuse_reason: new RegExp(b.re, 'i') })
                .sample({ size: per }).end().catch(() => ({}))
            aggData(r).forEach(x => { if (!seen.has(x._id)) { seen.add(x._id); x._bucket = b.k; all.push(x) } })
        }
        roles.value = all.slice(0, n.value)
        return
    }
    // 默认 random：随机分散（sample 单次受 clientDB ~100 上限，每轮抽 100 + 去重补足；
    // N 接近总量时去重命中率升高，故放宽轮数上限）
    const seen = new Set(); const all = []
    let tries = 0, stale = 0
    const maxTries = Math.ceil(n.value / 100) + 25
    while (all.length < n.value && tries < maxTries) {
        const r = await db.collection('roles_my').aggregate().match({ state: 1 }).sample({ size: 100 }).end().catch(() => ({}))
        const d = aggData(r)
        if (!d.length) break
        const before = all.length
        d.forEach(x => { if (!seen.has(x._id)) { seen.add(x._id); all.push(x) } })
        tries++
        stale = (all.length === before) ? stale + 1 : 0
        if (stale >= 3) break // 连续 3 轮没新增（基本已抽尽）→ 停
    }
    roles.value = all.slice(0, n.value)
}

async function runEval () {
    if (!isAdmin.value) return ElMessage.warning('无权限')
    loading.value = true
    await loadRoles()
    loading.value = false
    if (!roles.value.length) return ElMessage.info('没有 state=1 的角色')

    Object.keys(results).forEach(k => delete results[k])
    const tasks = []
    roles.value.forEach(r => { for (let i = 0; i < runs.value; i++) tasks.push({ id: r._id, i }) })
    total.value = tasks.length
    done.value = 0
    pageNo.value = 1
    running.value = true

    let idx = 0
    const worker = async () => {
        while (idx < tasks.length && running.value) {
            const { id, i } = tasks[idx++]
            let r
            try {
                const res = await RoleAuditCloud.audit({ roleId: id, dryRun: true })
                r = (res && res.data) || { ai_error: res && res.errMsg || '无返回' }
            } catch (e) {
                r = { ai_error: String((e && e.message) || e) }
            }
            if (!results[id]) results[id] = []
            results[id][i] = r
            results[id] = results[id].slice() // 触发响应式
            done.value++
        }
    }
    await Promise.all(Array.from({ length: conc.value }, worker))
    running.value = false
    ElMessage.success('评测完成')
}

/* 每个角色聚合：runs、完成数、是否一致、代表结论、首条理由 */
const rows = computed(() => {
    void done.value // 建立依赖，进度变动即刷新
    return roles.value.map(role => {
        const rs = results[role._id] || []
        const got = rs.filter(Boolean)
        const valid = got.filter(x => !x.ai_error)
        const passN = valid.filter(x => x.ai_pass === true).length
        const rejN = valid.filter(x => x.ai_pass === false).length
        const errN = got.filter(x => x.ai_error).length
        // 代表结论：多数；并列时偏向"驳回"
        let verdict = 'pending'
        if (got.length) {
            if (valid.length === 0) verdict = 'err'
            else if (passN > rejN) verdict = 'pass'
            else verdict = 'reject'
        }
        const consist = valid.length > 0 && valid.every(x => x.ai_pass === valid[0].ai_pass)
        const first = got[0]
        return {
            ...role,
            runs: Array.from({ length: runs.value }, (_, i) => rs[i] || null),
            done: got.length,
            verdict, consist,
            aiReason: (valid[0] && valid[0].ai_not_reason) || '',
            aiErr: (first && first.ai_error) || '',
            grade: (valid.find(x => x.ai_pass === true) || {}).ai_grade,
        }
    })
})

const filteredRows = computed(() => {
    if (filter.value === 'pass') return rows.value.filter(r => r.verdict === 'pass')
    if (filter.value === 'inconsist') return rows.value.filter(r => r.done >= runs.value && !r.consist)
    if (filter.value === 'err') return rows.value.filter(r => r.verdict === 'err')
    return rows.value
})

/* 分页：只渲染当前页，避免 1000 行 DOM 卡顿 */
const pagedRows = computed(() => {
    const start = (pageNo.value - 1) * pageSize.value
    return filteredRows.value.slice(start, start + pageSize.value)
})
watch(filter, () => { pageNo.value = 1 }) // 切换筛选回到第 1 页

const stat = computed(() => {
    const rw = rows.value.filter(r => r.done > 0)
    const reject = rw.filter(r => r.verdict === 'reject').length
    const pass = rw.filter(r => r.verdict === 'pass').length
    const err = rw.filter(r => r.verdict === 'err').length
    const consist = rw.filter(r => r.consist).length
    const inconsist = rows.value.filter(r => r.done >= runs.value && !r.consist).length
    const grades = rw.filter(r => r.verdict === 'pass' && r.grade != null).map(r => r.grade)
    const avgGrade = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : '-'
    let cost = 0, tokens = 0
    Object.values(results).forEach(arr => (arr || []).forEach(x => { if (x) { cost += x.cost || 0; tokens += x.cost_tokens || 0 } }))
    return { reject, pass, err, consist, inconsist, avgGrade, cost: cost.toFixed(4), tokens }
})

const rowClass = ({ row }) => row.verdict === 'pass' ? 'row-pass' : (row.verdict === 'err' ? 'row-err' : '')
</script>

<style lang="scss" scoped>
.audit-eval {
    padding: 12px;
    .bar { display: flex; flex-direction: column; gap: 6px; padding-bottom: 8px;
        .title { font-size: 18px; font-weight: 700; }
        .hint { font-size: 12px; color: #909399; }
        .ctrl { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 13px; margin-top: 4px; }
    }
    .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0; }
    .stats .c { min-width: 140px; padding: 8px 12px; border: 1px solid #ebeef5; border-radius: 8px; background: #fafafe;
        display: flex; flex-direction: column; gap: 2px;
        span { font-size: 12px; color: #606266; } b { font-size: 20px; color: #303133; } small { font-size: 12px; color: #909399; } em { font-size: 11px; color: #e6a23c; font-style: normal; }
    }
    .stats .c.warn { border-left: 4px solid #e6a23c; }
    .stats .c.ok { border-left: 4px solid #67c23a; }
    :deep(.row-pass) { background: #fdf6ec !important; }
    :deep(.row-err) { background: #f4f4f5 !important; }
    .tbl :deep(.el-text) { font-size: 12px; }
    .expand { padding: 6px 16px; background: #fafafe; }
    .expand .run { margin-bottom: 8px; padding: 8px 10px; border: 1px solid #ebeef5; border-radius: 6px; background: #fff; }
    .expand .run-head { display: flex; align-items: center; gap: 8px; font-size: 13px; flex-wrap: wrap; }
    .expand .run-reason { margin-top: 4px; font-size: 12px; color: #8a38f5; line-height: 1.6; white-space: pre-wrap; }
    .expand .run-reason b { color: #f56c6c; }
    .expand .muted { color: #909399; font-size: 12px; }
}
</style>
