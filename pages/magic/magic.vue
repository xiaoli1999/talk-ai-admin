<template>
    <el-scrollbar v-loading="loading" class="chat page">
        <el-table :data="list" border>
            <el-table-column prop="avatar" label="头像" align="center" min-width="30px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.user_avatar" :src="row.user_avatar" :preview-src-list="[row.user_avatar]" preview-teleported fit="contain" style="width: 30px;border-radius: 50%;" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="user_nickname" label="昵称" align="center" min-width="60px" />
            <el-table-column prop="type" label="类型" align="center" min-width="60px">
                <template #default="{ row }">
                    <div>
                       <el-tag v-if="!row.type" type="primary">智能体</el-tag>
                       <el-tag v-else-if="row.type === 'roles'" type="success">角色</el-tag>
                       <el-tag v-else-if="row.type === 'works'" type="info">助手</el-tag>
                        <div v-else></div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="name" label="name" align="center" min-width="60px" />
            <el-table-column prop="prompt" label="prompt" align="center" min-width="200px" >
                <template #default="{ row }">
                    <div style="text-align: left;">
                        <div v-for="(item, index) in row.chatList" :key="index">
                            <p>{{ item }}</p>
                            <p v-if="row.chatList.length > 1 && (index !== row.chatList.length - 1)" style="margin: 8px 0 ;border-bottom: 1px dashed #dfdfdf;"></p>
                        </div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="create_time" label="微调时间" align="center" min-width="60px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
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
    const { result: { data, count } } = await db.collection('users_prompt').skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount:true })
    loading.value = false

    if (!data) return
    list.value = (data || []).map(i => ({ ...i, chatList: i.prompt.split('\n') }))
    listParams.total = count

}

const changePage = async (e) => {
    await getList()
}

onMounted(async () => await getList())
</script>

<style lang="scss" scoped>
.chat {
    pre {
        font-family: auto !important;
    }
}
</style>
