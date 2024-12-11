<template>
    <el-scrollbar v-loading="loading" class="roles page">
        <el-radio-group v-model="tab" style="padding-bottom: 10px" @change="getList">
            <el-radio-button :value="0">最热</el-radio-button>
            <el-radio-button :value="1">今日</el-radio-button>
            <el-radio-button :value="2">最新</el-radio-button>
            <el-radio-button :value="3">重复词</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="gender" style="padding-bottom: 10px;margin-left: 10px;" @change="getList">
            <el-radio-button :value="''">全部</el-radio-button>
            <el-radio-button :value="1">男</el-radio-button>
            <el-radio-button :value="2">女</el-radio-button>
            <el-radio-button :value="0">未分类</el-radio-button>
        </el-radio-group>

        <view v-if="tab === 3" style="margin: 12px;">
            <el-button type="danger" :disabled="!selectList.length" style="margin-right: 12px" @click="deleteWords">批量删除</el-button>
        </view>

        <el-table class="roles-table" :data="list" border @selection-change="selectionChange">
            <el-table-column type="selection" label="排序" align="center" width="60px" />
            <el-table-column type="index" label="排序" align="center" width="60px" />
            <el-table-column prop="content" label="搜索内容" align="center" min-width="200px" />
            <el-table-column prop="content" label="分类" align="center" min-width="150px" >
                <template #default="{ row }">
                    <el-radio-group v-model="row.sex" @change="setWordSex($event, row)">
                        <el-radio v-for="item in genderEnumsList" :key="item.id" :value="Number(item.id)">{{ item.value }}</el-radio>
                    </el-radio-group>
                </template>

            </el-table-column>
            <el-table-column prop="count" label="热度" align="center" min-width="80px" />
            <el-table-column prop="today_count" label="今日热度" align="center" min-width="80px" />
            <el-table-column prop="update_time" label="更新时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.update_time).format('MM-DD HH:mm:ss')" />
            <el-table-column prop="create_time" label="创建时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
            <el-table-column label="操作" align="center" width="120" fixed="right">
                <template #default="{row}">
                    <el-button type="danger" @click="deleteWords([row])" size="small">删除</el-button>
                </template>
            </el-table-column>
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
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { genderEnumsList } from "@/config/enums";

/* 传统数据库集合 */
const db = uniCloud.database()
const dbCmd = db.command
const searchsDb = db.collection('searchs')

const tab = ref(2)
const gender = ref('')

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 20, total: 0 })
const list = ref([])

const selectList = ref([])
const selectionChange = (e) => (selectList.value = e)

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize

    const whereObj = {
        category: db.command.neq('null')
    }

    if ((gender.value ?? '') !== '') whereObj.sex = gender.value

    let res = {}

    loading.value = true

    if (tab.value === 0) {
        res = await searchsDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('count desc').get({ getCount:true })
    } else if (tab.value === 1) {
        res = await searchsDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('today_count desc').get({ getCount:true })
    } else if (tab.value === 2) {
        res = await searchsDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('update_time desc').get({ getCount:true })
    } else if (tab.value === 3) {
        /* 查到重复列 */
        const repeatRes = await searchsDb.aggregate().group({ _id: '$content', count: { $sum: 1 } }).sort({ count: -1 }).match({count: { $gt: 1 } }).end();

        const repeatArr = repeatRes.result.data.map(i => (i._id))

        let repeatList = []

        for (const content of repeatArr) {
            whereObj.content = content
            const { result: { data } } = await searchsDb.where(whereObj).limit(500).orderBy('create_time asc').get()
            repeatList.push(...data)
        }

        res = { result: { data: repeatList, count: repeatList.length } }
    }

    loading.value = false

    if (!res.result) return

    const data = res.result.data || []
    const count = res.result.count || 0

    list.value = data
    listParams.total = count
}

const changePage = async (e) => {
    await getList()
}

const setWordSex = async (sex, row) => {
    console.log(sex, row)
    await searchsDb.doc(row._id).update({ sex })
    // await getList()
}

const deleteWords = (list = []) => {
    const ids = (list.length ? list : selectList.value).map(i => i._id)

    ElMessageBox.confirm('确定删除吗?', '删除搜索词', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    .then(async () => {
        /* 批量删除 */
        await searchsDb.where({ _id: dbCmd.in(ids) }).remove()
        ElMessage.success('删除成功')
        await getList()
    })

}

onMounted(async () => {
    await getList()
})
</script>

<style lang="scss" scoped>
.roles {
    .roles-table {
        :deep .el-text {
            font-size: 12px;
        }

        :deep .el-tag {
            padding: 0 6px;
            margin: 4px 2px !important;
        }
    }

    .tag {
        width: 36px;
        height: 20px;
        border-radius: 4px;

        &.tag-1 {
            background: linear-gradient(180deg, #FFFFFF 0%, #E7D4FF 100%);
        }

        &.tag-2 {
            background: linear-gradient(180deg, #FFFFFF 0%, #FFF8C6 100%);
        }


        &.tag-3 {
            background: linear-gradient(180deg, #FFFFFF 0%, #CDE1FD 100%);
        }

        &.tag-4 {
            background: linear-gradient(180deg, #FFFFFF 0%, #FFD7ED 100%);
        }

    }

    :deep .dialog {
        .el-radio {
            margin-right: 18px;
        }
    }
}

:deep .audio_center,
:deep .audio {

    .audio_center_cover {
        width: 30px;
        margin-right: 0;
        height: auto;

        .icon-play-cell {
            font-size: 22px !important;
            line-height: 1;
        }
    }

    .audio_center_right {
        .single {
            padding: 4px;

            .single_title_info {
                font-size: 13px;
            }

            .single_title {
                margin: 0;
                line-height: 1.2rem;

                .single_title_info {
                    font-size: 12px;
                }
            }

            .tips {
                display: none;
            }

            > uni-slider {
                display: none;
            }
        }
    }
}
</style>


