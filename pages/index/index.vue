<template>
	<view class="home">
		<view class="table-wrap">
			<uni-table class="table" :loading="loading" border stripe emptyText="暂无更多数据">
				<uni-tr>
					<uni-th width="40">头像</uni-th>
					<uni-th width="60">昵称</uni-th>
					<uni-th width="80">登录时间</uni-th>
					<uni-th width="80">注册时间</uni-th>
				</uni-tr>
				<uni-tr v-for="(item, index) in list" :key="index">
					<uni-td align="center">
						<image v-if="item.avatar" :src="item.avatar" mode="widthFix" style="width: 40px;border-radius: 50%;"></image>
						<view v-else style="width: 40px;height: 40px; border-radius: 50%;"></view>
					</uni-td>
					<uni-td >{{ item.nickname }}</uni-td>
					<uni-td align="center">{{ dayjs(item.last_login_date).format('YYYY-MM-DD HH:mm:ss')  }}</uni-td>
					<uni-td align="center">{{ dayjs(item.register_date).format('YYYY-MM-DD HH:mm:ss') }}</uni-td>
				</uni-tr>
			</uni-table>
		</view>
		<uni-pagination v-model="listParams.pageNo" :pageSize="listParams.pageSize" :total="listParams.total" title="标题文字"  @change="changePage" />
	</view>
</template>

<script setup>
	import { onMounted, reactive, ref } from 'vue'
	import dayjs from 'dayjs'
	
	const db = uniCloud.database()

	const loading = ref(false)
	const listParams = reactive({ pageNo: 1, pageSize: 50, total: 0 })
	const list = ref([])
	
	const getList = async () => {
		const start = (listParams.pageNo - 1) * listParams.pageSize
		loading.value = true
		const { result: { data, count } } = await db.collection('users').skip(start).limit(listParams.pageSize).orderBy('last_login_date desc').get({ getCount:true })
		loading.value = false
		
		if (!data) return 
		list.value = data || []
		listParams.total = count
		
	}
	
	const changePage = async (e) => {
		await getList()
	}
	
	onMounted(async () => await getList())
</script>

<style lang="scss" scoped>
.home {
	
}
</style>