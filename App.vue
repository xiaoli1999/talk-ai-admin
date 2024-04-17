<script>
	export default {
		globalData: {
			isShow: false,
            isAdmin: false
		},
		onLaunch: function({ query }) {
			if (!query || !query.name) query = uni.getStorageSync('globalData') || {}
			if (!['tongyao', 'xiaoli'].includes(query.name)) return uni.redirectTo({ url: "pages/error/error"});

			uni.setStorageSync('globalData', query)

			this.globalData.isShow = true

			if (query.name === 'xiaoli') {
				this.globalData.isAdmin = true
			} else {
				uni.switchTab({ url: `/pages/${ query.path }/${ query.path }` })
				uni.hideTabBar()
			}
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
.page {
    height: calc(100vh - 50px) !important;
    box-sizing: border-box;
    padding: 10px;
}

.pagination {
    position: sticky;
    bottom: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
}

@media only screen and (max-width: 768px) {
    .el-pagination {
        background: #ffffffcc;

        .el-pagination__total {
            font-size: 12px !important;
        }

        .el-pagination__sizes {
            margin-left: 8px;

            .el-select {
                width: 80px;

                .el-select__wrapper {
                    padding: 2px 4px;
                    font-size: 12px !important;
                }
            }
        }

        .btn-prev {
            margin-left: 8px !important;
        }
        .btn-prev,
        .btn-next {
            height: 20px;
            min-width: 16px;
            padding: 1px 2px;
        }



        .el-pager {
            .number {
                min-width: 18px;
                font-size: 12px !important;
            }
        }
    }
}
</style>
