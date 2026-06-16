<template>
    <el-scrollbar v-loading="loading" class="check page">
        <div style="display: flex; align-items: center; flex-wrap: wrap; padding-bottom: 10px">
            <el-radio-group v-model="tab" @change="getList">
                <el-radio-button :value="0">待审核<span v-if="totalObj['待审核']">（{{ totalObj['待审核'] }}）</span></el-radio-button>
                <el-radio-button :value="1">审核未通过<span v-if="totalObj['已审核']">（{{ totalObj['已审核'] }}）</span></el-radio-button>
                <el-radio-button :value="2">今日审核<span v-if="totalObj['今日']">（{{ totalObj['今日'] }}）</span></el-radio-button>
                <el-radio-button :value="-1">草稿<span v-if="totalObj['草稿']">（{{ totalObj['草稿'] }}）</span></el-radio-button>
            </el-radio-group>

            <el-select v-model="category" placeholder="分类" filterable clearable style="width: 80px;margin: 0 10px;" @change="getList">
                <el-option v-for="item in categoryList" :key="item._id" :label="item.name.slice(0, 2)" :value="item._id" />
            </el-select>

            <el-select v-model="category" placeholder="性别" filterable clearable style="width: 80px;" @change="getList">
                <el-option label="男" :value="1" />
                <el-option label="女" :value="2" />
            </el-select>

            <el-button v-if="tab === 0 && isAdmin" type="warning" plain :loading="reauditing" @click="reauditPage" style="margin-left: 12px;">重新审核本页</el-button>
            <el-button v-if="tab === 0 && isAdmin" type="danger" plain :loading="batchRejecting" @click="batchRejectAiFlagged" style="margin-left: 8px;">
                批量驳回（AI建议驳回 {{ aiRejectCount }}）
            </el-button>
            <el-button v-if="isAdmin" type="info" plain @click="goEval" style="margin-left: 12px;">质量评测</el-button>
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
                    <div style="position: relative;padding: 5px 0;">
                        <el-tag type="success">{{ genderEnums[row.gender] }}</el-tag>
                        <span v-if="row.styles > 1" style="position: absolute;top: 2px;right: -2px; width: 16px;height: 16px;text-align: center;line-height: 16px; font-size: 10px; border-radius: 20px;background: #f0f9eb;color: red;">{{ row.styles }}</span>
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

            <el-table-column v-if="tab === 1 || tab === 2" prop="refuse_reason" label="拒绝原因" align="center" min-width="100px">
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
            <el-table-column v-if="tab !== -1" label="AI建议" align="center" width="96px" fixed="right">
                <template #default="{ row }">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                        <!-- 已驳回(state=1)：谁拍的板。AI=定时器自动驳回 / 人工=后台手动驳回 -->
                        <el-tag v-if="row.state === 1" :type="row.refuse_by === 'ai' ? 'warning' : 'primary'" size="small" effect="plain">{{ row.refuse_by === 'ai' ? 'AI审核' : '人工审核' }}</el-tag>
                        <!-- 转人工(state=0 且 need_manual)：AI 连续驳回达上限/全通过/异常 → 待后台人工拍板；连续失败≥3 即 AI 放弃、重点核 -->
                        <template v-else-if="row.need_manual">
                            <el-tag type="warning" size="small" effect="dark">待人工审核</el-tag>
                            <span v-if="(row.ai_fail_count || 0) >= 3" style="font-size:10px;color:#f56c6c;">连续失败{{ row.ai_fail_count }}次</span>
                        </template>
                        <!-- AI 建议（有当前版本日志才显示，hover 看详细理由） -->
                        <el-tooltip v-if="auditMap[row._id]" placement="left" :disabled="!auditMap[row._id].ai_not_reason">
                            <template #content><div style="max-width:380px;white-space:pre-wrap;">{{ auditMap[row._id].ai_not_reason }}</div></template>
                            <div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:default;">
                                <el-tag :type="dimType(auditMap[row._id],'text')" size="small">设定{{ dimMark(auditMap[row._id],'text') }}</el-tag>
                                <el-tag :type="dimType(auditMap[row._id],'image')" size="small">图片{{ dimMark(auditMap[row._id],'image') }}</el-tag>
                                <span v-if="auditMap[row._id].ai_grade != null" style="font-size:11px;color:#E239DA;font-weight:600;">{{ auditMap[row._id].ai_grade }}分</span>
                                <span v-if="lowConfidence(auditMap[row._id])" style="font-size:10px;color:#e6a23c;">低置信</span>
                            </div>
                        </el-tooltip>
                        <!-- 既没驳回、没转人工、也没 AI 日志 → 待 AI 审（定时器还没轮到） -->
                        <el-tag v-else-if="row.state === 0 && !row.need_manual" type="info" size="small">待AI审</el-tag>
                    </div>
                </template>
            </el-table-column>
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
            <div v-if="currentAudit" :style="`border:1px solid #ebeef5;border-left:4px solid ${auditColor(currentAudit)};border-radius:8px;padding:12px 14px;margin-bottom:14px;background:#fafafe;`">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <span style="font-weight:700;color:#303133;">AI 审核结果</span>
                    <el-tag v-if="currentAudit.ai_error" type="info" effect="dark" size="small">AI异常</el-tag>
                    <template v-else>
                        <span style="font-size:13px;color:#606266;">设定 <el-tag :type="dimType(currentAudit,'text')" effect="dark" size="small">{{ dimText(currentAudit,'text') }}</el-tag></span>
                        <span style="font-size:13px;color:#606266;">图片 <el-tag :type="dimType(currentAudit,'image')" effect="dark" size="small">{{ dimText(currentAudit,'image') }}</el-tag></span>
                        <span v-if="currentAudit.ai_grade != null" style="font-size:20px;font-weight:700;color:#E239DA;line-height:1;">{{ currentAudit.ai_grade }}<small style="font-size:12px;color:#909399;font-weight:400;"> 分 · {{ currentAudit.ai_grade >= 75 ? '优质' : '普通' }}</small></span>
                        <span v-if="currentAudit.ai_confidence != null" style="font-size:13px;color:#606266;">置信 {{ (currentAudit.ai_confidence * 100).toFixed(0) }}%<i v-if="lowConfidence(currentAudit)" style="font-style:normal;color:#e6a23c;">（偏低，建议人工核）</i></span>
                    </template>
                </div>
                <div v-if="currentAudit.text_reason" style="margin-top:8px;padding:8px 10px;background:#fff;border-radius:6px;white-space:pre-wrap;font-size:13px;color:#8a38f5;line-height:1.7;"><b style="color:#f56c6c;">设定问题：</b>{{ currentAudit.text_reason }}</div>
                <div v-if="currentAudit.image_reason" style="margin-top:6px;padding:8px 10px;background:#fff;border-radius:6px;white-space:pre-wrap;font-size:13px;color:#8a38f5;line-height:1.7;"><b style="color:#f56c6c;">图片问题：</b>{{ currentAudit.image_reason }}</div>
                <div v-if="currentAudit.ai_error" style="margin-top:8px;font-size:12px;color:#e6a23c;">⚠️ 模型异常：{{ currentAudit.ai_error }}（已转人工，不影响审核）</div>
                <div v-if="currentAudit.ai_tag_list && currentAudit.ai_tag_list.length" style="margin-top:8px;font-size:13px;color:#606266;">
                    建议标签：<el-tag v-for="(t, i) in currentAudit.ai_tag_list" :key="i" size="small" type="warning" style="margin-right:4px;">{{ t }}</el-tag>
                    <el-button v-if="isAdmin" link type="primary" size="small" @click="useAiTags">应用</el-button>
                </div>
                <div style="margin-top:8px;font-size:12px;color:#909399;display:flex;gap:10px;flex-wrap:wrap;">
                    <span v-if="currentAudit.wx_text_suggest">微信文本检测：{{ currentAudit.wx_text_suggest }}</span>
                    <span v-if="currentAudit.cost_tokens">{{ currentAudit.cost_tokens }} tokens</span>
                    <span v-if="currentAudit.latency_ms">耗时 {{ currentAudit.latency_ms }}ms</span>
                    <span v-if="currentAudit.submit_count">第 {{ currentAudit.submit_count }} 次提交</span>
                    <span v-if="currentAudit.create_time">{{ dayjs(currentAudit.create_time).format('MM-DD HH:mm') }} 审</span>
                </div>
            </div>
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
                            <div style="position: relative;display: flex;justify-content: center;align-items: center;margin-left: 20px;width: 50px; height: 90px;border-radius: 4px;background: #dedede;" >
                                <el-image v-if="roleData.avatar_long" :src="montageImgUrl(roleData.avatar_long, 100)" :preview-src-list="[montageImgUrl(roleData.avatar_long, 500), montageImgUrl(roleData.avatar, 300)]" preview-teleported fit="contain" />

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

                <div style="display: flex;align-items: center;">
                    <el-form-item label="是否启用" prop="show">
                        <el-switch v-model="roleData.show" />
                    </el-form-item>

                    <el-form-item label="图片来源" prop="show" style="margin-right: 20px;">
                        <el-tag v-if="roleData.avatar_long.includes('liblib')" type="primary">LibLib</el-tag>
                        <el-tag v-else-if="roleData.avatar_long.includes('role-create/ai')" type="success">Coze</el-tag>
                        <el-tag v-else type="info">上传</el-tag>
                    </el-form-item>
                </div>
            </el-form>

            <template #footer>
                <div class="pb-[12px]">
                    <el-button type="info" plain @click="roleShow = false">取消</el-button>
                    <el-button class="!ml-[14px]" type="info" @click="setRoleDraft">打回草稿箱</el-button>
                    <el-button class="!ml-[14px]" type="danger" @click="useAiReason">审核不通过</el-button>

                    <el-button class="!ml-[14px]" type="primary" @click="saveRole(false)">审核通过</el-button>
                    <el-button class="!ml-[14px]" type="success" @click="saveRole(true)">审核通过（优质）</el-button>
                </div>
            </template>
        </el-dialog>

        <el-dialog class="dialog" v-model="refuseShow" width="760px" title="拒绝原因" align-center draggable :close-on-click-modal="false">
            <div>
                <el-tabs v-model="refuseName">
                    <el-tab-pane v-for="item in refuseData" :label="item.name" :name="item.name" />
                </el-tabs>

                <div style="height: 300px;">
                    <div v-for="(item, i) in (refuseData.find(i => i.name === refuseName) || { list: [] }).list" :key="i" @click="roleData.refuse_reason += `${ item } \n`">
                        <el-button type="info" text size="small">{{ item }}</el-button>
                    </div>
                </div>

                <el-input type="textarea" v-model="roleData.refuse_reason" :rows="5" :maxlength="300" placeholder="审核未通过原因" clearable show-word-limit />
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
import { onMounted, reactive, ref, computed } from 'vue'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { createAvatarKey, montageImgUrl } from '../../utils/common'
import { genderEnums, genderEnumsList } from "@/config/enums";

const TalkCloud = uniCloud.importObject('talk', { customUI: true })
const RoleCloud = uniCloud.importObject('role', { customUI: true })
/* AI 审核助手(co-pilot)：定时器在云端预审写 role_audit_log，这里读建议 + 回写人工结论 */
const RoleAuditCloud = uniCloud.importObject('role-audit', { customUI: true })

/* 传统数据库集合 */
const db = uniCloud.database()
const dbCmd = db.command
const rolesDb = db.collection('roles')
const rolesTestDb = db.collection('roles_test')
const rolesMyDb = db.collection('roles_my')
const auditLogDb = db.collection('role_audit_log')

/* 权限 */
const globalData = ref(getApp().globalData)
const isAdmin = ref(globalData.value.name === 'xiaoli')

const tab = ref(0)
const gender = ref(0)
const category = ref('')

const loading = ref(false)
const listParams = reactive({ pageNo: 1, pageSize: 20, total: 0 })
const list = ref([])
const totalObj = ref({ '待审核': 0, '已审核': 0, '草稿': 0, '今日': 0 })

/* AI 审核建议：role_id → 最新一条 role_audit_log；currentAudit 为当前打开弹窗角色的建议 */
const auditMap = ref({})
const currentAudit = ref(null)

/* 拉取当前列表角色的 AI 建议（定时器已在云端预审好，这里只读） */
const loadAuditMap = async (rows) => {
    auditMap.value = {}
    const ids = (rows || []).map(r => r._id)
    if (!ids.length) return
    const { result } = await auditLogDb.where({ role_id: dbCmd.in(ids) }).orderBy('create_time', 'desc').limit(500).get().catch(() => ({ result: { data: [] } }))
    const logs = (result && result.data) || []
    /* 只认"当前提交版本(styles)"的最新日志：用户重提后(styles++)旧版日志不展示→显示"待AI审"，避免看到上一次旧数据 */
    const styleOf = {}; (rows || []).forEach(r => { styleOf[r._id] = r.styles || 0 })
    const map = {}, seen = new Set()
    for (const lg of logs) {
        if (seen.has(lg.role_id)) continue // 已按时间倒序，每角色只看最新一条
        seen.add(lg.role_id)
        if ((lg.submit_count || 0) === (styleOf[lg.role_id] || 0)) map[lg.role_id] = lg // 仅当前提交版本才采纳
    }
    auditMap.value = map
}

/* 列表用：把一条 AI 建议归纳成 {type,text}（type 控制标签颜色） */
const aiVerdict = (row) => {
    const a = auditMap.value[row._id]
    if (!a) return { type: 'info', text: '待AI审' }
    if (a.ai_error) return { type: 'info', text: 'AI异常' }
    if (a.ai_pass === true) return { type: 'success', text: `建议通过 ${a.ai_grade != null ? a.ai_grade + '分' : ''}` }
    if (a.ai_pass === false) return { type: 'danger', text: '建议驳回' }
    return { type: 'warning', text: '建议人工' }
}
const lowConfidence = (a) => a && a.ai_confidence != null && a.ai_confidence < 0.6
/* 文本/图片分离判定的取值与展示：dim='text'|'image' */
const dimVal = (a, dim) => !a ? undefined : (dim === 'text' ? a.text_pass : a.image_pass)
const dimType = (a, dim) => { if (a && a.ai_error) return 'info'; const v = dimVal(a, dim); return v === true ? 'success' : (v === false ? 'danger' : 'info') }
const dimMark = (a, dim) => { if (a && a.ai_error) return '异常'; const v = dimVal(a, dim); return v === true ? '✓' : (v === false ? '✗' : '待') }
const dimText = (a, dim) => { if (a && a.ai_error) return '异常'; const v = dimVal(a, dim); return v === true ? '通过' : (v === false ? '驳回' : '—') }
/* 弹窗卡片左色条：异常橙 / 任一驳回红 / 均过绿 / 其余灰 */
const auditColor = (a) => { if (!a) return '#909399'; if (a.ai_error) return '#e6a23c'; if (a.text_pass === false || a.image_pass === false) return '#f56c6c'; if (a.text_pass === true && a.image_pass === true) return '#67c23a'; return '#909399' }

/* 跳转审核质量评测页 */
const goEval = () => uni.navigateTo({ url: '/pages/audit-eval/audit-eval' })

/* —— 重新审核：强制对当前页全部角色重跑 AI 审核（调已部署的 audit({roleId})，不看跳过规则） —— */
const reauditing = ref(false)
const reauditPage = async () => {
    if (!list.value.length) return ElMessage.info('当前页没有角色')
    try {
        await ElMessageBox.confirm(`将对当前页 ${list.value.length} 个角色重新调用 AI 审核（顺序执行，约 ${list.value.length * 5} 秒），确定？`, '重新审核', { type: 'warning', confirmButtonText: '开始重审', cancelButtonText: '取消' })
    } catch (e) { return }
    reauditing.value = true
    let ok = 0, fail = 0
    for (const row of list.value) { // 顺序逐个，避免并发打满模型
        try {
            const { data } = await RoleAuditCloud.audit({ roleId: row._id })
            data ? ok++ : fail++
        } catch (e) { fail++ }
    }
    reauditing.value = false
    ElMessage.success(`重新审核完成：成功 ${ok}，失败 ${fail}`)
    await getList() // 刷新，loadAuditMap 取最新一条日志
}

/* —— 批量驳回：当前页中 AI 建议驳回(设定或图片未过、且非异常)的角色 —— */
const batchRejecting = ref(false)
const aiRejectTargets = () => list.value.filter(r => {
    const a = auditMap.value[r._id]
    return a && !a.ai_error && (a.text_pass === false || a.image_pass === false) && a.ai_not_reason
})
const aiRejectCount = computed(() => aiRejectTargets().length)
const batchRejectAiFlagged = async () => {
    const targets = aiRejectTargets()
    if (!targets.length) return ElMessage.info('当前页没有「AI建议驳回」的角色')
    try {
        await ElMessageBox.confirm(`将驳回当前页 ${targets.length} 个 AI 建议驳回的角色，并依次发送微信通知，确定？`, '批量驳回', { type: 'warning', confirmButtonText: '确定驳回', cancelButtonText: '取消' })
    } catch (e) { return }

    batchRejecting.value = true
    let ok = 0, fail = 0
    /* 同步逐个驳回：因为每个都要发微信订阅消息，串行避免并发出问题 */
    for (const row of targets) {
        try {
            const reason = auditMap.value[row._id].ai_not_reason
            /* 人工驳回：refuse_by=human(信笺显示"真人复审") + 还原 AI 计数 + 清转人工标记 */
            const { errMsg } = await rolesMyDb.doc(row._id).update({ state: 1, refuse_reason: reason, refuse_by: 'human', ai_fail_count: 0, need_manual: false, update_time: Date.now() }).catch(e => e)
            if (errMsg) { fail++; continue }
            await RoleCloud.checkRoleAndNotice({ state: 1, roleInfo: { ...row, refuse_reason: reason }, date: dayjs().format('YYYY-MM-DD HH:mm:ss') }).catch(() => {})
            await RoleAuditCloud.setHumanDecision({ roleId: row._id, submitCount: row.styles, decision: 'reject' }).catch(() => {})
            ok++
        } catch (e) { fail++ }
    }
    batchRejecting.value = false
    ElMessage.success(`批量驳回完成：成功 ${ok}，失败 ${fail}`)
    await getList()
}

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
            '【名称、简介、设定、标签、开场白】等涉及“低俗、色情、性暗示、血腥、暴力、未成年、政治、军事、明星”等内容，请进行修改。',
            '【简介、设定】内容混淆，简介是给用户看的，设定才会直接影响崽崽性格、回复效果，请认真填写设定。',

            '【简介】人物关系混乱，崽崽为第三人称（他/她/它/名称），用户为第二人称（你/主控/用户/名称），请进行修改。',
            '【设定】人物关系混乱，崽崽为第二人称（你/名称），用户为第一称（我/主控/用户/名称），请进行修改。',

            '【简介、设定、开场白】等语句不通顺，缺少标点符号，请进行修改。',

            '【简介、设定】缺少崽崽详细信息，请进行修改。',
            '【简介、设定】等存在凑字数等行为，请认真填写。',

            '【简介】中的作者寄语请写在最后面，放在（）里，请进行修改。',
            '【设定】缺少【简介】中的剧情、崽崽信息、用户信息等，请进行补充。',


            '【名称】不够具体，请为崽崽起一个具体的名称。',
            '【标签】不符合崽崽信息，请进行修改。',
            '【标签】多个标签，请分开填写。',
        ]
    },
    {
        name: '图片',
        list: [
            '【形象图、头像】涉及“低俗、色情、性暗示、血腥、暴露、暴力、未成年、素人、明星”等内容，请进行修改。',
            '【形象图】存在“水印、模糊、低质量、截图、黑边”等，请进行修改。',
            '【形象图】尺寸有误，应为竖版构图，比例为9:16，请进行修改。',
            '【头像】未正确裁剪头像（需保证脸部清晰），请调整头像。',
        ]
    },
    {
        name: '分类',
        list: [
            '【动漫、小说、游戏】等分类，设定应含有相关《作品》名称、角色名称等，请进行补充。',
            '【分类】不符和崽崽信息，请选择符合崽崽的分类。',
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

    /* 分类/性别筛选作为公共条件（各 tab 计数与列表共用，避免相互污染计数） */
    const baseFilter = {}
    if (gender.value) baseFilter.gender = gender.value
    if (category.value) baseFilter.category_id = category.value

    /* 今日零点(本地=北京时间)毫秒：「今日审核」按 update_time 过滤 */
    const todayStart = dayjs().startOf('day').valueOf()

    /* 列表查询条件；今日审核(tab=2) = 今日被驳回(state=1 且 update_time≥今日零点) */
    const whereObj = { ...baseFilter, state: tab.value }
    if (tab.value === 2) {
        whereObj.state = 1
        whereObj.update_time = dbCmd.gte(todayStart)
    }

    loading.value = true
    let res = {}

    if (tab.value === 0) {
        res = await rolesMyDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy('vip desc').orderBy("user_cb_pay_num", "desc").orderBy("update_time", "asc").get({ getCount: true })

    } else if (tab.value === 1 || tab.value === 2) {
        res = await rolesMyDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy("update_time", "desc").get({ getCount: true })
    } else if (tab.value === -1) {
        res = await rolesMyDb.where(whereObj).skip(start).limit(listParams.pageSize).orderBy("update_time", "desc").get({ getCount: true })
    } else { /*  */ }

    /* 各 tab 计数（用公共筛选，互不干扰）；今日 = 今日被驳回数 */
    const { result: { total: 待审核 } } = await rolesMyDb.where({ ...baseFilter, state: 0 }).count()
    const { result: { total: 已审核 } } = await rolesMyDb.where({ ...baseFilter, state: 1 }).count()
    const { result: { total: 草稿 } } = await rolesMyDb.where({ ...baseFilter, state: -1 }).count()
    const { result: { total: 今日 } } = await rolesMyDb.where({ ...baseFilter, state: 1, update_time: dbCmd.gte(todayStart) }).count()

    totalObj.value = { 待审核, 已审核, 草稿, 今日 }

    loading.value = false

    if (!res.result) return

    const data = res.result.data || []
    const count = res.result.count || 0

    list.value = data
    listParams.total = count

    /* 读取这批角色的 AI 建议（不阻塞主流程） */
    loadAuditMap(data)
}

const changePage = async (e) => {
    await getList()
}

const setRowBg = ({ row }) => (row.category_id === 'null' ? { background: '#FAFAFA', color: '#303133' } : {})

const openRoleDialog = (row) => {
    roleShow.value = true
    const data = JSON.parse(JSON.stringify(row))
    roleData.value = { ...roleDataDefault(), ...data }
    /* 当前角色的 AI 建议（供弹窗内参考/一键填充） */
    currentAudit.value = auditMap.value[row._id] || null
    /* 删除展示字段 */
    delete roleData.value.avatar1
    delete roleData.value.avatar_long1
    setTimeout(() => roleRef.value.clearValidate())
}

/* 一键把 AI 建议的驳回理由填入并打开驳回弹窗 */
const useAiReason = () => {
    if (currentAudit.value && currentAudit.value.ai_not_reason) {
        roleData.value.refuse_reason = currentAudit.value.ai_not_reason
    }
    refuseShow.value = true
}
/* 一键应用 AI 推荐标签（取前 4 个） */
const useAiTags = () => {
    const tags = (currentAudit.value && currentAudit.value.ai_tag_list) || []
    if (tags.length) roleData.value.tag_list = tags.slice(0, 4)
}
/* 回写人工最终结论，供与 AI 建议比对一致率 */
const writeHumanDecision = (decision) => {
    const _id = roleData.value._id
    if (!_id) return
    RoleAuditCloud.setHumanDecision({ roleId: _id, submitCount: roleData.value.styles, decision }).catch(() => {})
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

const setRoleDraft = async () => {
    const params = { state: -1, styles: 0, update_time: Date.now() }

    const { errMsg } = await rolesMyDb.doc(roleData.value._id).update(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    roleShow.value = false
    ElMessage.success('已打回草稿箱')

    const checkNoticeRes = await RoleCloud.checkRoleAndNotice({ state: -1, roleInfo: roleData.value, date: dayjs().format('YYYY-MM-DD HH:mm:ss') }).catch(() => ({}))
    if (!checkNoticeRes.data) ElMessage.error('通知失败！')

    writeHumanDecision('draft')
    await getList()
}

const refuseRole = async () => {
    const { _id, refuse_reason } = roleData.value
    /* 人工驳回：refuse_by=human(信笺显示"真人复审") + 还原 AI 计数 + 清转人工标记 */
    const params = { state: 1, refuse_reason, refuse_by: 'human', ai_fail_count: 0, need_manual: false, update_time: Date.now() }

    const { errMsg } = await rolesMyDb.doc(_id).update(params).catch(e => e)
    if (errMsg) return ElMessage.error(errMsg)

    refuseShow.value = false
    roleShow.value = false

    ElMessage.success('操作成功')

    const checkNoticeRes = await RoleCloud.checkRoleAndNotice({ state: 1, roleInfo: roleData.value, date: dayjs().format('YYYY-MM-DD HH:mm:ss') }).catch(() => ({}))
    if (!checkNoticeRes.data) ElMessage.error('通知失败！')

    writeHumanDecision('reject')
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
    /* 3.9 自动审核新增字段：roles 集合 schema 无此字段，不剔除会导致 add 校验失败 */
    delete params.refuse_by
    delete params.ai_fail_count
    delete params.need_manual
    delete params.refuse_detail


    /* 设置特殊参数 */
    /* 更新时间,多加10s */
    const time = dayjs().add(10, 'second').valueOf()
    params.update_time = time
    params.last_talk_time = time
    /* 优质角色设置热度 */
    params.today_hot_count = isGood ? 5000 : 0
    params.high_quality = isGood || false

    /* 获取主色 */
    const { data } = await uni.request({ url: params.avatar_long + '?x-oss-process=image/average-hue', method: 'get' }).catch(() => ({}))
    params.avatar_bg_color = data.RGB ? `#${ data.RGB.slice(2) }` : ''

    /* 新增线上角色 */
    const addRes = await rolesDb.add(params).catch(e => e)
    const { id, errMsg } = (addRes && addRes.result) || {}
    if (errMsg || !id) return ElMessage.error(errMsg || (addRes && addRes.errMsg) || '上线失败，请重试')

    ElMessage.success('上线成功')

    roleShow.value = false

    /* 删除测试角色 */
    await rolesMyDb.doc(roleId).remove();

    const { result: { data: roleInfo } } = await rolesDb.doc(id).get()
    const checkNoticeRes = await RoleCloud.checkRoleAndNotice({ state: 0, roleInfo: roleInfo[0], date: dayjs().format('YYYY-MM-DD HH:mm:ss') }).catch(() => ({}))
    if (!checkNoticeRes.data) ElMessage.error('通知失败！')

    writeHumanDecision(isGood ? 'pass_good' : 'pass')
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

// 更新角色主色
// const updateRoleAvatarBgColor = async () => {
//     try {
//         /* 获取用户信息 .get({ getCount: true }) */
//         const { result: { data, count } } = await db.collection('roles').where({ category_id: dbCmd.neq('null'), avatar_bg_color: db.command.in([undefined, null, '']) }).limit(10).get({ getCount: true })
//
//         console.log(`还剩${count}个，本地运行10个`)
//
//         for (let i = 0; i < data.length; i++) {
//             const { data: imgData } = await uni.request({ url: data[i].avatar_long + '?x-oss-process=image/average-hue', method: 'get' }).catch(() => ({}))
//             if (!imgData) return ElMessage.error(`第${i+1}个获取主色报错`)
//
//             const avatar_bg_color = imgData.RGB ? `#${ imgData.RGB.slice(2) }` : ''
//
//             const { errMsg } = await rolesDb.doc(data[i]._id).update({ avatar_bg_color }).catch(e => e)
//             if (errMsg) return ElMessage.error(errMsg)
//
//             console.log(`第${i+1}个，【${data[i].name}】颜色为【${avatar_bg_color}】`)
//         }
//
//
//     } catch ({ message }) {
//         return { errMsg: message }
//     }
// }
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


