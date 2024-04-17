<script>
	export default {
		globalData: {
			isShow: false,
			isAdmain: false
		},
		onLaunch: function({ query }) {
			if (!query || !query.name) query = uni.getStorageSync('globalData') || {}
			if (!['tongyao', 'xiaoli'].includes(query.name)) return uni.redirectTo({ url: "pages/error/error"});
			
			this.globalData.isShow = true
			
			if (query.name === 'xiaoli') {
				this.globalData.isAdmain = true
			} else {
				uni.switchTab({ url: `/pages/${ query.path }/${ query.path }` })
				uni.hideTabBar()
			}
			
			uni.setStorageSync('globalData', query)
		},
		onShow: function(e) {
			
		},
		onHide: function() {
	
		},
		onPageNotFound() {
			uni.redirectTo({ url: "/pages/error/error"});
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
