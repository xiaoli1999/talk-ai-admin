<template>
    <el-scrollbar v-loading="loading" class="chat page">
        <el-table :data="list" border>
            <el-table-column prop="avatar" label="头像" align="center" min-width="30px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.avatar" :src="row.avatar" :preview-src-list="[row.avatar]" preview-teleported fit="contain" style="width: 30px;border-radius: 50%;" />
                    </div>

                </template>
            </el-table-column>
            <el-table-column prop="nickname" label="昵称" align="center" min-width="80px" />
            <el-table-column prop="content" label="内容" align="center" min-width="160px" />
            <el-table-column prop="create_time" label="对话时间" align="center" min-width="60px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
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

const db = uniCloud.database()

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 50, total: 0 })
const list = ref([])

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize
    loading.value = true
    const { result: { data, count } } = await db.collection('chats').skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount:true })
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
.chat {

}
</style>
