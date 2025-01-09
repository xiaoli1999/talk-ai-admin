<template>
	<view v-loading="loading" class="page notice">
        <div style="display: flex; align-items: center;padding-bottom: 10px">
            <el-radio-group v-model="themeTab" style="" @change="getList">
                <el-radio-button :value="''">全部主题</el-radio-button>
                <el-radio-button v-for="item in htmlEnumsList" :key="item.id" :value="item.id">{{ item.value }}</el-radio-button>
            </el-radio-group>

            <el-button v-if="themeTab" type="success" style="margin-left: 10px;" @click="goDoc">预览</el-button>
        </div>

        <el-button type="primary" style="margin-bottom: 10px;" @click="openHtmlDialog(null)">新增模版</el-button>

        <el-table :data="list" border>

            <el-table-column prop="sort" label="排序" align="center" min-width="40px" />
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
                    <el-form-item label="排序">
                        <el-input-number v-model="htmlData.sort" :step="1" :precision="0" />
                    </el-form-item>
                </div>

                <el-form-item label="内容" prop="content">
                    <div class="html-editor" :class="htmlLite ? 'black' : '' ">
                        <sv-wangeditor ref="editorRef" v-model:html="htmlData.content" mode="default" />
                    </div>
                </el-form-item>
            </el-form>

            <template #footer>
                <div class="pb-[12px]">
                    <el-button type="info" plain @click="htmlShow = false">取消</el-button>
                    <el-button class="!ml-[14px]" type="primary" @click="saveHtml">确认</el-button>
                </div>
            </template>
        </el-dialog>

	</view>
</template>

<script setup>
import { ref, onMounted, reactive, nextTick } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from "element-plus";
import { htmlEnums, htmlEnumsList } from "@/config/enums";

const db = uniCloud.database()
const HtmlsDb = db.collection('htmls')
const dbCmd = db.command


const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 10, total: 0 })
const list = ref([])
const themeTab = ref('')

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize
    loading.value = true

    const whereObj = {}
    if (themeTab.value) whereObj['type'] = themeTab.value

    const { result: { data, count } } = await HtmlsDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('sort asc').get({ getCount:true })
    loading.value = false

    if (!data) return
    list.value = data || []
    listParams.total = count

}

const changePage = async (e) => {
    await getList()
}

const goDoc = async () => {
    uni.navigateTo({ url: `/pages/doc/doc?type=${ themeTab.value }` })
}




/**
 * 修改
 */

const htmlDataDefault = () => ({
    title: '',
    type: '',
    content: '',
    use: false,
    sort: themeTab.value ? (list.value.length ? (list.value[list.value.length - 1].sort || 0) + 1 : 0) : 0,
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
    let data = {}

    if (row) {
        data = JSON.parse(JSON.stringify(row))
    } else {
        data.type = themeTab.value
    }
    htmlData.value = { ...htmlDataDefault(), ...data }

    setTimeout(() => htmlRef.value.clearValidate())

    nextTick(() => {
        const editorConfig  = editorRef.value.editorIns.getConfig()
        // console.log(editorConfig)

        // 主色：#4B2E72 高亮蓝： #8A38F5 高亮红： #EB2F96 字体：14px 行高: 20px

        const colors = ['#4B2E72', '#8A38F5', '#EB2F96', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', ...editorConfig.MENU_CONF.color.colors]
        const lineHeightList = [1.25, ...editorConfig.MENU_CONF.lineHeight.lineHeightList]

        editorConfig.MENU_CONF['color'] = { colors }
        editorConfig.MENU_CONF['bgColor'] = { colors }
        editorConfig.MENU_CONF['lineHeight'] = { lineHeightList }

        editorRef.value.editorIns.children[0].fontSize = '14px'
        editorRef.value.editorIns.children[0].color = '#4B2E72'
        editorRef.value.editorIns.children[0].lineHeight = 1.25
    })
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
        //background: #f7f8fa;


        :deep .sv-wangeditor {
            border: 0;

            .w-e-text-container {
                //background: #f7f8fa;
            }

            .w-e-scroll {
                width: 414px;
                height: 680px;
                //height: 896px;
                margin: 24px auto;
                border-radius: 8px;
                overflow-y: auto;
                background: #fafafa;

                &::-webkit-scrollbar {
                    width: 4px;
                }

                /* 设置滚动条的轨道样式，例如背景颜色和边框样式 */
                &::-webkit-scrollbar-track {
                    background-color: #f7f8fa;
                }

                /* 设置滚动条的滑块样式，例如背景颜色、边框样式和圆角半径 */
                &::-webkit-scrollbar-thumb {
                    background-color: #efefef;
                    border-radius: 4px;
                }
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
