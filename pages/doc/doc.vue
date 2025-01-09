<template>
	<view class="doc">
        <view class="doc-title">
            {{ type }}
            <view class="doc-title-border">{{ type }}</view>
        </view>
        <view class="doc-main">
            <view class="doc-main-content">

                <view v-for="item in list" :key="item.title" class="doc-card">
                    <view class="doc-card-title">{{ item.title }}</view>
                    <rich-text class="doc-card-content" :nodes="item.content" />

                    <view class="doc-card-bg"></view>
                </view>
            </view>
        </view>

        <image class="bg" src="https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/doc-bg.png" mode="widthFix" />
	</view>
</template>

<script>
const db = uniCloud.database()
const HtmlsDb = db.collection('htmls')
const dbCmd = db.command

	export default {
		data() {
			return {
                type: '',
                list: []
			}
		},
        onLoad(e) {
            this.type = e.type

            this.getList()
        },

		methods: {
            async getList() {
                const { result: { data } } = await HtmlsDb.where({ type: this.type, use: true }).orderBy('sort asc').get()

                this.list = data || []
            }
		}
	}
</script>

<style lang="scss" scoped>
.doc {
    width: 100%;
    min-height: 100vh;

    .bg {
        position: fixed;
        width: 100%;
        left: 0;
        top: 0;
        z-index: -1;
        //opacity: 0.1;
    }

    .doc-title {
        position: fixed;
        left: 32rpx;
        top: 10%;
        z-index: 2;
        font-size: 64rpx;
        font-weight: bold;
        color: #fff;
        letter-spacing: 2rpx;

        text-shadow: 16rpx 20rpx 26rpx #8A38F5;
        //text-shadow: 20rpx 20rpx 24rpx #8A38F5, 8rpx 8rpx 4rpx #EB2F96;
        //box-shadow: 20rpx 20rpx 24px #8A38F5 inset;

        .doc-title-border {
            position: absolute;
            left: 4rpx;
            top: 8rpx;
            z-index: -1;
            color: transparent;
            white-space: nowrap;
            -webkit-text-stroke: 6rpx #EB2F96; //文字描边
        }
    }

    .doc-main {
        position: fixed;
        width: 100%;
        height: 85%;
        left: 0;
        top: 25%;
        z-index: 1;
        overflow-y: auto;

        mask: linear-gradient(
                        to bottom, transparent 0%, #000 48rpx, #000 90%, transparent 96%);

        .doc-main-content {
            margin: 0 auto;
            padding: 48rpx 32rpx 24rpx;

            .doc-card {
                position: relative;
                padding: 40rpx 16rpx 16rpx;
                margin-bottom: 64rpx;

                .doc-card-title {
                    position: absolute;
                    left: 2rpx;
                    top: -20rpx;
                    z-index: 1;
                    font-size: 36rpx;
                    font-weight: bold;
                    color: #fff;
                    letter-spacing: 2rpx;
                    text-shadow: 4rpx 4rpx 2rpx #EB2F96;
                    line-height: 1;
                    //text-shadow: 4rpx 4rpx 2rpx #EB2F96, 8rpx 8rpx 2rpx #8A38F5;
                    //box-shadow: 20rpx 20rpx 24px #8A38F5 inset;
                }

                .doc-card-content {
                    font-size: 28rpx;
                    color: #4B2E72;
                    line-height: 1.25;
                }

                .doc-card-bg {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    top: 0;
                    left: 0;
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(231, 212, 255, 0.4) 100%);
                    border-radius: 24rpx;
                    filter: blur(20rpx);
                    z-index: -1;
                }
            }
        }
    }
}
</style>
