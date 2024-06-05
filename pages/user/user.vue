<template>
    <el-scrollbar v-loading="loading" class="user page">
        <el-table :data="list" border>
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

            <el-table-column prop="register_platform" label="今日注册" align="center" min-width="80px">
                <template #default="{ row }">
                    <div>
                        <el-tag v-if="dayjs(row.register_date).isSame(dayjs(), 'day')" type="primary" size="small">是</el-tag>
                        <el-tag v-else type="success" size="small">否</el-tag>
                    </div>
                </template>
            </el-table-column>

            <el-table-column prop="login_count" label="登录次数" align="center" min-width="80px" sortable :formatter="(e) => e.login_count ? e.login_count : ''" />

            <el-table-column prop="sign_count" label="签到次数" align="center" min-width="60px" sortable :formatter="(e) => e.sign_count ? e.sign_count : ''" />

            <el-table-column prop="video_ad_count" label="视频次数" align="center" min-width="60px" sortable :formatter="(e) => e.video_ad_count || ''" />

            <el-table-column prop="last_login_date" label="登录时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.last_login_date).format('MM-DD HH:mm:ss')" />
            <el-table-column prop="register_date" label="注册时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.register_date).format('MM-DD HH:mm:ss')" />
        </el-table>
        <view class="pagination">
            <el-pagination
                    v-model:currentPage="listParams.pageNo"
                    v-model:page-size="listParams.pageSize"
                    :total="listParams.total"
                    @size-change="changePage(1, $event)"
                    @current-change="changePage" :page-sizes="[10, 20, 50, 100, 200, 500]"
                    :layout="'total, sizes, prev, pager, next'"
                    small
            />
        </view>
    </el-scrollbar>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { dayjs } from 'element-plus'
import { genderEnums, platformEnums } from "@/config/enums";

const db = uniCloud.database()

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 50, total: 0 })
const list = ref([])

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize
    loading.value = true
    const { result: { data, count } } = await db.collection('users').skip(start).limit(listParams.pageSize).orderBy('last_login_date desc').get({ getCount:true })
    loading.value = false

    if (!data) return
    list.value = data || []
    listParams.total = count

}

const changePage = async (e) => {
    await getList()
}

onMounted(async () => await getList())
</script>

<style lang="scss" scoped>
.home {

}
</style>
