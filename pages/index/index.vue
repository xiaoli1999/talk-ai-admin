<template>
	<view class="home">
		<view class="">
			采黎AI后台
			<el-button v-if="globalData.name === 'xiaoli'" @click="goPage('/pages/copy/copy')">复制页</el-button>
		</view>

	</view>
</template>

<script setup>
import { ref } from 'vue'
const goPage = (url) => uni.navigateTo({ url })

const globalData = ref(getApp().globalData)
</script>

<style lang="scss" scoped>
.home {

}
</style>
