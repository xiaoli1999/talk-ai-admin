<script>
	export default {
		globalData: {
			name: '',
		},
		onLaunch: function({ query }) {
			if (!query || !query.name) query = uni.getStorageSync('globalData') || {}
			if (!['xiaoli', 'tongyao'].includes(query.name)) return uni.redirectTo({ url: "pages/error/error"});

            this.globalData.name = query.name
			uni.setStorageSync('globalData', query)

			if (query.name === 'tongyao') {
                ([1, 2]).forEach(i => {
                    uni.setTabBarItem({
                        index: i,
                        visible: false
                    });
                })
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
    padding-top: 10px;
}

.del-btn {
    position: absolute;
    width: 18px;
    height: 18px;
    text-align: center;
    line-height: 18px;
    top: -10px;
    right: -10px;
    background: #F56C6C;
    border-radius: 50%;
    font-size: 10px;
    color: #fff;
    cursor: pointer;
    z-index: 3000;
    transition: all .24s;

    &:hover {
        opacity: 0.68;
    }
}

.upload-btn {
    position: absolute;
    width: 18px;
    height: 18px;
    text-align: center;
    line-height: 18px;
    bottom: -10px;
    right: -10px;
    background: #409eff;
    border-radius: 50%;
    font-size: 10px;
    color: #fff;
    cursor: pointer;
    z-index: 3000;
    transition: all .24s;

    &:hover {
        opacity: 0.68;
    }
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
