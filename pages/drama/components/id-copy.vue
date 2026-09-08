<template>
    <el-tooltip :content="id || '—'" placement="top" :disabled="!id">
        <el-button link size="small" class="idc" :disabled="!id" @click.stop="copy">
            <el-icon><CopyDocument /></el-icon>
            <span v-if="label" class="idc-l">{{ label }}</span>
        </el-button>
    </el-tooltip>
</template>

<script setup>
/**
 * 小 ID 复制件(09-08 黎令:不显示长 id,悬停看全、点一下复制)。列表/抽屉/举报/错误各处共用。
 */
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { copyText } from '@/utils/common'

const props = defineProps({
    id: { type: String, default: '' },
    label: { type: String, default: '' },
})

const copy = async () => {
    if (!props.id) return
    const ok = await copyText(props.id).catch(() => false)
    ElMessage[ok ? 'success' : 'error'](ok ? `已复制${props.label ? ' ' + props.label : ''}：${props.id}` : '复制失败')
}
</script>

<style scoped>
.idc { padding: 0 2px; height: 18px; color: #909399; }
.idc:hover { color: #409eff; }
.idc-l { font-size: 11px; margin-left: 2px; }
</style>
