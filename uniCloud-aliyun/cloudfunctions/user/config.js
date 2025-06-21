/* 正常版本 */
const cbNum = 20 // 普通用户-登录采贝奖励 20
const rewardPayCb = 60 // 会员用户-登录采贝奖励 60

const rewardCb = 5 // 更新信息奖励5
const inviteCb = 5 // 邀请奖励5

const videoAdCb = 2 // 广告视频奖励2
const lookVideoCount = 30 // 每天观看广告次数30次

const todayNeedTalkCount = 80 // 每天需要聊天60次才能领取采贝奖励
const rewardTodayTalkCb = 20 // 领取每天聊天奖励的采贝20个

const createSwiperList = [
	{
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/swiper/img-style.png',
		pageUrl: '/pages/doc/doc?type=捏崽新画风'
	},
	{
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/swiper/create-role.png',
		pageUrl: '/pages/doc/doc?type=创建采崽'
	},
	{
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/guide.png',
		pageUrl: '/pages/doc/doc?type=捏崽攻略'
	},
	// {
	// 	url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/ckeck.png',
	// 	pageUrl: '/pages/doc/doc?type=捏崽审核规范'
	// },
	// {
	//     url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/convention.png',
	//     pageUrl: '/pages/doc/doc?type=采黎AI社区公约&theme=dark'
	// },
]

// const giftBagSwiper = 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/user/swiper-61.png'
const giftBagSwiper = ''

const userBasicData = {
	cbNum, // 普通用户-登录采贝奖励
	rewardPayCb, // 会员用户-登录采贝奖励

	rewardCb, // 更新信息奖励5
	inviteCb, // 邀请奖励5

	videoAdCb, // 广告视频奖励2
	lookVideoCount, // 每天观看广告次数30次

	todayNeedTalkCount, // 每天需要聊天30次才能领取采贝奖励
	rewardTodayTalkCb, // 领取每天聊天奖励的采贝10个

	showHotSearch: true, // 展示热门搜索
	shareImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/share/share.png',

	createSwiperList,
	giftBagSwiper,

	imgVersion: 'default-2025-6-03-10-10',
}


module.exports = {
	AppID: 'wx260bd9caa0c332d3',
	AppSecret: '28fde98414a459bebbada964d2789584',

	cbNum, // 普通用户-登录采贝奖励
	rewardPayCb, // 会员用户-登录采贝奖励

	rewardCb, // 更新信息奖励5
	inviteCb, // 邀请奖励5

	videoAdCb, // 广告视频奖励2
	lookVideoCount, // 每天观看广告次数30次

	todayNeedTalkCount, // 每天需要聊天30次才能领取采贝奖励
	rewardTodayTalkCb, // 领取每天聊天奖励的采贝10个

	userBasicData
}
