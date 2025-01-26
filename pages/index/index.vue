<template>
    <el-scrollbar v-loading="loading" class="home page">
        <view class="">
            采黎AI后台
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/copy/copy')">复制页</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/magic/magic')">微调页</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/bg/bg')">背景页</el-button>
            <el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/notice/notice')">公告模版</el-button>
        </view>

        <el-radio-group v-model="tab" style="margin: 20px auto;">
            <el-radio-button :value="1">所有订单 （{{ orderCount }}）</el-radio-button>
            <el-radio-button :value="2">今日订单 （{{ todayOrderPayList.length }}）</el-radio-button>
            <el-radio-button :value="3">VIP （{{ vipCount }}）</el-radio-button>
        </el-radio-group>

        <el-radio-group v-if="tab <= 2" v-model="payTab" style="margin: 20px">
            <el-radio-button v-for="item in payEnumsList" :key="item.id" :value="item.id">{{ item.value }}</el-radio-button>
        </el-radio-group>

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
                    </template>
                </el-table-column>

                <el-table-column prop="paid_time" label="付款时间" align="center" min-width="80px" :formatter="(e) => e.paid_time ? dayjs(e.paid_time).format('MM-DD HH:mm:ss') : ''" />
                <el-table-column prop="create_time" label="创建时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />

                <el-table-column label="操作" align="center" min-width="160" fixed="right">
                    <template #default="{row}">
                        <el-button type="success" size="small" @click="copyId(row._id)">复制订单</el-button>
                        <el-button type="primary" size="small" @click="copyId(row.user_id[0]._id)">复制用户</el-button>
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

const db = uniCloud.database()
const dbJQL = uniCloud.databaseForJQL()

const globalData = ref(getApp().globalData)
const goPage = (url) => uni.navigateTo({ url })

const tab = ref(1)
const payTab = ref('')

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

    const orders = dbJQL.collection('orders').getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系
    const users = dbJQL.collection('users').getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系
    const { data, count } = await dbJQL.collection(orders, users).orderBy('create_time desc').limit(150).get({ getCount: true })
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
</style>
