<template>
    <div v-loading="loading" class="bp">
        <!-- 筛选 -->
        <div class="filters">
            <span class="fl">付费</span>
            <el-radio-group v-model="q.paid" size="small" @change="reload">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="paid">付费过</el-radio-button>
                <el-radio-button value="unpaid">未付费</el-radio-button>
            </el-radio-group>
            <el-input-number v-model="q.minPay" :min="0" :step="10" :controls="false" size="small" placeholder="最低总充值" style="width: 100px;" @change="reload" />
            <span class="muted">元起</span>
            <span class="fl">体验版</span>
            <el-radio-group v-model="q.beta" size="small" @change="reload">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="entered">进过</el-radio-button>
                <el-radio-button value="not">没进</el-radio-button>
            </el-radio-group>
            <span class="fl">跟进</span>
            <el-select v-model="q.invite" size="small" style="width: 120px;" @change="reload">
                <el-option value="all" label="全部" />
                <el-option value="none" label="未处理" />
                <el-option v-for="s in INVITE_STATUS.filter((x) => x.value)" :key="s.value" :value="s.value" :label="s.label" />
            </el-select>
        </div>
        <div class="filters">
            <span class="fl">时间</span>
            <el-select v-model="q.timeField" size="small" style="width: 130px;" @change="reload">
                <el-option value="contact" label="留联系方式" />
                <el-option value="register" label="注册时间" />
                <el-option value="login" label="最近登录" />
                <el-option value="pay" label="最近付费" />
            </el-select>
            <el-date-picker v-model="range" type="datetimerange" size="small" :shortcuts="shortcuts" range-separator="至" start-placeholder="不限" end-placeholder="不限" style="width: 340px;" @change="reload" />
            <span class="fl">排序</span>
            <el-select v-model="q.sort" size="small" style="width: 150px;" @change="reload">
                <el-option v-for="o in SORTS" :key="o.key" :value="o.key" :label="o.label" />
            </el-select>
            <el-button size="small" :icon="q.dir === 'desc' ? SortDown : SortUp" @click="toggleDir">{{ q.dir === 'desc' ? '从高到低' : '从低到高' }}</el-button>
            <el-input v-model="q.keyword" size="small" placeholder="昵称 / 微信号 / 手机号 / uid" clearable style="width: 200px;" @keyup.enter="reload" @clear="reload" />
            <el-button type="primary" size="small" @click="reload">🔄 刷新</el-button>
        </div>

        <!-- 汇总 -->
        <div v-if="summary" class="summary">
            <span>留了联系方式 <b>{{ summary.n }}</b> 人</span>
            <span>付费过 <b>{{ summary.paid }}</b> 人</span>
            <span>累计充值 <b>{{ yuan(summary.pay_total) }}</b> 元</span>
            <span>近 30 天充值 <b>{{ yuan(summary.recent30) }}</b> 元</span>
            <span>进过体验版 <b :class="{ ok: summary.entered }">{{ summary.entered }}</b> 人</span>
            <span>已跟进 <b>{{ summary.followed }}</b> 人 · 已进体验版标记 <b>{{ summary.joined }}</b> / 100</span>
            <span v-if="truncated" class="warn">候选超过 3000 人被截断</span>
            <span class="hint">「进过体验版」= 在体验版里开过剧场局或进过剧场入口;当前筛选下的汇总</span>
        </div>

        <el-table :data="list" size="small" stripe style="width: 100%;">
            <el-table-column label="用户" min-width="170">
                <template #default="{ row }">
                    <div class="who">
                        <el-avatar :size="28" :src="row.avatar || undefined">{{ (row.nickname || '?').slice(0, 1) }}</el-avatar>
                        <div class="who-t">
                            <div class="who-n">{{ row.nickname || '(无昵称)' }}<el-tag v-if="row.gender" size="small" :type="row.gender === 1 ? 'primary' : 'danger'" effect="plain" style="margin-left: 4px;">{{ genderEnums[row.gender] }}</el-tag></div>
                            <div class="muted">uid <id-copy :id="row._id" label="uid" /></div>
                        </div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="联系方式" min-width="190">
                <template #default="{ row }">
                    <div class="ct"><span class="ct-k">微信</span><b v-if="row.contact.wechat_id">{{ row.contact.wechat_id }}</b><span v-else class="muted">—</span><id-copy :id="row.contact.wechat_id" label="微信号" /></div>
                    <div class="ct"><span class="ct-k">手机</span><b v-if="row.contact.beta_phone">{{ row.contact.beta_phone }}</b><span v-else class="muted">—</span><id-copy :id="row.contact.beta_phone" label="手机号" /></div>
                    <div class="muted">留于 {{ fmt(row.contact.time) }}<span v-if="row.contact.source"> · {{ row.contact.source }}</span></div>
                </template>
            </el-table-column>
            <el-table-column label="注册 / 登录" min-width="140">
                <template #default="{ row }">
                    <div>注册 <b>{{ row.register_days }}</b> 天<span class="muted">（{{ fmtD(row.register_date) }}）</span></div>
                    <div class="muted">最近登录 {{ fmt(row.last_login_date) }}</div>
                    <div class="muted">登录 {{ row.login_count }} 次 · 聊天 {{ row.chat_total }} 次</div>
                </template>
            </el-table-column>
            <el-table-column label="付费" min-width="200">
                <template #default="{ row }">
                    <div><b class="pay" :class="{ zero: !row.pay.total }">{{ yuan(row.pay.total) }} 元</b><span class="muted"> · {{ row.pay.count }} 次</span></div>
                    <div class="muted">近 30 天 <b :class="{ hot: row.pay.recent30 }">{{ yuan(row.pay.recent30) }}</b> 元 · 最近付费 {{ row.pay.last_paid ? fmtD(row.pay.last_paid) : '—' }}</div>
                    <div class="tags">
                        <el-tag v-if="row.vip_end_time > now" size="small" type="warning" effect="plain">会员至 {{ fmtD(row.vip_end_time) }}</el-tag>
                        <el-tag v-if="row.talk_card_end_time > now" size="small" type="success" effect="plain">畅聊卡</el-tag>
                        <span class="muted">采贝 {{ row.cb_num }}/{{ row.cb_pay_num }}</span>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="问卷（付费方式 / 定价 / 会写吗）" min-width="200">
                <template #default="{ row }">
                    <div v-if="row.survey" class="tags">
                        <el-tag size="small" effect="plain">{{ row.survey.q6 || '—' }}</el-tag>
                        <el-tag size="small" effect="plain" :type="priceTag(row.survey.q7)">{{ row.survey.q7 || '—' }}</el-tag>
                        <el-tag size="small" effect="plain" :type="row.survey.q8 && row.survey.q8.startsWith('会写') ? 'success' : 'info'">{{ row.survey.q8 || '—' }}</el-tag>
                    </div>
                    <span v-else class="muted">没有 v3 问卷记录</span>
                </template>
            </el-table-column>
            <el-table-column label="体验版" min-width="120" align="center">
                <template #default="{ row }">
                    <template v-if="row.theater.entered">
                        <el-tag size="small" type="success">进过</el-tag>
                        <div class="muted">{{ row.theater.sessions }} 局 · 首次 {{ fmtD(row.theater.first) }}</div>
                    </template>
                    <el-tag v-else size="small" type="info" effect="plain">没进</el-tag>
                </template>
            </el-table-column>
            <el-table-column label="跟进" min-width="230">
                <template #default="{ row }">
                    <div class="fu">
                        <el-select :model-value="row.invite.status" size="small" style="width: 118px;" @change="(v) => setInvite(row, v, row.invite.note)">
                            <el-option v-for="s in INVITE_STATUS" :key="s.value" :value="s.value" :label="s.label" />
                        </el-select>
                        <el-input :model-value="row.invite.note" size="small" placeholder="备注,回车保存" maxlength="200" @change="(v) => setInvite(row, row.invite.status, v)" />
                    </div>
                    <div v-if="row.invite.operator" class="muted">{{ row.invite.operator }} · {{ fmt(row.invite.update_time) }}</div>
                </template>
            </el-table-column>
        </el-table>
        <el-empty v-if="!loading && !list.length" description="没有符合条件的用户" />

        <div class="pagination">
            <el-pagination v-model:currentPage="page" v-model:page-size="size" :total="total" :page-sizes="[20, 50]" layout="total, sizes, prev, pager, next" small @size-change="load(1)" @current-change="load()" />
        </div>
    </div>
</template>

<script setup>
/**
 * 访客页 · 内测招募面板(09-09 黎令):把三期问卷留了微信号/手机号的用户列出来,按付费筛与排,
 * 看注册多久、付了多少、问卷怎么答、进没进体验版,逐个加进私域并标记跟进态(新表 beta_invites)。
 * 数据经 drama-admin.listBetaCandidates / setBetaInvite,不走用户表 JQL。
 */
import { ref, reactive, onMounted } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { SortDown, SortUp } from '@element-plus/icons-vue'
import { genderEnums } from '@/config/enums'
import { dramaApi, INVITE_STATUS } from '@/utils/drama'
import IdCopy from '@/pages/drama/components/id-copy.vue'

const SORTS = [
    { key: 'pay_total', label: '总充值' }, { key: 'pay_count', label: '付费次数' }, { key: 'recent_pay', label: '近 30 天充值' },
    { key: 'last_pay', label: '最近付费时间' }, { key: 'wechat_id_time', label: '留联系方式时间' }, { key: 'last_login_date', label: '最近登录' },
    { key: 'register_date', label: '注册时间' }, { key: 'vip_end_time', label: '会员到期' }, { key: 'chat_total', label: '聊天次数' },
    { key: 'theater_sessions', label: '剧场局数' }, { key: 'login_count', label: '登录次数' },
]
const shortcuts = [
    { text: '今天', value: () => [dayjs().startOf('day').toDate(), new Date()] },
    { text: '近 7 天', value: () => [dayjs().subtract(6, 'day').startOf('day').toDate(), new Date()] },
    { text: '近 30 天', value: () => [dayjs().subtract(29, 'day').startOf('day').toDate(), new Date()] },
]

const q = reactive({ paid: 'all', minPay: undefined, beta: 'all', invite: 'all', timeField: 'contact', sort: 'pay_total', dir: 'desc', keyword: '' })
const range = ref(null)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const list = ref([])
const summary = ref(null)
const truncated = ref(false)
const loading = ref(false)
const now = Date.now()

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '—')
const fmtD = (ms) => (ms ? dayjs(ms).format('YY-MM-DD') : '—')
const yuan = (fen) => { const v = (Number(fen) || 0) / 100; return Number.isInteger(v) ? String(v) : v.toFixed(2) }
const priceTag = (s) => (!s ? 'info' : /划算/.test(s) ? 'success' : /接受/.test(s) ? 'primary' : /太贵/.test(s) ? 'danger' : 'warning') // el-tag 2.7 的 type 不能传空串

const load = async (p) => {
    if (p) page.value = p
    loading.value = true
    const params = { ...q, minPay: Number(q.minPay) || 0, page: page.value, size: size.value }
    if (range.value && range.value.length === 2 && range.value[0] && range.value[1]) { params.from = range.value[0].getTime(); params.to = range.value[1].getTime() }
    const r = await dramaApi('listBetaCandidates', params)
    loading.value = false
    if (!r || r.errMsg) { list.value = []; return ElMessage.error((r && r.errMsg) || '加载失败') }
    list.value = r.data.list || []
    total.value = r.data.total || 0
    summary.value = r.data.summary || null
    truncated.value = !!r.data.truncated
}
const reload = () => load(1)
const toggleDir = () => { q.dir = q.dir === 'desc' ? 'asc' : 'desc'; reload() }

/** 跟进标记:状态下拉或备注回车即保存,成功后只改本行不重拉 */
const setInvite = async (row, status, note) => {
    const r = await dramaApi('setBetaInvite', { user_id: row._id, status, note })
    if (!r || r.errMsg) return ElMessage.error((r && r.errMsg) || '保存失败')
    row.invite = { status: r.data.status, note: r.data.note, operator: r.data.operator, update_time: r.data.update_time }
    ElMessage.success('已保存')
}

onMounted(() => load(1))
</script>

<style lang="scss" scoped>
.bp {
    .filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;
        .fl { font-size: 13px; color: #606266; margin-left: 6px; }
    }
    .summary { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #606266; background: #f5f7fa; border-radius: 6px; padding: 8px 12px; margin: 4px 0 10px;
        b { color: #303133; font-size: 15px; &.ok { color: #67c23a; } }
        .warn { color: #e6a23c; }
        .hint { color: #c0c4cc; font-size: 12px; }
    }
    .who { display: flex; align-items: center; gap: 8px;
        .who-n { font-size: 13px; color: #303133; display: flex; align-items: center; }
    }
    .ct { display: flex; align-items: center; gap: 4px; font-size: 13px; line-height: 1.7;
        .ct-k { color: #909399; font-size: 12px; flex: 0 0 28px; white-space: nowrap; }
        b { color: #303133; font-weight: 600; user-select: all; word-break: break-all; }
    }
    .muted { font-size: 12px; color: #909399; line-height: 1.6; display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
    .pay { font-size: 15px; color: #67c23a; &.zero { color: #c0c4cc; } }
    .hot { color: #e6a23c; }
    .tags { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
    .fu { display: flex; align-items: center; gap: 6px; }
    :deep(.el-table .cell) { line-height: 1.4; }
}
</style>
