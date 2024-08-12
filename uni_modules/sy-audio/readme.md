

欢迎使用 sy-audio 在线音乐播放器

## props (组件属性)

  属性  | 类型 | 默认值 | 备注
------------- | ------------- | ---------
autoplay  |Boolean| false | 是否自动播放(只支持微信内置浏览器,小程序，app)
src  |String| '' | 音频地址
isCountDown  |Boolean| false |是否倒计时
audioCover  |String| '' | 音乐封面
audioTitle  |String| new Audio Title | 标题
audioTitleColor  |String| #333 | 标题颜色
subheading  |String| new Audio Subheading | 副标题
activeColor  |String| #bf41a2 | 滑块左侧已选择部分的线条颜色
backgroundColor  |String| #f1c38b | 滑块右侧背景条的颜色


## 组件事件

  事件  | 事件内容
------------- | -------------
@audioPlay | 音频播放事件
@audioPause | 音频暂停事件
@audioEnd | 音频自然播放结束事件
@change | 音频播放状态监听（返回true/false）
@audioCanplay | 音频进入可以播放状态，但不保证后面可以流畅播放

## ref 事件
  事件  | 事件内容
------------- | -------------
audioPause() | 控制音乐播放/暂停
audioSeek() | 跳转到指定位置
audioDestroy() | 销毁innerAudioContext()实例

```html
<sy-audio isCountDown ref="audio" src='' audioCover='' subheading='' audioTitle=''></sy-audio>

//项目为vue2时 调用跳转到音乐15s位置方法，如下:
this.$refs.audio.audioSeek(15)

//项目为vue3时 请通过value形式调用子组件方法
```

#### View代码
```html
<sy-audio isCountDown ref="audio" src='' audioCover='' subheading='' audioTitle=''></sy-audio>

//项目为vue2时 src为本地路径时，使用require方法，如下:
<sy-audio :src="require('@/static/audio.mp3')"></sy-audio>

//项目为vue3时 src为本地路径时，使用自定义方法，如下:
<sy-audio :src="toUrl('../../static/audio.mp3')"></sy-audio>
methods: {
	toUrl(src){
		return new URL(src, import.meta.url).href
	}
}
```

> sy-audio将会持续更新，欢迎大家踊跃提出宝贵建议；
