<template>
    <el-scrollbar v-loading="loading" class="chat bg">
        <el-table :data="list" border>
            <el-table-column prop="avatar" label="头像" align="center" min-width="30px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.user_avatar" :src="row.user_avatar" :preview-src-list="[row.user_avatar]" preview-teleported fit="contain" style="width: 30px;border-radius: 50%;" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="user_name" label="用户昵称" align="center" min-width="60px" />
            <el-table-column prop="role_name" label="角色名称" align="center" min-width="60px" />

            <el-table-column prop="avatar" label="背景" align="center" width="80px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.img" :src="row.img" :preview-src-list="[row.img]" preview-teleported fit="contain" style="border-radius: 4px;" />
                    </div>
                </template>
            </el-table-column>


            <el-table-column prop="create_time" label="上传时间" align="center" min-width="60px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
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
import {montageImgUrl} from "@/utils/common";

const db = uniCloud.database()

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 50, total: 0 })
const list = ref([])

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize
    loading.value = true
    const { result: { data, count } } = await db.collection('users_img').skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount:true })
    loading.value = false

    if (!data) return

    list.value = (data || []).map(i => ({ ...i, img: montageImgUrl(i.img, 300) }))
    listParams.total = count

}

const changePage = async (e) => {
    await getList()
}

onMounted(async () => await getList())
</script>

<style lang="scss" scoped>
.bg {
}
</style>
