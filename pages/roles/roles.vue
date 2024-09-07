<template>
    <el-scrollbar v-loading="loading" class="roles page">
        <el-radio-group v-model="tab" style="padding-bottom: 10px" @change="getList">
            <el-radio-button :value="0">最新创建</el-radio-button>
            <el-radio-button :value="1">最近聊天</el-radio-button>
            <el-radio-button :value="3">其他角色</el-radio-button>
            <el-radio-button :value="4">未改写角色</el-radio-button>
            <el-radio-button :value="5">采采原创</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="gender" style="padding-bottom: 10px;margin-left: 10px;" @change="getList">
            <el-radio-button :value="0">全部</el-radio-button>
            <el-radio-button :value="1">男</el-radio-button>
            <el-radio-button :value="2">女</el-radio-button>
        </el-radio-group>

        <view style="margin: 12px;">
            <el-button v-if="isAdmin" type="primary" :disabled="tab >= 3" style="margin-right: 12px" @click="openRoleDialog(null)">新增角色</el-button>
        </view>
        <el-table class="roles-table" :data="list" border :row-style="setRowBg" size="small">
            <el-table-column prop="sort" label="排序" align="center" width="60px" />
            <el-table-column prop="avatar" label="头像" align="center" min-width="60px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.avatar1" :src="row.avatar1" :preview-src-list="[row.avatar1]" preview-teleported fit="contain" style="border-radius: 50%;" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="avatar" label="背景" align="center" min-width="60px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.avatar_long1" :src="row.avatar_long1" :preview-src-list="[row.avatar_long1]" preview-teleported fit="contain" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" align="center" min-width="70px" />
            <el-table-column prop="user_name" label="用户" align="center" min-width="70px" />
            <el-table-column prop="category_id" label="分类" align="center" min-width="80px">
                <template #default="{ row }">
                    <view style="position: relative;padding: 10px 0;">
                        <el-tag>{{ categoryObj[row.category_id] || row.name }}</el-tag>
                        <view v-if="row.children && row.children.length"
                              style="position: absolute;top: 6px;right: -6px; width: fit-content;line-height: 16px; min-width: 16px;font-size: 12px;background: #409EFF;color: #fff;border-radius: 16px;"
                        >
                            {{ row.children.length }}
                        </view>
                    </view>
                </template>
            </el-table-column>
            <el-table-column prop="desc" label="简介" align="center" min-width="140px">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="max-width: 300px;">{{ row.desc }}</div>
                        </template>
                        <el-text truncated>{{ row.desc }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
            <el-table-column prop="tag_list" label="标签" align="center" min-width="140px">
                <template #default="{ row }">
                    <div>
                        <el-tag v-for="(item, index) in row.tag_list" :key="index" type="warning" style="margin: 4px auto;">{{ item }}</el-tag>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="gender" label="性别" align="center" width="60px">
                <template #default="{ row }">
                    <div>
                        <el-tag type="success">{{ genderEnums[row.gender] }}</el-tag>
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="category_id" label="风格" align="center" width="50px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <div :class="`tag tag-${ row.styles }`" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="prompt" label="提示词" align="center" min-width="140px">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="max-width: 300px;">{{ row.prompt }}</div>
                        </template>
                        <el-text truncated>{{ row.prompt }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
            <el-table-column prop="guide_list" label="引导语" align="center" min-width="140px" :formatter="(e) => e.guide_list.join(';')" />
            <el-table-column prop="show" label="启用" align="center" width="50px">
                <template #default="{ row }">
                    <div>
                        <el-switch v-model="row.show" :disabled="true" size="small" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="hot_count" label="热度" align="center" min-width="50px" />
            <el-table-column prop="talk_count" label="对话" align="center" min-width="50px" />
            <el-table-column prop="update_time" label="更新时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.update_time).format('MM-DD HH:mm:ss')" />
            <el-table-column prop="create_time" label="注册时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm:ss')" />
            <el-table-column label="操作" align="center" width="200" fixed="right">
                <template #default="{row}">
                    <el-button type="primary" @click="openRoleDialog(row)" size="small">修改</el-button>
                    <el-button v-if="isAdmin" type="danger" @click="deleteRole(row)" size="small">删除</el-button>
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

        <el-dialog class="dialog" v-model="roleShow" width="720px" :title="roleData._id ? '新增角色' : '修改角色'" align-center draggable>
            <el-form ref="roleRef" class="role-form" :model="roleData" :rules="roleRules" label-width="100px" :disabled="!isAdmin">
                <div style="display: flex;">
                    <el-form-item label="角色名称" prop="name">
                        <el-input v-model="roleData.name" :maxlength="10" placeholder="请输入角色名称" clearable show-word-limit />
                    </el-form-item>
                    <el-form-item label="用户名称" prop="user_name">
                        <el-input v-model="roleData.user_name" :maxlength="10" placeholder="请输入用户名称" clearable show-word-limit />
                    </el-form-item>
                </div>

                <el-form-item label="角色分类" prop="category_id">
                    <el-select v-model="roleData.category_id" placeholder="请选择角色分类" :disabled="roleData._id && roleData.category_id === 'null' && roleData.children.length" clearable>
                        <el-option v-for="item in categoryList" :key="item._id" :label="item.name" :value="item._id" />
                        <el-option label="一级分类" value="null" />
                    </el-select>
                </el-form-item>

                <div style="display: flex;">
                    <el-form-item label="角色头像" prop="avatar">
                        <div style="position: relative;width: 50px;height: 50px;padding: 4px; border: 1px dashed #DCDFE6; display: flex;justify-content: center;align-items: center;">
                            <img v-if="roleData.avatar" :src="roleData.avatar" style="width: 100%; max-width: 50px;max-height: 50px;object-fit: contain;border-radius: 50%;" alt=""/>
                            <div v-else style="font-size: 24px;color: #DCDFE6;">+</div>
                            <button @click="uploadImg('avatar')" style="position: absolute;width: 100%;height: 100%; z-index: 2000;inset: 0;opacity: 0" />
                            <div v-show="roleData.avatar" class="del-btn" @click="roleData.avatar = ''">❌︎</div>
                        </div>
                    </el-form-item>
                    <el-form-item label="角色背景" prop="avatar_long">
                        <div style="position: relative;width: 50px;height: 50px;padding: 4px;border: 1px dashed #DCDFE6; display: flex;justify-content: center;align-items: center;">
                            <img v-if="roleData.avatar_long" :src="roleData.avatar_long" style="width: 100%; max-width: 50px;max-height: 50px;object-fit: contain;border-radius: 4px;" alt=""/>
                            <div v-else style="font-size: 24px;color: #DCDFE6;">+</div>
                            <button @click="uploadImg('avatar_long')" style="position: absolute;width: 100%;height: 100%; z-index: 2000;inset: 0;opacity: 0" />

                            <div v-show="roleData.avatar_long" class="del-btn" @click="roleData.avatar_long = ''">❌︎</div>
                        </div>
                    </el-form-item>
                </div>

                <el-form-item label="角色简介" prop="desc">
                    <el-input type="textarea" v-model="roleData.desc" :rows="5" :maxlength="500" placeholder="请输入角色简介" clearable show-word-limit />
                </el-form-item>

                <el-form-item label="角色标签" prop="tag_list">
                    <div style="display: flex;">
                        <el-input v-model="roleData.tag_list[0]" :maxlength="6" placeholder="标签1" clearable show-word-limit />
                        <div style="width: 10px;flex-shrink: 0"></div>
                        <el-input v-model="roleData.tag_list[1]" :maxlength="6" placeholder="标签2" clearable show-word-limit />
                        <div style="width: 10px;flex-shrink: 0"></div>
                        <el-input v-model="roleData.tag_list[2]" :maxlength="6" placeholder="标签3" clearable show-word-limit />
                        <div style="width: 10px;flex-shrink: 0"></div>
                        <el-input v-model="roleData.tag_list[3]" :maxlength="6" placeholder="标签4" clearable show-word-limit />
                    </div>
                </el-form-item>

                <div style="display: flex;">
                    <el-form-item label="角色性别" prop="gender">
                        <el-radio-group v-model="roleData.gender">
                            <el-radio v-for="item in genderEnumsList" :key="item.id" :value="Number(item.id)">{{ item.value }}</el-radio>
                        </el-radio-group>
                    </el-form-item>
                    <el-form-item label="角色风格" prop="styles">
                        <el-radio-group v-model="roleData.styles">
                            <el-radio v-for="item in 4" :key="item" :value="item">
                                <div :class="`tag tag-${item}`" />
                            </el-radio>
                        </el-radio-group>
                    </el-form-item>
                </div>

                <el-form-item label="角色提示词" prop="prompt">
                    <el-input type="textarea" v-model="roleData.prompt" :rows="5" :maxlength="500" placeholder="请输入角色提示词" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="角色引导语" prop="guide_list">
                    <el-input type="textarea" v-model="roleData.guide_list[0]" :rows="3" :maxlength="300" placeholder="请输入角色引导语" clearable show-word-limit />
                </el-form-item>

                <el-form-item label="角色声音" prop="voice_id">
                    <div style="display: flex;align-items: center">
                        <el-select v-model="roleData.voice_id" placeholder="请选择音色" style="width: 280px;">
                            <el-option v-for="item in filterVoiceList()" :key="item.id" :label="item.name + '——' + item.tag.join('-')" :value="item.id">
                                <div style="display: flex;align-items: center;justify-content: space-between;padding-top: 4px;">
                                    <sy-audio class="audio" :src="item.url" :audioTitle="item.name + '—' + item.tag.join('-')" :key="item.id" @click.stop></sy-audio>
                                    <el-button type="primary" size="small" style="margin-left: 8px;">选择</el-button>
                                </div>
                            </el-option>
                        </el-select>
                        <el-button class="!mx-[14px]" type="primary" size="small" @click="createSound" style="margin: 0 8px;">生成</el-button>

                        <sy-audio v-if="roleData.voice_url" :src="roleData.voice_url" audioCover='' subheading='' audioTitle='测试音频'></sy-audio>
                    </div>
                </el-form-item>

                <div style="display: flex;">
                    <el-form-item label="角色排序" prop="sort">
                        <el-input-number v-model="roleData.sort" :min="0" :max="1000" :precision="0" :step="1" controls-position="right" />
                    </el-form-item>
                    <el-form-item label="是否启用" prop="show">
                        <el-switch v-model="roleData.show" />
                    </el-form-item>
                </div>
            </el-form>

            <template #footer>
                <div class="pb-[12px]">
                    <el-button type="info" plain @click="roleShow = false">取消</el-button>
                    <el-button class="!ml-[14px]" type="primary" @click="saveRole">确认</el-button>
                </div>
            </template>
        </el-dialog>
    </el-scrollbar>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { createAvatarKey, montageImgUrl } from '../../utils/common'
import { genderEnums, genderEnumsList } from "@/config/enums";

const TalkCloud = uniCloud.importObject('talk', { customUI: true })

/* 传统数据库集合 */
const db = uniCloud.database()
const rolesDb = db.collection('roles')
const rolesTestDb = db.collection('roles_test')
const rolesMyDb = db.collection('roles_my')

/* 权限 */
const globalData = ref(getApp().globalData)
const isAdmin = ref(globalData.value.name === 'xiaoli')

const tab = ref(5)
const gender = ref(0)

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 20, total: 0 })
const list = ref([])
const categoryList = ref([
    {
        "_id": "6634e1558620667bb4fe5fc0",
        "name": "虚拟想象"
    },
    {
        "_id": "663c306f0d2b315faf92d78a",
        "name": "动漫人物"
    },
    {
        "_id": "663c30f5213929f866b41dcb",
        "name": "历史人物"
    },
    {
        "_id": "663c30b40d2b315faf92e382",
        "name": "游戏角色"
    },
    {
        "_id": "663c3133c3b5c96502b4019d",
        "name": "小说角色"
    }
])
const categoryObj = ref(Object.fromEntries(categoryList.value.map(item => [item._id, item.name])))

const roleDataDefault = () => ({
    category_id: 'null',
    sort: 0,
    show: false,
    name: '',
    user_name: '',
    avatar: '',
    avatar_long: '',
    gender: 0,
    desc: '',
    tag_list: [],
    styles: 1,
    prompt: '',
    hide_prompt: '',
    guide_list: [],
    hot_count: 0,
    talk_count: 0,
    /* 2.5新增 */
    today_hot_count: 0,
    today_talk_count: 0,
    like_count: 0,
    voice_id: '',
    voice_url: '',
    last_talk_time: '',
    update_time: '',
    creator_id: ''
})
const roleShow = ref(false)
const roleData = ref(roleDataDefault())

const roleRef = ref();
const roleRules = reactive({
    name: [{ required: true, message: '请填写角色名称', trigger: 'change' }],
    user_name: [{ required: true, message: '请填写用户名称', trigger: 'change' }],
    category_id: [{ required: true, message: '请选择角色分类', trigger: 'change' }],
    desc: [{ required: true, message: '请填写角色简介', trigger: 'change' }],
    prompt: [{ required: true, message: '请填写角色提示词', trigger: 'change' }],
    tag_list: [{ required: true, message: '请至少填写一个标签', trigger: 'change' }, { validator: (r, v, cb) => v.filter(i => i).length === 0 ? cb(new Error('请填写引导语')) : cb(), trigger: 'change' }],
    guide_list: [{ required: true, message: '请填写引导语', trigger: 'change' }, { validator: (r, v, cb) => !v[0] ? cb(new Error('请填写引导语')) : cb(), trigger: 'change' }],
    voice_id: [{ required: true, message: '请选择音色', trigger: 'change' }],
    voice_url: [{ required: true, message: '请生成音频', trigger: 'change' }],
})

const voiceList = ref([])
const getVoiceList = async () => {
    const { data } = await TalkCloud.getVoiceData()

    voiceList.value = data ? data.list : []
}

const filterVoiceList = () => {
    if (!roleData.value.gender) return voiceList.value
    const obj = { 1: '男', 2: '女' }
    const gender = obj[roleData.value.gender]

    return voiceList.value.filter(i => i.tag.includes(gender))
}

const getList = async () => {
    const start = (listParams.pageNo - 1) * listParams.pageSize

    const whereObj = {
        category: db.command.neq('null')
    }

    if (gender.value) whereObj.gender = gender.value

    let res = {}

    loading.value = true

    if (tab.value === 0) {
        res = await rolesDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount:true })
    } else if (tab.value === 1) {
        res = await rolesDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('last_talk_time desc').get({ getCount:true })
    } else if (tab.value === 3) {
        res = await rolesTestDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount:true })
    } else if (tab.value === 4) {
        whereObj.update_time = db.command.lt(dayjs('2024-09-04 00:00').valueOf())

        res = await rolesDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('hot_count desc').get({ getCount: true })
    } else if (tab.value === 5) {

        res = await rolesMyDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('create_time desc').get({ getCount: true })
    }

    loading.value = false

    if (!res.result) return

    const data = res.result.data || []
    const count = res.result.count || 0


    data.map(i => {
        if (i.avatar) i.avatar1 = montageImgUrl(i.avatar, 100)
        if (i.avatar_long) i.avatar_long1 = montageImgUrl(i.avatar_long, 500)
        return i
    })

    list.value = data
    listParams.total = count
}

const changePage = async (e) => {
    await getList()
}

const setRowBg = ({ row }) => (row.category_id === 'null' ? { background: '#FAFAFA', color: '#303133' } : {})

const openRoleDialog = (row) => {
    roleShow.value = true
    const data = JSON.parse(JSON.stringify(row))
    roleData.value = { ...roleDataDefault(), ...data }
    /* 删除展示字段 */
    delete roleData.value.avatar1
    delete roleData.value.avatar_long1
    setTimeout(() => roleRef.value.clearValidate())
}

const uploadImg = (avatar) => {
    uni.chooseImage({
        count: 1, //默认9
        sizeType: ['original'], //可以指定是原图还是压缩图，默认二者都有
        sourceType: ['album'], //从相册选择
        success: function (res) {
            const filePath = res.tempFilePaths[0]
            const file = res.tempFiles[0]

            uni.showLoading({ title: '头像上传中' })
            const suffix = file.name.split('.').pop()
            const cloudPath = `/img/roles/${createAvatarKey()}.${ suffix }`

            uniCloud.uploadFile({
                filePath,
                cloudPath,
                cloudPathAsRealPath: true,
                success: (res) => {
                    roleData.value[avatar] = res.fileID
                },
                complete: () => uni.hideLoading()
            });
        }
    });
}

const createSound = async () => {
    const { voice_id, name, guide_list } = roleData.value
    const params = { id: voice_id, name, text: guide_list[0] }

    const { data } = await TalkCloud.getRoleExampleSound(params)
    if (!data) return

    roleData.value.voice_url = data.url
}

const saveRole = async () => {
    if (!roleRef.value) return;
    const valid = await roleRef.value.validate().catch(() => ({}));
    if (valid !== true) return ElMessage.warning('请填写信息')

    const params = JSON.parse(JSON.stringify(roleData.value))

    const testRoleId = params._id

    if ([3, 5].includes(tab.value)) {
        delete params._id
        delete params.create_time

        if (tab.value === 5) {
            params.creator_id = 'cc'
            params.today_hot_count = 1000
        }
    }

    const id = params._id
    delete params._id
    delete params.children
    delete params.creator

    /* 更新时间,多加10s */
    const time = dayjs().add(20, 'second').valueOf()
    params.update_time = time
    params.last_talk_time = time

    /* 过滤无效标签 */
    params.tag_list = params.tag_list.filter(i => i)

    const { errMsg } = id ? await rolesDb.doc(id).update(params).catch(e => e) : await rolesDb.add(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    ElMessage.success('更新成功')

    roleShow.value = false

    /* 删除测试角色 */
    if (tab.value === 3) await rolesTestDb.doc(testRoleId).remove();

    await getList()
}

const deleteRole = ({ _id }) => {
    ElMessageBox.confirm('确定删除吗?', '删除角色', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
            .then(async () => {
                await rolesDb.doc(_id).remove();
                ElMessage.success('删除成功')
                await getList()
            })

}

onMounted(async () => {
    await getList()
    getVoiceList()
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


