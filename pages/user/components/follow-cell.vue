<template>
    <div class="fc">
        <div class="fc-row">
            <!-- 「未处理」的值是空串,element-plus 会当作未选而显示占位符,所以占位符就写「未处理」 -->
            <el-select v-model="status" size="small" placeholder="未处理" class="fc-st" :class="'st-' + (status || 'none')" @change="save">
                <el-option v-for="s in INVITE_STATUS" :key="s.value" :value="s.value" :label="s.label" />
            </el-select>
            <el-input v-model="note" size="small" placeholder="备注，回车或点别处保存" maxlength="200" clearable @change="save" />
        </div>
        <div v-if="saving" class="fc-meta">保存中…</div>
        <div v-else-if="invite && invite.operator" class="fc-meta">{{ invite.operator }} · {{ fmt(invite.update_time) }}</div>
    </div>
</template>

<script setup>
/**
 * 跟进单元格(内测招募的付费列表与优质老用户列表共用):跟进态下拉 + 备注。
 * 09-13 修:原来输入框只绑 :model-value 不接回写,element-plus 会在每次输入后把原生值强制复原,导致备注打不进去;
 * 现在状态与备注各有本地草稿,下拉一选、备注回车或失焦就保存,成功后 emit('saved') 让父级换掉这一行的跟进记录。
 */
import { ref, watch } from 'vue'
import { dayjs, ElMessage } from 'element-plus'
import { dramaApi, INVITE_STATUS } from '@/utils/drama'

const props = defineProps({
    userId: { type: String, required: true },
    invite: { type: Object, default: () => ({ status: '', note: '', operator: '', update_time: 0 }) },
})
const emit = defineEmits(['saved'])

const status = ref((props.invite && props.invite.status) || '')
const note = ref((props.invite && props.invite.note) || '')
const saving = ref(false)

/* 父级换了记录(保存成功或重新拉数)→ 草稿跟着对齐 */
watch(() => props.invite, (v) => {
    status.value = (v && v.status) || ''
    note.value = (v && v.note) || ''
})

const fmt = (ms) => (ms ? dayjs(ms).format('MM-DD HH:mm') : '')

const save = async () => {
    const cur = props.invite || {}
    if (status.value === (cur.status || '') && (note.value || '') === (cur.note || '')) return
    saving.value = true
    const r = await dramaApi('setBetaInvite', { user_id: props.userId, status: status.value, note: note.value || '' })
    saving.value = false
    if (!r || r.errMsg) {
        status.value = cur.status || ''
        note.value = cur.note || ''
        return ElMessage.error((r && r.errMsg) || '保存失败')
    }
    emit('saved', { status: r.data.status, note: r.data.note, operator: r.data.operator, update_time: r.data.update_time })
    ElMessage.success('已保存')
}
</script>

<style lang="scss" scoped>
.fc {
    .fc-row { display: flex; align-items: center; gap: 6px; }
    .fc-st { width: 96px; flex: 0 0 96px; }
    .fc-meta { font-size: 11px; color: #909399; margin-top: 2px; }
    /* 下拉框按状态上色,扫一眼就知道进度 */
    :deep(.st-pending .el-select__wrapper) { box-shadow: 0 0 0 1px #e6a23c inset; }
    :deep(.st-added .el-select__wrapper), :deep(.st-invited .el-select__wrapper) { box-shadow: 0 0 0 1px #409eff inset; }
    :deep(.st-joined .el-select__wrapper) { box-shadow: 0 0 0 1px #67c23a inset; background: #f0f9eb; }
    :deep(.st-wrong .el-select__wrapper), :deep(.st-refused .el-select__wrapper) { box-shadow: 0 0 0 1px #f56c6c inset; background: #fef0f0; }
}
</style>
