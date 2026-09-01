<template>
    <el-scrollbar v-loading="loading" class="home page">
        <view class="">
            采黎AI后台
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/copy/copy')">复制页</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/magic/magic')">微调页</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/bg/bg')">背景页</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/notice/notice')">公告模版</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/chat/chat')">聊天记录</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" type="primary" @click="goPage('/pages/migrate/migrate')">聊天迁移监控</el-button>
        </view>

        <el-radio-group v-model="tab" style="margin: 20px auto;">
            <el-radio-button :value="1">所有订单 （{{ orderCount }}）</el-radio-button>
            <el-radio-button :value="2">今日订单 （{{ todayOrderPayList.length }}）</el-radio-button>
            <el-radio-button :value="3">VIP （{{ vipCount }}）</el-radio-button>
        </el-radio-group>

        <el-radio-group v-if="tab <= 2" v-model="payTab" style="margin: 20px">
            <el-radio-button v-for="item in payEnumsList" :key="item.id" :value="item.id">{{ item.value }}</el-radio-button>
        </el-radio-group>

        <!-- 订单时间筛选：预设收进日期组件快捷面板；清空=全部(默认近150条) -->
        <div v-if="tab === 1" class="time-filter">
            <span class="tf-lb">下单时间</span>
            <el-date-picker
                v-model="orderRange"
                type="datetimerange"
                :shortcuts="orderShortcuts"
                :default-time="orderDefaultTime"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                value-format="x"
                clearable
                style="width:400px;"
                @change="getOrderList"
            />
            <span class="tf-hint">{{ orderRange && orderRange.length === 2 ? `当前区间共 ${orderCount} 单` : '清空 = 全部（默认近150条）' }}</span>
        </div>

        <template v-if="[1, 2].includes(tab)">
            <el-table v-if="(tab === 1 ? orderPayList : todayOrderPayList).length" :data="tab === 1 ? orderPayList : todayOrderPayList" border>
                <el-table-column prop="avatar" label="头像" align="center" min-width="40px">
                    <template #default="{ row }">
                        <div style="display: flex;justify-content: center">
                            <el-image v-if="row.user_id[0].avatar" :src="row.user_id[0].avatar" :preview-src-list="[row.user_id[0].avatar]" preview-teleported fit="contain" style="width: 40px;border-radius: 50%;" />
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="nickname" label="昵称" align="center" min-width="80px">
                    <template #default="{ row }">
                        <div style="">{{ row.user_id[0].nickname }}</div>
                    </template>
                </el-table-column>

                <el-table-column prop="gender" label="性别" align="center" min-width="60px">
                    <template #default="{ row }">
                        <div>
                            <el-tag type="primary">{{ genderEnums[row.user_id[0].gender] }}</el-tag>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="register_platform" label="注册来源" align="center" min-width="80px">
                    <template #default="{ row }">
                        <div>
                            <el-tag v-if="row.user_id[0].inviter_uid" type="primary" size="small">{{ row.user_id[0].inviter_uid === '6642bdad816a3f647e0578cc' ? '管理员': '用户' }}邀请</el-tag>
                            <el-tag v-else-if="row.user_id[0].register_platform" type="success" size="small">{{ platformEnums[row.user_id[0].register_platform] }}</el-tag>
                            <div v-else></div>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="title" label="标题" align="center" min-width="120px" />
                <el-table-column prop="type" label="类型" align="center" min-width="60px" :formatter="(e) => payEnums[e.type]" />
                <el-table-column prop="type" label="充值数量" align="center" min-width="80px" :formatter="(e) => (e.recharge_day || e.recharge_cb)" >
                    <template #default="{ row }">
                        <div>
                            <div v-if="row.type === 'vip'">{{ row.recharge_day }}天</div>
                            <div v-else-if=" row.type.includes('cb')">{{ row.recharge_cb }}个</div>
                            <div v-if="row.type === 'card'">{{ parseInt(row.recharge_card / 60) }}小时</div>
                            <div v-if="row.type === 'gift-bag'">1个</div>
                            <div v-else></div>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="total_fee" label="充值金额" align="center" min-width="80px" :formatter="(e) => e.total_fee / 100" />
                <el-table-column prop="osName" label="充值平台" align="center" min-width="80px" />

                <el-table-column prop="register_platform" label="订单状态" align="center" min-width="80px">
                    <template #default="{ row }">
                        <div>
                            <el-tag v-if="row.status === 1" type="primary" size="small">已付款</el-tag>
                            <el-tag v-else type="warning" size="small">未付款</el-tag>
                        </div>
                        <!-- 来源标签(09-01):source==='manual' 为后台手工到账的「手动单」,存量/小程序支付的单无 source 即「小程序订单」 -->
                        <div style="margin-top: 4px">
                            <el-tag v-if="row.source === 'manual'" type="danger" size="small" effect="plain" :title="manualTip(row)">手动单</el-tag>
                            <el-tag v-else type="info" size="small" effect="plain">小程序订单</el-tag>
                            <el-tag v-if="row.manual_error" type="danger" size="small" effect="dark" :title="row.manual_error" style="margin-left: 4px">到账失败</el-tag>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="paid_time" label="付款时间" align="center" min-width="80px" :formatter="(e) => e.paid_time ? dayjs(e.paid_time).format('MM-DD HH:mm:ss') : ''" />
                <el-table-column prop="create_time" label="创建时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />

                <el-table-column label="操作" align="center" min-width="250" fixed="right">
                    <template #default="{row}">
                        <el-button type="success" size="small" @click="copyId(row._id)">复制订单</el-button>
                        <el-button type="primary" size="small" @click="copyId(row.user_id[0]._id)">复制用户</el-button>
                        <el-button v-if="row.status !== 1" type="warning" size="small" @click="manualSettle(row)">手工到账</el-button>
                        <el-button type="danger" size="small" @click="deleteOrder(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </template>

        <template v-if="tab === 3">
            <el-table :data="vipList" border>
                <el-table-column prop="avatar" label="头像" align="center" min-width="40px">
                    <template #default="{ row }">
                        <div style="display: flex;justify-content: center">
                            <el-image v-if="row.avatar" :src="row.avatar" :preview-src-list="[row.avatar]" preview-teleported fit="contain" style="width: 40px;border-radius: 50%;" />
                        </div>

                    </template>
                </el-table-column>

                <el-table-column prop="nickname" label="昵称" align="center" min-width="80px" />

                <el-table-column prop="gender" label="性别" align="center" min-width="60px">
                    <template #default="{ row }">
                        <div>
                            <el-tag type="primary">{{ genderEnums[row.gender] }}</el-tag>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="register_platform" label="注册来源" align="center" min-width="80px">
                    <template #default="{ row }">
                        <div>
                            <el-tag v-if="row.inviter_uid" type="primary" size="small">{{ row.inviter_uid === '6642bdad816a3f647e0578cc' ? '管理员': '用户' }}邀请</el-tag>
                            <el-tag v-else-if="row.register_platform" type="success" size="small">{{ platformEnums[row.register_platform] }}</el-tag>
                            <div v-else></div>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="pay_total" label="充值金额" align="center" min-width="80px" :formatter="(e) => e.pay_total / 100" />
                <el-table-column prop="pay_count" label="充值次数" align="center" min-width="80px" />

                <el-table-column prop="register_platform" label="今日注册" align="center" min-width="80px">
                    <template #default="{ row }">
                        <div>
                            <el-tag v-if="dayjs(row.register_date).isSame(dayjs(), 'day')" type="primary" size="small">是</el-tag>
                            <el-tag v-else type="success" size="small">否</el-tag>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="last_login_date" label="最近登录时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.last_login_date).format('MM-DD HH:mm:ss')" />
                <el-table-column prop="vip_start_time" label="开始时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.vip_start_time).format('MM-DD HH:mm:ss')" />
                <el-table-column prop="vip_end_time" label="结束时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.vip_end_time).format('MM-DD HH:mm:ss')" />
                <el-table-column label="操作" align="center" min-width="100" fixed="right">
                    <template #default="{row}">
                        <el-button type="primary" size="small" @click="copyId(row._id)">复制用户</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </template>
    </el-scrollbar>
</template>

<script setup>
import {ref, onMounted, computed} from 'vue'
import {dayjs, ElMessage, ElMessageBox} from 'element-plus'
import {genderEnums, payEnums, platformEnums, payEnumsList} from "@/config/enums";
import {copyText} from "@/utils/common";
import {PAY_MANUAL_KEY} from "@/config/pay-manual";

const db = uniCloud.database()
const dbJQL = uniCloud.databaseForJQL()

const globalData = ref(getApp().globalData)
const goPage = (url) => uni.navigateTo({ url })

const tab = ref(1)
const payTab = ref('')

/* 订单时间筛选：区间 [fromMs,toMs]（value-format=x 字符串毫秒）；默认 null=全部(近150条)。预设收进日期组件快捷面板 */
const orderRange = ref(null)
/* 手动选日期时的默认时间：开始 00:00:00、结束 23:59:59 */
const orderDefaultTime = [new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)]
const orderShortcuts = [
    { text: '今天', value: () => [dayjs().startOf('day').toDate(), dayjs().endOf('day').toDate()] },
    { text: '昨天', value: () => [dayjs().subtract(1, 'day').startOf('day').toDate(), dayjs().subtract(1, 'day').endOf('day').toDate()] },
    { text: '近7天', value: () => [dayjs().subtract(6, 'day').startOf('day').toDate(), dayjs().endOf('day').toDate()] },
    { text: '近30天', value: () => [dayjs().subtract(29, 'day').startOf('day').toDate(), dayjs().endOf('day').toDate()] }
]
/* 把区间翻成 [from, to] 毫秒；未选返回 null(保持默认近150条) */
const orderTimeSpan = () => {
    if (orderRange.value && orderRange.value.length === 2) return [Number(orderRange.value[0]), Number(orderRange.value[1])]
    return null
}

const orderCount = ref(0)
const orderList = ref([])
const todayOrderList = ref([])

const vipCount = ref(0)
const vipList = ref([])
const useVipList = ref([])

const loading = ref(false)

const getOrderList = async () => {
    if (tab.value === 3) return

    loading.value = true

    /* 时间区间：选了则按 create_time 过滤并放宽到 500 条覆盖区间；未选保持默认近 150 条 */
    const span = orderTimeSpan()
    let ordersCol = dbJQL.collection('orders')
    if (span) ordersCol = ordersCol.where(`create_time >= ${span[0]} && create_time <= ${span[1]}`)
    const orders = ordersCol.getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系
    const users = dbJQL.collection('users').getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系
    const { data, count } = await dbJQL.collection(orders, users).orderBy('create_time desc').limit(span ? 500 : 150).get({ getCount: true })
    loading.value = false
    if (!data) return

    orderList.value = data || []
    orderCount.value = count || 0
    todayOrderList.value = orderList.value.filter(i => dayjs(i.create_time).isSame(dayjs(), 'day') && i.status === 1)
}

const orderPayList = computed(() => {
    if (!payTab.value) return orderList.value

    return orderList.value.filter(i => i.type === payTab.value)
})

const todayOrderPayList = computed(() => {
    if (!payTab.value) return todayOrderList.value

    return todayOrderList.value.filter(i => i.type === payTab.value)
})

const getVipList = async () => {
    loading.value = true
    const { result: { data, count } } = await db.collection('users').where(`vip_end_time > ${dayjs().valueOf()}`).orderBy('vip_start_time desc').limit(500).get({ getCount: true })
    loading.value = false

    if (!data) return
    vipList.value = data || []
    vipCount.value = count || 0
}

const copyId = async (text) => {
    const data = await copyText(text).catch(() => ({}))
    uni.showToast({ title: data ? '复制成功' : '复制失败', icon: 'none' })
}

/**
 * 手工到账(09-01 黎令,支付封禁期):用户线下转账后,对未付款单按下单商品原样发货并打「手动单」。
 * 发货逻辑不在后台:pay-manual 云对象原子翻单后调 pay-v2.paySuccess(线上唯一一份发货代码);同一单第二次点会被云端挡住。
 */
const payManual = uniCloud.importObject('pay-manual', { customUI: true })
const manualTip = (row) => `操作人 ${row.operator || ''} · ${row.manual_time ? dayjs(row.manual_time).format('MM-DD HH:mm') : ''}${row.manual_remark ? ' · ' + row.manual_remark : ''}`
const manualSettle = async (row) => {
    const user = (row.user_id && row.user_id[0]) || {}
    const r = await ElMessageBox.prompt(
        `用户「${user.nickname || user._id || ''}」· ${row.title || ''} · ¥${(row.total_fee || 0) / 100}，确认已线下收到款，按小程序下单内容原样发货？`,
        '手工到账',
        { confirmButtonText: '确认到账', cancelButtonText: '取消', inputPlaceholder: '备注:转账方式/流水号(选填)', inputPattern: /^[\s\S]{0,100}$/, inputErrorMessage: '备注不超过 100 字' }
    ).catch(() => null)
    if (!r || r.action !== 'confirm') return

    const res = await payManual.settle({ key: PAY_MANUAL_KEY, operator: globalData.value.name, orderId: row._id, remark: r.value || '' }).catch(e => ({ errMsg: e.message }))
    if (!res || res.errMsg) return ElMessage.error((res && res.errMsg) || '手工到账失败')

    const u = res.data.user || {}
    ElMessage.success(`已到账并发货:${u.nickname || ''} 付费采贝 ${u.cb_pay_num ?? '-'} · 会员至 ${u.vip_end_time ? dayjs(u.vip_end_time).format('MM-DD') : '无'}`)
    await getOrderList()
}

const deleteOrder = async (row) => {
    if (row.status === 1) {
        const data = await ElMessageBox.confirm('该订单那已付款，确定删除吗?', '删除订单', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }).catch(() => '')

        if (data !== 'confirm') return
    }

    await dbJQL.collection('orders').doc(row._id).remove();
    ElMessage.success('删除成功')

    await getOrderList()
}

onMounted(async () => {
    await getOrderList()
    await getVipList()
})
</script>

<style lang="scss" scoped>
.home {

}
.time-filter {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 20px 10px;
    .tf-lb { font-size: 13px; color: #606266; margin-right: 6px; }
    .tf-hint { font-size: 12px; color: #909399; margin-left: 12px; }
}
</style>
