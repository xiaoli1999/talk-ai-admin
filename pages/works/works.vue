<template>
    <el-scrollbar v-loading="loading" class="works page">
        <view v-if="isAdmin" style="margin: 20px;">
            <el-button type="primary" @click="openWorkDialog(null)">新增应用</el-button>
        </view>
        <el-table class="works-table" :data="list" row-key="_id" :tree-props="{ children: 'children' }" default-expand-all border size="small">
            <el-table-column label="" width="50px" align="center" />
            <el-table-column prop="sort" label="排序" align="center" width="60px" />
            <el-table-column prop="avatar" label="头像" align="center" min-width="60px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.avatar" :src="row.avatar" :preview-src-list="[row.avatar]" preview-teleported fit="contain" style="width: 30px;border-radius: 50%;" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" align="center" min-width="100px" />
            <el-table-column prop="category_id" label="分类" align="center" min-width="100px">
                <template #default="{ row }">
                    <div>
                        <el-tag>{{ categoryObj[row.category_id] || row.name }}</el-tag>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="desc" label="简介" align="center" min-width="160px">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="max-width: 300px;">{{ row.desc }}</div>
                        </template>
                        <el-text truncated>{{ row.desc }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
            <el-table-column prop="prompt" label="提示词" align="center" min-width="160px">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="max-width: 300px;">{{ row.prompt }}</div>
                        </template>
                        <el-text truncated>{{ row.prompt }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
            <el-table-column prop="guide_list" label="引导语" align="center" min-width="160px">
                <template #default="{ row }">
                    <div style="text-align: left">
                        <div v-for="(item, index) in row.guide_list" :key="index">{{ item }}</div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="show" label="启用" align="center" width="80px">
                <template #default="{ row }">
                    <div>
                        <el-switch v-model="row.show" :disabled="true" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="hot_count" label="热度" align="center" min-width="60px" />
            <el-table-column prop="talk_count" label="对话" align="center" min-width="60px" />
            <el-table-column prop="update_time" label="更新时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
            <el-table-column prop="create_time" label="注册时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
            <el-table-column label="操作" align="center" width="130" fixed="right">
                <template #default="{row}">
                    <el-button type="primary" @click="openWorkDialog(row)" size="small">修改</el-button>
                    <el-button v-if="isAdmin" type="danger" @click="deleteWork(row)" size="small">删除</el-button>
                </template>
            </el-table-column>
        </el-table>

        <!--        <view class="pagination">-->
        <!--            <el-pagination-->
        <!--                    v-model:currentPage="listParams.pageNo"-->
        <!--                    v-model:page-size="listParams.pageSize"-->
        <!--                    :total="listParams.total"-->
        <!--                    @size-change="changePage(1, $event)"-->
        <!--                    @current-change="changePage" :page-sizes="[10, 20, 50, 100, 200, 500]"-->
        <!--                    :layout="'total, sizes, prev, pager, next'"-->
        <!--                    small-->
        <!--            />-->
        <!--        </view>-->

        <el-dialog class="dialog" v-model="workShow" width="680px" :title="workData._id ? '修改应用' : '新增应用'" align-center draggable>
            <el-form ref="workRef" class="work-form" :model="workData" :rules="workRules" label-width="100px" :disabled="!isAdmin">
                <el-form-item label="应用名称" prop="name">
                    <el-input v-model="workData.name" :maxlength="10" placeholder="请输入应用名称" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="应用分类" prop="category_id">
                    <el-select v-model="workData.category_id" placeholder="请选择应用分类" :disabled="workData._id && workData.category_id === 'null' && workData.children.length" clearable>
                        <el-option v-for="item in categoryList" :key="item._id" :label="item.name" :value="item._id" />
                        <el-option label="一级分类" value="null" />
                    </el-select>
                </el-form-item>
                <el-form-item label="应用图片" prop="avatar">
                    <div style="position: relative;width: 50px;height: 50px;padding: 4px; border: 1px dashed #DCDFE6; display: flex;justify-content: center;align-items: center;">
                        <img v-if="workData.avatar" :src="workData.avatar" style="width: 100%; max-width: 50px;max-height: 50px;object-fit: contain;border-radius: 50%;" alt=""/>
                        <div v-else style="font-size: 24px;color: #DCDFE6;">+</div>
                        <button @click="uploadImg" style="position: absolute;width: 100%;height: 100%; z-index: 2000;inset: 0;opacity: 0" />
                        <div v-show="workData.avatar" class="del-btn" @click="workData.avatar = ''">❌︎</div>
                    </div>
                </el-form-item>
                <el-form-item label="应用简介" prop="desc">
                    <el-input type="textarea" v-model="workData.desc" :rows="3" :maxlength="100" placeholder="请输入应用简介" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="应用提示词" prop="prompt">
                    <el-input type="textarea" v-model="workData.prompt" :rows="3" :maxlength="100" placeholder="请输入应用提示词" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="应用引导语" prop="guide_list">
                    <el-input v-model="workData.guide_list[0]" :maxlength="30" placeholder="请输入应用引导语1" clearable show-word-limit style="margin-bottom: 8px;" />
                    <el-input v-model="workData.guide_list[1]" :maxlength="30" placeholder="请输入应用引导语2" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="应用排序" prop="sort">
                    <el-input-number v-model="workData.sort" :min="0" :max="1000" :precision="0" :step="1" controls-position="right" />
                </el-form-item>
                <el-form-item label="是否启用" prop="show">
                    <el-switch v-model="workData.show" />
                </el-form-item>
            </el-form>

            <template #footer>
                <div class="pb-[12px]">
                    <el-button type="info" plain @click="workShow = false">取消</el-button>
                    <el-button class="!ml-[14px]" type="primary" @click="saveWork">确认</el-button>
                </div>
            </template>
        </el-dialog>
    </el-scrollbar>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import {createAvatarKey, listToTree} from '../../utils/common'

/* 传统数据库集合 */
const db = uniCloud.database()
const worksDb = db.collection('works')

/* 权限 */
const globalData = ref(getApp().globalData)
const isAdmin = ref(globalData.value.name === 'xiaoli')

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 50, total: 0 })
const list = ref([])
const categoryList = ref([])
const categoryObj = ref([])

const workDataDefault = () => ({
    category_id: 'null',
    sort: 0,
    show: false,
    name: '',
    desc: '',
    avatar: '',
    prompt: '',
    guide_list: [],
    hot_count: 0,
    talk_count: 0,
    update_time: ''
})
const workShow = ref(false)
const workData = ref(workDataDefault())

const workRef = ref();
const workRules = reactive({
    name: [{ required: true, message: '请填写应用名称', trigger: 'change' }],
    category_id: [{ required: true, message: '请选择应用分类', trigger: 'change' }],
    desc: [{ required: true, message: '请填写应用简介', trigger: 'change' }],
    prompt: [{ required: true, message: '请填写应用提示词', trigger: 'change' }],
    guide_list: [{ validator: (r, v, cb) => !(v[0] && v[1]) ? cb(new Error('请填写应用引导语')) : cb(), trigger: 'change' }],
})

const getList = async () => {
    // const start = (listParams.pageNo - 1) * listParams.pageSize
    loading.value = true
    const { result: { data, count } } = await worksDb.orderBy('create_time desc').get({ getCount:true })
    loading.value = false

    if (!data) return
    list.value = listToTree(data)
    listParams.total = count

    categoryList.value = []
    categoryObj.value = {}
    list.value.forEach(i => {
        categoryList.value.push({ _id: i._id, name: i.name })
        categoryObj.value[i._id] = i.name
    })

}

const changePage = async (e) => {
    await getList()
}

const openWorkDialog = (row) => {
    workShow.value = true
    workData.value = row ? JSON.parse(JSON.stringify(row)) : workDataDefault()
    setTimeout(() => workRef.value.clearValidate())
}

const uploadImg = (e) => {
    uni.chooseImage({
        count: 1, //默认9
        sizeType: ['original'], //可以指定是原图还是压缩图，默认二者都有
        sourceType: ['album'], //从相册选择
        success: function (res) {
            const filePath = res.tempFilePaths[0]
            const file = res.tempFiles[0]

            uni.showLoading({ title: '头像上传中' })
            const suffix = file.name.split('.').pop()
            const cloudPath = `/img/works/${createAvatarKey()}.${ suffix }`

            uniCloud.uploadFile({
                filePath,
                cloudPath,
                cloudPathAsRealPath: true,
                success: (res) => {
                    workData.value.avatar = res.fileID
                },
                complete: () => uni.hideLoading()
            });
        }
    });
}

const saveWork = async () => {
    if (!workRef.value) return;
    const valid = await workRef.value.validate().catch(() => ({}));
    if (valid !== true) return ElMessage.warning('请填写信息')

    const params = JSON.parse(JSON.stringify(workData.value))
    const id = params._id
    delete params._id
    delete params.children

    /* 更新时间,多加10s */
    params.update_time = dayjs().add(10, 'second').valueOf()

    const { errMsg } = id ? await worksDb.doc(id).update(params).catch(e => e) : await worksDb.add(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    ElMessage.success('更新成功')

    workShow.value = false

    await getList()
}

const deleteWork = ({ children, _id }) => {
    if (children.length) return ElMessage.warning('该分类下还有其他应用，禁止删除！')

    ElMessageBox.confirm('确定删除吗?', '删除应用', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
            .then(async () => {
                await worksDb.doc(_id).remove();
                ElMessage.success('删除成功')
                await getList()
            })

}

onMounted(async () => await getList())
</script>

<style lang="scss" scoped>
.works {
    min-height: 100vh;

    .works-table {
        :deep .el-text {
            font-size: 12px;
        }
    }
}
</style>
