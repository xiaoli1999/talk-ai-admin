<template>
	<view class="home">
		<view class="">
			采黎AI后台
			<el-button @click="goPage('/pages/copy/copy')">复制页</el-button>
		</view>
		
	</view>
</template>

<script setup>
const goPage = (url) => uni.navigateTo({ url })
</script>

<style lang="scss" scoped>
.home {
	
}
</style>