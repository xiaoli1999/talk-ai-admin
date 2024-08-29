<template>
  <view class="sv-wangeditor">
    <!-- 将node_modules中的@wangeditor/editor/dist/css/style.css复制到项目根目录static/css文件夹中，并改名为wangeditor-style.css -->
    <!-- 因为uniapp在编译时会将h5原生button等标签转换为uni-button从而导致样式失效，故将样式文件放置static中，并通过link引入才能规避uniapp这一bug -->
    <link href="/admin/static/css/wangeditor-style.css" rel="stylesheet" />
    <Toolbar
      class="editor-toolbar"
      :editor="editorIns"
      :defaultConfig="toolbarConfig"
      :mode="mode"
    />
    <Editor
      class="editor-wrapper"
      v-model="htmlValue"
      :defaultConfig="editorConfig"
      :mode="mode"
      @onCreated="handleCreated"
    />
  </view>
</template>

<script setup>
import { ref, shallowRef, onBeforeUnmount, watch, computed } from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'

const props = defineProps({
  html: {
    type: String,
    default: ''
  },
  // 工具栏配置
  toolbarConfig: {
    type: Object,
    default: () => {}
  },
  mode: {
    type: String,
    default: 'default' // [ default | simple ]
  },
  placeholder: {
    type: String,
    default: '请输入内容...'
  }
})

const emits = defineEmits(['update:html', 'change', 'save'])

// 编辑器实例，必须用 shallowRef
const editorIns = shallowRef()

// 富文本内容
const htmlValue = computed({
  set(newHtml) {
    // 双向绑定
    emits('update:html', newHtml)
  },
  get() {
    return props.html
  }
})

watch(htmlValue, (newHtml) => {
  // 纯文本内容
  const newText = editorIns.value.getText()
  emits('change', { html: newHtml, text: newText })
})

const insertedFileList = ref([]) // 编辑过程中插入的图片列表
const savedFileList = ref([]) // 编辑完成后保存的图片列表

const editorConfig = {
  placeholder: props.placeholder,
  MENU_CONF: {
    uploadImage: {
      /**
       * 自定义图片上传
       * @param {Object} file 上传的图片文件
       * @param {Object} insertFn 插入图片回调
       */
      async customUpload(file, insertFn) {
        // 获取临时文件路径
        const fileURL = window.URL.createObjectURL(file)

        // 文件上传 - 此处可以修改为自定义的图片上传逻辑，需要获取到相关参数后使用如下insertFn方法
        let cloundFile = await uniCloud.uploadFile({
          filePath: fileURL,
          // 同名会导致报错 policy_does_not_allow_file_overwrite
          // cloudPath可由 想要存储的文件夹/文件名 拼接，若不拼文件夹名则默认存储在cloudstorage文件夹中
          cloudPath: `notice/img/${Date.now()}_${file.name}`,
          cloudPathAsRealPath: true
        })

        // 插入操作 参数: url 图片url, alt 图片alt, href 图片href
        insertFn(cloundFile.fileID, file.name, '')

        // 释放临时文件
        URL.revokeObjectURL(fileURL)
      }
    },
    insertImage: {
      onInsertedImage(imageNode) {
        if (imageNode == null) return
        insertedFileList.value.push(imageNode.src)
        // console.log('onInsertedImage', insertedFileList.value)
      }
    },
    // 自定义上传视频，同图片
    uploadVideo: {
      async customUpload(file, insertFn) {
        // 获取临时文件路径
        const fileURL = window.URL.createObjectURL(file)

        // 文件上传 - 此处可以修改为自定义的视频上传逻辑，需要获取到相关参数后使用如下insertFn方法
        let cloundFile = await uniCloud.uploadFile({
          filePath: fileURL,
          // 同名会导致报错 policy_does_not_allow_file_overwrite
          // cloudPath可由 想要存储的文件夹/文件名 拼接，若不拼文件夹名则默认存储在cloudstorage文件夹中
          cloudPath: `notice/video/${Date.now()}_${file.name}`,
          cloudPathAsRealPath: true
        })

        // 插入操作 参数: url 视频url
        insertFn(cloundFile.fileID)

        // 释放临时文件
        URL.revokeObjectURL(fileURL)
      }
    },
    insertVideo: {
      onInsertedVideo(videoNode) {
        if (videoNode == null) return
        insertedFileList.value.push(videoNode.src)
        // console.log('onInsertedVideo', insertedFileList.value)
      }
    }
  }
}

function handleCreated(editor) {
  editorIns.value = editor // 记录 editor 实例，重要！
}

function save() {
  // 获取当前富文本中所有图片
  const savedImages = editorIns.value.getElemsByType('image')?.map((item) => item.src)
  const savedVideos = editorIns.value.getElemsByType('video')?.map((item) => item.src)
  savedFileList.value = [...savedImages, ...savedVideos]
  /**
   * savedFileList需要和insertedFileList对比，从云存储中删除未保存的图片或视频资源
   * 为什么要在结束编辑时才进行对比删除？详见下面链接
   * @tutorial https://www.wangeditor.com/v5/menu-config.html#%E8%8E%B7%E5%8F%96%E5%B7%B2%E5%88%A0%E9%99%A4%E7%9A%84%E5%9B%BE%E7%89%87
   */
  const needDelFiles = insertedFileList.value.filter((item) => !savedFileList.value.includes(item))
  if (needDelFiles.length > 0) {
    /**
     * 删除云存储中的文件资源
     * 注意：阿里云不支持客户端删除操作，需要调用云对象删除，使用前需要上传sv-utils云对象
     */
    uniCloud.importObject('sv-utils').deleteCloudFile(needDelFiles)
  }

  // 纯文本内容
  const newText = editorIns.value.getText()
  emits('save', { html: htmlValue.value, text: newText })
}

// 组件销毁时，也及时销毁编辑器
onBeforeUnmount(() => {
  editorIns.value?.destroy()
  editorIns.value = null
})

defineExpose({
  /**
   * 将editorIns实例暴露出去，可自用调用官方编辑器api
   * @tutorial https://www.wangeditor.com/v5/API.html
   */
  editorIns,
  save
})
</script>

<style lang="scss">
.sv-wangeditor {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  z-index: 6;

  .editor-toolbar {
    border-bottom: 1px solid #ccc;
    box-sizing: border-box;
  }

  .editor-wrapper {
    flex: 1;
    overflow-y: hidden;
    box-sizing: border-box;
  }
}
</style>
