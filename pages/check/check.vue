<template>
    <el-scrollbar v-loading="loading" class="check page">
        <div style="display: flex; align-items: center; flex-wrap: wrap; padding-bottom: 10px">
            <el-radio-group v-model="tab" @change="getList">
                <el-radio-button :value="0">待审核<span v-if="totalObj['待审核']">（{{ totalObj['待审核'] }}）</span></el-radio-button>
                <el-radio-button :value="1">审核未通过<span v-if="totalObj['已审核']">（{{ totalObj['已审核'] }}）</span></el-radio-button>
                <el-radio-button :value="-1">草稿<span v-if="totalObj['草稿']">（{{ totalObj['草稿'] }}）</span></el-radio-button>
            </el-radio-group>

            <el-select v-model="category" placeholder="分类" filterable clearable style="width: 80px;margin: 0 10px;" @change="getList">
                <el-option v-for="item in categoryList" :key="item._id" :label="item.name.slice(0, 2)" :value="item._id" />
            </el-select>

            <el-select v-model="category" placeholder="性别" filterable clearable style="width: 80px;" @change="getList">
                <el-option label="男" :value="1" />
                <el-option label="女" :value="2" />
            </el-select>
        </div>

        <el-table class="roles-table" :data="list" border :row-style="setRowBg" size="small" @selection-change="selectionChange">
            <el-table-column type="selection" label="排序" align="center" width="60px" />
            <el-table-column prop="avatar" label="头像" align="center" min-width="60px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.avatar" :src="montageImgUrl(row.avatar, 100)" :preview-src-list="[montageImgUrl(row.avatar, 300)]" preview-teleported fit="contain" style="border-radius: 50%;" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="avatar" label="背景" align="center" min-width="60px">
                <template #default="{ row }">
                    <div style="display: flex;justify-content: center">
                        <el-image v-if="row.avatar_long" :src="montageImgUrl(row.avatar_long, 100)" :preview-src-list="[montageImgUrl(row.avatar_long, 500)]" preview-teleported fit="contain" />
                    </div>
                </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" align="center" min-width="70px" />
            <el-table-column prop="gender" label="性别" align="center" width="60px">
                <template #default="{ row }">
                    <div>
                        <el-tag type="success">{{ genderEnums[row.gender] }}</el-tag>
                    </div>
                </template>
            </el-table-column>

            <el-table-column prop="vip" label="创建人" align="center" width="80px">
                <template #default="{ row }">
                    <div style="display: flex;flex-direction: column;align-items: center;">
                        <div>{{ row.nickname }}</div>
                        <el-tag v-if="row.vip" type="primary" size="small">会员</el-tag>
                        <el-tag v-if="row.user_cb_pay_num" type="success" size="small">{{ row.user_cb_pay_num }}</el-tag>
                    </div>
                </template>
            </el-table-column>

            <el-table-column prop="category_id" label="分类" align="center" min-width="60px">
                <template #default="{ row }">
                    <view style="position: relative;padding: 10px 0;">
                        <el-tag>{{ (categoryObj[row.category_id] || '').slice(0, 2) }}</el-tag>
                    </view>
                </template>
            </el-table-column>

            <el-table-column prop="tag_list" label="标签" align="center" min-width="100px">
                <template #default="{ row }">
                    <div style="display: flex;flex-direction: column;align-items: center;">
                        <el-tag v-for="(item, index) in row.tag_list" :key="index" type="warning" style="margin: 2px auto;">{{ item }}</el-tag>
                    </div>
                </template>
            </el-table-column>

            <el-table-column prop="desc" label="简介" align="center" min-width="140px">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="max-width: 360px;">{{ row.desc }}</div>
                        </template>
                        <el-text :line-clamp="3">{{ row.desc }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>


            <el-table-column prop="prompt" label="提示词" align="center" min-width="140px">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="max-width: 360px;">{{ row.prompt }}</div>
                        </template>
                        <el-text :line-clamp="3">{{ row.prompt }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>
            <el-table-column prop="guide_list" label="引导语" align="center" min-width="140px" :formatter="(e) => e.guide_list.join(';')" />

            <el-table-column v-if="tab === 1" prop="refuse_reason" label="拒绝原因" align="center" min-width="100px">
                <template #default="{ row }">
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="max-width: 360px;">{{ row.refuse_reason }}</div>
                        </template>
                        <el-text :line-clamp="3">{{ row.refuse_reason }}</el-text>
                    </el-tooltip>
                </template>
            </el-table-column>

            <el-table-column prop="update_time" label="更新时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.update_time).format('MM-DD HH:mm')" />
            <el-table-column prop="create_time" label="注册时间" align="center" min-width="80px" :formatter="(e) => dayjs(e.create_time).format('MM-DD HH:mm')" />
            <el-table-column label="操作" align="center" width="130" fixed="right">
                <template #default="{row}">
                    <el-button v-if="tab !== -1" type="primary" @click="openRoleDialog(row)" size="small">审核</el-button>
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

        <el-dialog class="dialog" v-model="roleShow" width="880px" title="审核角色" align-center draggable :close-on-click-modal="false">
            <el-form ref="roleRef" class="role-form" :model="roleData" :rules="roleRules" label-width="80px" :disabled="!isAdmin">
                <div style="display: flex;">
                    <el-form-item label="名称" prop="name" >
                        <el-input v-model="roleData.name" :maxlength="10" placeholder="请输入角色名称" clearable show-word-limit style="width: 200px" />
                    </el-form-item>
                    <el-form-item label="主控名" prop="user_name">
                        <el-input v-model="roleData.user_name" :maxlength="10" placeholder="请输入主控名称" clearable show-word-limit style="width: 140px" />
                    </el-form-item>

                    <el-form-item label="分类" prop="category_id">
                        <el-select v-model="roleData.category_id" placeholder="请选择角色分类" style="width: 160px">
                            <el-option v-for="item in categoryList" :key="item._id" :label="item.name" :value="item._id" />
                        </el-select>
                    </el-form-item>
                </div>

                <div style="display: flex;">
                    <el-form-item label="头像" prop="avatar" style="flex-shrink: 0;">
                        <div style="display: flex;align-items: center;">
                            <div style="position: relative;width: 50px;height: 50px;display: flex;justify-content: center;align-items: center;">
                                <el-image v-if="roleData.avatar" :src="montageImgUrl(roleData.avatar, 100)" :preview-src-list="[montageImgUrl(roleData.avatar, 300), montageImgUrl(roleData.avatar_long, 500)]" preview-teleported fit="contain" style="border-radius: 50%;" />

                                <div v-show="roleData.avatar" class="del-btn" @click="roleData.avatar = ''">✖</div>
                                <div v-show="roleData.avatar" class="upload-btn" @click="uploadImg('avatar')" >✚</div>
                            </div>
                            <div style="position: relative;display: flex;justify-content: center;align-items: center;margin-left: 20px;" >
                                <el-image v-if="roleData.avatar_long" :src="montageImgUrl(roleData.avatar_long, 40)" :preview-src-list="[montageImgUrl(roleData.avatar_long, 500), montageImgUrl(roleData.avatar, 300)]" preview-teleported fit="contain" />

                                <div v-show="roleData.avatar_long" class="del-btn" @click="roleData.avatar_long = ''">✖</div>
                                <div v-show="roleData.avatar_long" class="upload-btn" @click="uploadImg('avatar_long')">✚</div>
                            </div>
                        </div>
                    </el-form-item>
                    <div>
                        <div style="display: flex;">
                            <el-form-item label="性别" prop="gender">
                                <el-radio-group v-model="roleData.gender">
                                    <el-radio v-for="item in genderEnumsList" :key="item.id" :value="Number(item.id)">{{ item.value }}</el-radio>
                                </el-radio-group>
                            </el-form-item>
                        </div>
                        <el-form-item label="标签" prop="tag_list">
                            <div style="display: flex;">
                                <el-input v-model="roleData.tag_list[0]" :maxlength="6" placeholder="标签1" clearable />
                                <div style="width: 5px;flex-shrink: 0"></div>
                                <el-input v-model="roleData.tag_list[1]" :maxlength="6" placeholder="标签2" clearable />
                                <div style="width: 5px;flex-shrink: 0"></div>
                                <el-input v-model="roleData.tag_list[2]" :maxlength="6" placeholder="标签3" clearable />
                                <div style="width: 5px;flex-shrink: 0"></div>
                                <el-input v-model="roleData.tag_list[3]" :maxlength="6" placeholder="标签4" clearable />
                            </div>
                        </el-form-item>
                    </div>
                </div>

                <el-form-item label="简介" prop="desc">
                    <el-input type="textarea" v-model="roleData.desc" :rows="6" :maxlength="1000" placeholder="请输入角色简介" clearable show-word-limit />
                </el-form-item>


                <el-form-item label="提示词" prop="prompt">
                    <el-input type="textarea" v-model="roleData.prompt" :rows="6" :maxlength="1000" placeholder="请输入角色提示词" clearable show-word-limit />
                </el-form-item>
                <el-form-item label="开场白" prop="guide_list">
                    <el-input type="textarea" v-model="roleData.guide_list[0]" :rows="3" :maxlength="300" placeholder="请输入角色引导语" clearable show-word-limit />
                </el-form-item>

                <el-form-item label="声音" prop="voice_url">
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

                <!--                <div style="display: flex;">-->
                <!--                    <el-form-item label="角色排序" prop="sort">-->
                <!--                        <el-input-number v-model="roleData.sort" :min="0" :max="1000" :precision="0" :step="1" controls-position="right" />-->
                <!--                    </el-form-item>-->
                <!--                    <el-form-item label="是否启用" prop="show">-->
                <!--                        <el-switch v-model="roleData.show" />-->
                <!--                    </el-form-item>-->
                <!--                </div>-->
            </el-form>

            <template #footer>
                <div class="pb-[12px]">
                    <el-button type="info" plain @click="roleShow = false">取消</el-button>
                    <el-button class="!ml-[14px]" type="danger" @click="refuseShow = true">审核不通过</el-button>

                    <el-button class="!ml-[14px]" type="primary" @click="saveRole(false)">审核通过</el-button>
                    <el-button class="!ml-[14px]" type="success" @click="saveRole(true)">审核通过（优质）</el-button>
                </div>
            </template>
        </el-dialog>

        <el-dialog class="dialog" v-model="refuseShow" width="600px" title="拒绝原因" align-center draggable :close-on-click-modal="false">
            <div>
                <el-tabs v-model="refuseName">
                    <el-tab-pane v-for="item in refuseData" :label="item.name" :name="item.name" />
                </el-tabs>

                <div style="height: 280px;">
                    <div v-for="(item, i) in (refuseData.find(i => i.name === refuseName) || { list: [] }).list" :key="i" @click="roleData.refuse_reason += `${ item } \n`">
                        <el-button type="info" text>{{ item }}</el-button>

                    </div>
                </div>

                <el-input type="textarea" v-model="roleData.refuse_reason" :rows="6" :maxlength="300" placeholder="审核未通过原因" clearable show-word-limit />
            </div>

            <template #footer>
                <div class="pb-[12px]">
                    <el-button type="info" plain @click="refuseShow = false">取消</el-button>
                    <el-button class="!ml-[14px]" type="primary" @click="refuseRole">确定</el-button>
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
const dbCmd = db.command
const rolesDb = db.collection('roles')
const rolesTestDb = db.collection('roles_test')
const rolesMyDb = db.collection('roles_my')

/* 权限 */
const globalData = ref(getApp().globalData)
const isAdmin = ref(globalData.value.name === 'xiaoli')

const tab = ref(0)
const gender = ref(0)
const category = ref('')

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 20, total: 0 })
const list = ref([])
const totalObj = ref({ '待审核': 0, '已审核': 0, '草稿': 0 })

const selectList = ref([])
const selectionChange = (e) => (selectList.value = e)

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
    creator_id: '',
    state: 0,
    refuse_reason: ''
})
const roleShow = ref(false)
const roleData = ref(roleDataDefault())

const refuseShow = ref(false)
const refuseName = ref('内容')
const refuseData = reactive([
    {
        name: '内容',
        list: [
                '名称、简介、设定、标签、开场白等涉及低俗、血腥、暴力等内容，请进行修改。',
                '简介、设定等存在凑字数等行为，请认真填写。',
                '简介、设定等人称关系混乱，请进行修改。',
                '标签内容不符，请进行修改。',
        ]
    },
    {
        name: '图片',
        list: [
            '形象图、头像涉及低俗、血腥、暴力等内容，请进行修改。',
            '形象图、头像包含水印、模糊、低质量，请进行修改。',
            '形象图尺寸有误，应为9:16比例，请进行修改。',
            '未正确裁剪头像，请调整头像。',
        ]
    },
    {
        name: '分类',
        list: [
            '分类不符，请选择符合崽崽的分类。'
        ]
    }
])

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
        state: tab.value
    }

    if (gender.value) whereObj.gender = gender.value
    if (category.value) whereObj.category_id = category.value


    loading.value = true
    let res = await rolesMyDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('vip desc').orderBy("user_cb_pay_num", "desc").orderBy("update_time", "asc").get({ getCount: true })

    /* 统计总数 */
    // totalObj
    const { result: { total: 待审核 } } = await rolesMyDb.where({ ...whereObj, state: 0 }).count()
    const { result: { total: 已审核 } } = await rolesMyDb.where({ ...whereObj, state: 1 }).count()
    const { result: { total: 草稿 } } = await rolesMyDb.where({ ...whereObj, state: -1 }).count()

    totalObj.value = { 待审核, 已审核, 草稿 }

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
    if (!data) return ElMessage.warning('声音生成失败')

    roleData.value.voice_url = data.url
}

const refuseRole = async () => {
    const { _id, refuse_reason } = roleData.value
    const params = { state: 1, refuse_reason, update_time: Date.now() }

    const { errMsg } = await rolesMyDb.doc(_id).update(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    refuseShow.value = false
    roleShow.value = false

    ElMessage.success('操作成功')

    await getList()
}

const saveRole = async (isGood = false) => {
    if (!roleRef.value) return;
    const valid = await roleRef.value.validate().catch(() => ({}));
    if (valid !== true) return ElMessage.warning('请填写信息')

    /* 组装参数 */
    const params = JSON.parse(JSON.stringify(roleData.value))

    const roleId = params._id

    /* 删除无用参数 */
    delete params._id
    delete params.create_time
    delete params.looks_prompt
    delete params.username
    delete params.nickname
    delete params.creator

    /* 3.5 新增字段 */
    delete params.vip
    delete params.version
    /* 3.52 新增字段 */
    delete params.user_cb_pay_num
    /* 3.8 新增字段 */
    delete params.state
    delete params.refuse_reason


    /* 设置特殊参数 */
    /* 更新时间,多加10s */
    const time = dayjs().add(20, 'second').valueOf()
    params.update_time = time
    params.last_talk_time = time
    /* 优质角色设置热度 */
    params.today_hot_count = isGood ? 5000 : 0
    params.high_quality = isGood || false

    /* 获取主色 */
    const { data } = await uni.request({ url: params.avatar_long + '?x-oss-process=image/average-hue', method: 'get' }).catch(() => ({}))
    params.avatar_bg_color = data.RGB ? `#${ data.RGB.slice(2) }` : ''

    /* 新增线上角色 */
    const { errMsg } = await rolesDb.add(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    ElMessage.success('上线成功')

    roleShow.value = false

    /* 删除测试角色 */
    await rolesMyDb.doc(roleId).remove();

    await getList()
}

const deleteRole = ({ _id }) => {
    ElMessageBox.confirm('确定删除吗?', '删除角色', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
            .then(async () => {
                await rolesMyDb.doc(_id).remove();
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
.check {
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


