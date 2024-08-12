<template>
	<view class="audio_center">
		<view class="audio_center_cover">
			<image v-if="audioCover" class="audio_center_cover_img" mode="aspectFill" :src="audioCover"></image>
			<view class="iconfont" @tap="clickAudio" :class="audio_status ?'icon-play-stop':'icon-play-cell'"></view>
		</view>
		<view class="audio_center_right">
			<view v-if="stringObject(src) == 'string'" class="single">
				<view class="single_title">
					<view class="single_title_info" :style="{color:audioTitleColor}">{{audioTitle}}</view>
					<view class="tips">{{timeTxt}}</view>
				</view>
				<view class="tips">{{subheading}}</view>
				<slider :backgroundColor='backgroundColor' :activeColor='activeColor' @change="sliderChange"
					:value="sliderIndex" :max="maxSliderIndex" :block-size='0' />
			</view>
			<view v-else>相关功能正在开发中~</view>
		</view>
	</view>
</template>
<script>
	let timer;
	export default {
		name: 'syAudio',
		emits: ['audioPlay', 'audioPause', 'audioEnd', 'audioCanplay', 'change'],
		data() {
			return {
				audio_status: false,

				timeTxt: '00 : 00',
				timeIndex: 0,

				sliderIndex: 0,
				maxSliderIndex: 100,

				stringObject: (data) => {
					return typeof(data)
				},
				innerAudioContext: uni.createInnerAudioContext()
			}
		},
		props: {
			//是否自动播放(只支持微信内置浏览器,小程序，app)
			autoplay: {
				type: Boolean,
				default: false
			},
			//音频地址
			src: {
				type: [String, Array],
				default: ''
			},
			//是否倒计时
			isCountDown: {
				type: Boolean,
				default: false
			},
			//音乐封面
			audioCover: {
				type: String,
				default: ''
			},
			//标题
			audioTitle: {
				type: String,
				default: 'new Audio Title'
			},
			//标题颜色
			audioTitleColor: {
				type: String,
				default: '#333'
			},
			//副标题
			subheading: {
				type: String,
				default: 'new Audio Subheading'
			},
			//滑块左侧已选择部分的线条颜色
			activeColor: {
				type: String,
				default: '#bf41a2'
			},
			//滑块右侧背景条的颜色
			backgroundColor: {
				type: String,
				default: '#f1c38b'
			}
		},
		watch: {
			src: {
				handler: function(newVal, oldVal) {
					this.innerAudioContext.src = typeof(newVal) == 'string' ? newVal : newVal;
				},
				deep: true
			}
		},
		async mounted() {
			this.innerAudioContext.src = typeof(this.src) == 'string' ? this.src : this.src[0];

			if (this.autoplay) {
				if (!this.src) return console.error('src cannot be empty，The target value is string or array')

				// #ifdef H5
				var ua = window.navigator.userAgent.toLowerCase();
				if (ua.match(/MicroMessenger/i) == 'micromessenger') {
					const jweixin = require('../../utils/jweixin');

					jweixin.config({});
					jweixin.ready(() => {
						WeixinJSBridge.invoke('getNetworkType', {}, (e) => {
							this.innerAudioContext.play();
							this.countDown()
						})
					})
				}
				// #endif

				// #ifndef H5
				this.innerAudioContext.autoplay = true;
				// #endif
			}

			this.innerAudioContext.onPlay(() => {
				this.audio_status = true;
				this.$emit('audioPlay')
				setTimeout(() => {
					this.maxSliderIndex = parseFloat(this.innerAudioContext.duration).toFixed(2);
					this.countDown();
				}, 100)
			});

			this.innerAudioContext.onPause(() => {
				this.$emit('audioPause');
			});

			this.innerAudioContext.onEnded(() => {
				this.audio_status = !this.audio_status;
				this.$emit('audioEnd');
			});

			this.innerAudioContext.onCanplay((event) => {
				this.$emit('audioCanplay');
				// #ifdef MP
				this.maxSliderIndex = parseFloat(this.innerAudioContext.duration).toFixed(2);
				// #endif
			});

			this.innerAudioContext.onPlay(() => {
				this.$emit('change', {
					state: true
				});
			});

			this.innerAudioContext.onPause(() => {
				this.$emit('change', {
					state: false
				});
			});
		},
		methods: {
			//销毁innerAudioContext()实例
			audioDestroy() {
				if (this.innerAudioContext) {
					this.innerAudioContext.destroy();
					this.audio_status = false;
				}
			},
			//跳转到指定位置
			audioSeek(value) {
				this.sliderChange(value)
			},
			//控制音乐播放/暂停
			audioPause() {
				this.clickAudio()
			},
			countDown() {
				timer = setInterval(() => {
					this.sliderIndex = parseFloat(this.innerAudioContext.currentTime).toFixed(2);

					this.timeTxt = this.getTime(this.isCountDown ? this.innerAudioContext.duration - this
						.innerAudioContext
						.currentTime : this.innerAudioContext.currentTime);
					this.timeTxt = this.isCountDown ? '- ' + this.timeTxt : this.timeTxt;

					if (this.innerAudioContext.currentTime >= this.innerAudioContext.duration) {
						clearInterval(timer);
					}
				}, 100)
			},
			clickAudio() {

				if (this.audio_status && !this.innerAudioContext.paused) {
					this.innerAudioContext.pause();
					clearInterval(timer);
				} else {
					this.innerAudioContext.play();
				}

				this.audio_status = !this.audio_status;
			},
			getTime(time) {
				let m = parseInt(time / 60 % 60)
				m = m < 10 ? '0' + m : m
				let s = parseInt(time % 60)
				s = s < 10 ? '0' + s : s
				return m + ' : ' + s
			},
			sliderChange(e) {
				this.innerAudioContext.seek(e.detail ? e.detail.value : e);
				this.sliderIndex = e.detail ? e.detail.value : e;
			}
		},
		onUnload() {
			this.audioDestroy()
		},
		onHide() {
			this.audioDestroy()
		},
		beforeDestroy() {
			this.audioDestroy()
		}
	}
</script>

<style lang="scss" scoped>
	@import url('../../static/font/iconfont.css');

	::v-deep uni-slider,
	::v-deep slider {
		margin: 0;
		overflow: hidden;
		padding: 0;
	}

	.audio_center {
		display: flex;
		box-shadow: 0 0 10rpx #c3c3c3;
		border-radius: 10rpx;
		overflow: hidden;
		align-items: stretch;

		.single {
			flex: 1;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			padding: 16rpx 24rpx 10rpx 0;

			.tips {
				font-size: 22rpx;
				color: #919191;
				flex-shrink: 0;
			}

			&_title {
				&_info {
					font-size: 28rpx;
					overflow: hidden;
					display: -webkit-box;
					-webkit-line-clamp: 1;
					-webkit-box-orient: vertical;
					margin-right: 20rpx;
				}

				display: flex;
				justify-content: space-between;
				align-items: flex-end;
			}
		}

		&_cover {
			flex-shrink: 0;
			background: #f5f5f5;
			position: relative;
			display: flex;
			align-items: stretch;
			width: 127rpx;

			.iconfont {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				margin: auto;
				z-index: 9;
				display: flex;
				justify-content: center;
				align-items: center;
				font-size: 64rpx;
				background: rgba(0, 0, 0, .25);
				color: #fff;
			}

			&_img {
				width: 127rpx;
				height: 100%;
				border-radius: 10rpx 0 0 10rpx;
			}

			margin-right:30rpx;
		}

		&_right {
			display: flex;
			align-items: stretch;
			flex: 1;
		}
	}
</style>