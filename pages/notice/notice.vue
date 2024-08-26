<template>
	<view v-loading="loading" class="notice">
        <view class="notice-editor">
            <sv-wangeditor v-if="showEditor" ref="editorRef" v-model:html="html" mode="default" :defaultConfig="defaultConfig" @change="changeEditor" @save="saveEditor" />
        </view>

        <view class="panel">
            <el-button type="primary" @click="onSave">保存</el-button>
        </view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showEditor = ref(false)
const html = ref('')
const toolbarConfig = ref({
    fontSize: {
        default: '24px' // 设置默认字体大小
    },
    style: {
        color: '#ffffff', // 替换为你想要的默认颜色
        'font-size': '14px', // 默认字体大小
    }
});
const defaultConfig = ref({
    fontSize: '24px',
    color: '#fff'
});
const editorRef = ref();
const loading = ref(false)

function changeEditor(e) {
    console.log("==== changeEditor :", e);
}

function onSave() {
    // 调用实例方法save触发保存事件
    editorRef.value.save();
}

function saveEditor(e) {
    console.log("==== saveEditor :", e);
}

onMounted(() => {
    setTimeout(() => {
        html.value = "<p>hello sv-wangEditor</p>";
        showEditor.value = true
    }, 2000);
})
</script>

<style lang="scss" scoped>
.notice {
    min-height: 100vh;
    background: #262626;

    .notice-editor {
        :deep .sv-wangeditor {
            border: 0;

            .w-e-text-container {
                background: #262626;
            }

            .w-e-scroll {
                width: 414px;
                height: 896px;
                margin: 24px auto;
                background: #000;
                border-radius: 8px;
                overflow-y: auto;
            }
        }
    }

    .panel {
        text-align: center;
    }
}
</style>
