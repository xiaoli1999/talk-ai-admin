/* 正常版本 */
const cbNum = 20 // 普通用户-登录采贝奖励 20
const rewardPayCb = 60 // 会员用户-登录采贝奖励 60

const rewardCb = 5 // 更新信息奖励5
const inviteCb = 10 // 邀请奖励5

const videoAdCb = 2 // 广告视频奖励2
const lookVideoCount = 30 // 每天观看广告次数30次

const todayNeedTalkCount = 60 // 每天需要聊天60次才能领取采贝奖励
const rewardTodayTalkCb = 20 // 领取每天聊天奖励的采贝20个

const addMpRewardCb = 20 // 「添加到我的小程序」一次性奖励采贝 20

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
	addMpRewardCb, // 「添加到我的小程序」一次性奖励采贝

	showHotSearch: true, // 展示热门搜索
	shareImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/share/share.png',

	createSwiperList,
	giftBagSwiper,

	/* 星球页右上角排行榜入口图标，置空即下线入口 */
	rankingLogo: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/role/ranking/ranking-logo.png?x-oss-process=image/resize,w_400',

	/* 邀新功能入口（可插拔）：返回 inviteEntry: true 才展示福利中心入口，false 或不返回(注释)即隐藏；inviteBanner 置空则首页不展示 banner 入口 */
	inviteEntry: true,   // ← 要上线福利中心入口时，取消本行注释
	inviteBanner: '',

	/* 「添加到我的小程序」任务入口（可插拔）：返回 addMpEntry: true 才展示，false 或不返回(注释)即隐藏 */
	addMpEntry: true,

	/* 模型升级公告弹窗（可插拔）：show 为 true 且配了图才弹，先于登录奖励、每天弹（用户可勾"今日不再提示"）。
	   下线 = false 或注释；图任意比例（3:2/16:9/4:3），弹窗内按 4:3 居中裁切 */
	upgradePopupShow: true, // ← 上线弹窗时改 true（线上需重传 user 云对象）
	upgradePopupImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/banner-model.png?x-oss-process=image/resize,w_600',     // ← 运营图 URL

	imgVersion: 'default-2026-02-16-00-00',
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
	addMpRewardCb, // 「添加到我的小程序」一次性奖励采贝

	userBasicData
}
