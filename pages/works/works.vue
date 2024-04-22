<template>
    <el-scrollbar v-loading="loading" class="works page">
        <view>
            <el-button type="primary" @click="openWorkDialog(null)">新增</el-button>
        </view>
        <el-table :data="list" border>
            <el-table-column prop="avatar" label="头像" align="center" min-width="30px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.avatar" :src="row.avatar" :preview-src-list="[row.avatar]" fit="contain" style="width: 30px;border-radius: 50%;" />
                    </div>

                </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" align="center" min-width="80px" />
            <el-table-column prop="content" label="内容" align="center" min-width="160px" />
            <el-table-column prop="create_time" label="对话时间" align="center" min-width="60px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
            <el-table-column label="操作" align="center" min-width="180" fixed="right">
                <template #default="{row}">
                    <el-button type="primary" @click="openWorkDialog(row)">修改</el-button>
                    <el-button type="danger" @click="deleteWork(row._id)">删除</el-button>
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

        <el-dialog class="order-dialog" v-model="workShow" width="680px" :title="workData._id ? '新增应用' : '修改应用'" align-center draggable>
            <el-form ref="workRef" class="work-form" :model="workData" :rules="workRules" label-width="100px">
                <el-form-item label="名称" prop="name">
                    <el-input v-model="workData.name" :maxlength="10" placeholder="请输入应用名称" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="分类" prop="category_id">
                    <el-select v-model="workData.category_id" placeholder="请选择应用分类" :disabled="workData._id && workData.category_id === 'null'" clearable>
                        <el-option v-for="item in []" :key="item._id" :label="item.name" :value="item._id" />
                        <el-option label="一级分类" value="null" />
                    </el-select>
                </el-form-item>
                <el-form-item label="图片" prop="avatar">
                    <div style="width: 50px;height: 50px;border: 1px dashed #eee; display: flex;justify-content: center;align-items: center;">
                        <el-image v-if="workData.avatar" :src="workData.avatar" fit="contain" style="width: 50px;border-radius: 50%;" />
                        <div v-else style="font-size: 24px;color: #eee;">+</div>
                        <button @click="uploadImg" style="position: absolute;width: 100%;height: 100%; z-index: 10000;inset: 0;opacity: 0" />
                    </div>
                </el-form-item>
                <el-form-item label="简介" prop="desc">
                    <el-input type="textarea" v-model="workData.desc" :rows="3" :maxlength="200" placeholder="请输入应用简介" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="提示词" prop="prompt">
                    <el-input type="textarea" v-model="workData.prompt" :rows="3" :maxlength="200" placeholder="请输入应用提示词" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="引导语" prop="desc">
                    <el-input v-model="workData.guide_list[0]" :maxlength="100" placeholder="请输入应用引导语1" clearable show-word-limit style="margin-bottom: 8px;" />
                    <el-input v-model="workData.guide_list[1]" :disabled="!workData.guide_list[0]" :maxlength="100" placeholder="请输入应用引导语2" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="排序" prop="sort">
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
import { createAvatarKey } from '../../utils/common'

/* 传统数据库集合 */
const db = uniCloud.database()
const worksDb = db.collection('works')

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 50, total: 0 })
const list = ref([])

const workDataDefault = () => ({
    category_id: 'null',
    sort: 0,
    show: true,
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
    name: [{ required: true, message: '请填写名称', trigger: 'change' }],
    category_id: [{ required: true, message: '请选择分类', trigger: 'change' }],
    desc: [{ required: true, message: '请填写简介', trigger: 'change' }],
    prompt: [{ required: true, message: '请填写提示词', trigger: 'change' }],
    guide_list: [{ required: true, message: '请填写引导语', trigger: 'change' }, { validator: (r, v, cb) => v === v.length !== 2 ? cb(new Error('请填写引导语')) : cb(), trigger: 'change' }],
})

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize
    loading.value = true
    const { result: { data, count } } = await worksDb.skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount:true })
    loading.value = false

    if (!data) return
    list.value = data || []
    listParams.total = count

}

const changePage = async (e) => {
    await getList()
}

const openWorkDialog = (row) => {
    workShow.value = true
    workData.value = row ? row : workDataDefault()
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

    /* 更新时间,多加10s */
    params.update_time = dayjs().add(10, 'second').valueOf()

    const { errMsg } = id ? await worksDb.doc(id).update(params).catch(e => e) : await worksDb.add(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    ElMessage.success('更新成功')

    workShow.value = false

    await getList()
}

const deleteWork = (id) => {

    ElMessageBox.confirm('确定删除吗?', 'Warning', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
            .then(async () => {
                await worksDb.doc(id).remove();
                ElMessage.success('删除成功')
                await getList()
            })

}

onMounted(async () => await getList())
</script>

<style lang="scss" scoped>
.works {
    min-height: 100vh;
}
</style>
