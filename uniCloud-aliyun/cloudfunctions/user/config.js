/* 正常版本 */
const cbNum = 20 // 普通用户-登录采贝奖励 20
const rewardPayCb = 60 // 会员用户-登录采贝奖励 60

const rewardCb = 5 // 更新信息奖励5
const inviteCb = 5 // 邀请奖励5

const videoAdCb = 2 // 广告视频奖励2
const lookVideoCount = 30 // 每天观看广告次数30次

const todayNeedTalkCount = 60 // 每天需要聊天30次才能领取采贝奖励
const rewardTodayTalkCb = 20 // 领取每天聊天奖励的采贝10个


const userBasicData = {
	cbNum, // 普通用户-登录采贝奖励
	rewardPayCb, // 会员用户-登录采贝奖励

	rewardCb, // 更新信息奖励5
	inviteCb, // 邀请奖励5

	videoAdCb, // 广告视频奖励2
	lookVideoCount, // 每天观看广告次数30次

	todayNeedTalkCount, // 每天需要聊天30次才能领取采贝奖励
	rewardTodayTalkCb, // 领取每天聊天奖励的采贝10个

	showHotSearch: false, // 展示热门搜索
	shareImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/share/share.png',

	imgVersion: 'default-3-10-00-00',
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
