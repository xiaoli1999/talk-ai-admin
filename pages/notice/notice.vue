<template>
	<view v-loading="loading" class="page notice">
        <el-button type="primary" @click="openHtmlDialog(null)" style="margin-bottom: 10px">新增公告模版</el-button>
        <el-table :data="list" border>

            <el-table-column prop="title" label="标题" align="center" min-width="80px" />

            <el-table-column prop="type" label="类型" align="center" min-width="60px">
                <template #default="{ row }">
                    <div>
                        <el-tag type="primary">{{ htmlEnums[row.type] }}</el-tag>
                    </div>
                </template>
            </el-table-column>

            <el-table-column prop="content" label="提示词" align="center" min-width="140px">
                <template #default="{ row }">
                    <div>
                        {{ row.content.slice(0, 50) }}
                    </div>
                </template>
            </el-table-column>

            <el-table-column prop="show" label="是否启用" align="center" width="100px">
                <template #default="{ row }">
                    <div>
                        <el-switch v-model="row.use" :disabled="true" size="small" />
                    </div>
                </template>
            </el-table-column>
            <!--            <el-table-column prop="update_time" label="更新时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />-->
            <el-table-column prop="create_time" label="创建时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />

            <el-table-column label="操作" align="center" width="200" fixed="right">
                <template #default="{row}">
                    <el-button type="primary" @click="openHtmlDialog(row)" size="small">修改</el-button>
                    <el-button type="danger" @click="deleteHtml(row)" size="small">删除</el-button>
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

        <el-dialog class="dialog" v-model="htmlShow" width="1500px" :title="htmlData._id ? '修改模版' : '新增模版'" align-center draggable>
            <el-form ref="htmlRef" class="html-form" :model="htmlData" :rules="htmlRules" label-width="80px">
                <div style="display: flex;">
                    <el-form-item label="标题" prop="title">
                        <el-input v-model="htmlData.title" :maxlength="20" placeholder="请输入标题" clearable show-word-limit />
                    </el-form-item>

                    <el-form-item label="类型" prop="type">
                        <el-select v-model="htmlData.type" placeholder="请选择类型" clearable style="width: 120px;">
                            <el-option v-for="item in htmlEnumsList" :key="item.id" :label="item.value" :value="item.id" />
                        </el-select>
                    </el-form-item>

                    <el-form-item label="暗黑主题" prop="use">
                        <el-switch v-model="htmlLite" />
                    </el-form-item>

                    <el-form-item label="启用" prop="use">
                        <el-switch v-model="htmlData.use" />
                    </el-form-item>
                </div>

                <el-form-item label="内容" prop="content">
                    <div class="html-editor" :class="htmlLite ? 'black' : '' ">
                        <sv-wangeditor ref="editorRef" v-model:html="htmlData.content" mode="default"  @save="saveEditor" />
                    </div>
                </el-form-item>
            </el-form>

            <template #footer>
                <div class="pb-[12px]">
                    <el-button type="info" plain @click="htmlData = false">取消</el-button>
                    <el-button class="!ml-[14px]" type="primary" @click="saveHtml">确认</el-button>
                </div>
            </template>
        </el-dialog>

	</view>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from "element-plus";
import { htmlEnums, htmlEnumsList } from "@/config/enums";


const db = uniCloud.database()
const HtmlsDb = db.collection('htmls')
const dbCmd = db.command


const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 10, total: 0 })
const list = ref([])

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize
    loading.value = true
    const { result: { data, count } } = await HtmlsDb.skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount:true })
    loading.value = false

    if (!data) return
    list.value = data || []
    listParams.total = count

}

const changePage = async (e) => {
    await getList()
}


/**
 * 修改
 */

const htmlDataDefault = () => ({
    title: '',
    type: '',
    content: '',
    use: false,
    create_time: '',
})

const htmlData = ref(htmlDataDefault())

const htmlShow = ref(false)
const htmlRef = ref();
const htmlLite = ref(false);
const htmlRules = reactive({
    title: [{ required: true, message: '请填写标题', trigger: 'change' }],
    type: [{ required: true, message: '请选择类型', trigger: 'change' }],
    content: [{ required: true, message: '请填写模版', trigger: 'change' }],
})

const editorRef = ref();

const openHtmlDialog = (row) => {
    htmlShow.value = true
    const data = JSON.parse(JSON.stringify(row))
    htmlData.value = { ...htmlDataDefault(), ...data }

    setTimeout(() => htmlRef.value.clearValidate())
}



const saveHtml = async () => {
    if (!htmlRef.value) return;
    const valid = await htmlRef.value.validate().catch(() => ({}));
    if (valid !== true) return ElMessage.warning('请填写信息')

    const params = JSON.parse(JSON.stringify(htmlData.value))

    const id = params._id
    delete params._id
    delete params.create_time

    const { errMsg } = id ? await HtmlsDb.doc(id).update(params).catch(e => e) : await HtmlsDb.add(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    ElMessage.success('更新成功')

    htmlShow.value = false

    await getList()
}

const deleteHtml = ({ _id }) => {
    ElMessageBox.confirm('确定删除吗?', '删除模版', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    .then(async () => {
        await HtmlsDb.doc(_id).remove();
        ElMessage.success('删除成功')
        await getList()
    })

}

onMounted(() => {
    getList()
})
</script>

<style lang="scss" scoped>
.notice {
    //min-height: 100vh;
    //background: #262626;

    .html-editor {


        :deep .sv-wangeditor {
            border: 0;

            .w-e-text-container {

            }

            .w-e-scroll {
                width: 414px;
                height: 680px;
                //height: 896px;
                margin: 24px auto;
                border-radius: 8px;
                overflow-y: auto;
            }
        }

        &.black {
            background: #262626;

            :deep .sv-wangeditor {
                border: 0;

                .w-e-text-container {
                    background: #262626;
                }

                .w-e-scroll {
                    background: #000;
                }
            }
        }
    }

    .panel {
        text-align: center;
    }
}
</style>
