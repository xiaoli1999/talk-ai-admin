const vipList = [
	{
		id: 'vip_7d',
		name: '周卡',
		day: 7,
		originalPrice: 1998, // 1398
		price: 1298, // 998
		hot: false,
		desc: '新人尝鲜'
	},
	{
		id: 'vip_30d',
		name: '月卡',
		day: 30,
		originalPrice: 3998, // 3998
		price: 2698, // 2498
		hot: true,
		desc: '超值特惠'
	},
	{
		id: 'vip_90d',
		name: '季卡',
		day: 90,
		originalPrice: 11998, // 9998
		price: 6898, // 5998
		hot: false,
		desc: '低至0.6/天'
	},
	{
		id: 'vip_1y',
		name: '年卡',
		day: 365,
		originalPrice: 38998, // 36998
		price: 22898, // 19998
		hot: false
	}
]

const cbList = [
	{
		id: 'cb_first',
		originalPrice: 1398,
		price: 996, // 368
		num: 360, // 360
		gift: 0, // 0 首充赠品不显示，数量必须为0
		hot: false,
	},
	{
		id: 'cb_1_600',
		price: 600, // 600
		num: 180, // 280
		gift: 0, // 0
		hot: false,
	},
	{
		id: 'cb_2_1800',
		price: 1800, // 1800
		num: 540,
		gift: 60, // 60
		hot: false
	},
	{
		id: 'cb_3_3200',
		price: 3200, // 3200
		num: 960,
		gift: 150, // 150
		hot: true
	},
	{
		id: 'cb_4_6800',
		price: 6800, // 6800
		num: 2060,
		gift: 360, // 360
		hot: false
	},
	{
		id: 'cb_5_11800',
		price: 11800, // 11800
		num: 3560,
		gift: 810, // 810
		hot: false
	},
	{
		id: 'cb_6_19800',
		price: 19800, // 19800
		num: 5980,
		gift: 1560, // 1560
		hot: false
	},
	{
		id: 'cb_7_32800',
		price: 32800, // 32800
		num: 9880,
		gift: 3060, // 3060
		hot: false
	},
	{
		id: 'cb_8_64800',
		price: 64800, // 64800
		num: 19580,
		gift: 7560, // 7560
		hot: false
	},
]

const vipQyList = [
	'每日多领3倍采贝',
	'超长对话记忆',
	'购买采贝多赠10%',
	'采贝永久累积',
	'会员社群资格',
	'免费角色微调',
	'100+音色体验',
	'亲密值双倍增加',
	'亲密值双倍保底',
	'捏崽优先审核',
	'高级模型体验',
	'高峰期优先回复'
]

/* 采贝说明文案（按次计费版）。⚠️ 文案里的档位单价是描述性文字——真正生效的单价在
 * talk-text/utils/model.js（T1-T5 档位）与 user/config.js talkPrice（灵感/语音）；改价时记得同步此处文案。*/
const cbDocList = [
	{
		title: '采贝是什么？',
		arr: [
			'“采贝”是采黎AI软件内的通用货币。',
			'采贝分免费采贝、付费采贝两种，付费采贝永久累积；消耗时优先扣免费采贝，不足再扣付费采贝。',
			'采贝用来解锁AI模型、语音、剧情、音色等付费功能，可通过做任务、充值会员/采贝等方式获取。',
		]
	},
	{
		title: '聊天怎么计费？（按次计费）',
		arr: [
			'聊天按「次」计费：每收到角色的一条回复，按所用模型档位固定扣采贝，与这条消息的长短无关。',
			'T1 日常 1 采贝/次，T2 恋爱 2 采贝/次，T3 梦女 3 采贝/次，T4 剧情 4 采贝/次，T5 梦境 5 采贝/次。',
			'畅聊卡有效期内、且所选模型支持畅聊卡时，聊天不额外消耗采贝。',
		]
	},
	{
		title: '语音 / 灵感怎么计费？',
		arr: [
			'语音播放：1 采贝/次，按次扣费（不再按字符数计算）。',
			'灵感回复：1 采贝/次。',
			'播放角色开场白不消耗采贝；已生成的语音再次播放不消耗采贝。',
			'采音阁为会员专属功能，当前限时免费。',
		]
	},
	{
		title: '为什么还有采贝却无法聊天/播放语音？',
		arr: [
			'当采贝余额不足本次所需时无法发起（如选用 T5 每次需 5 采贝，而余额不足 5）。充值或更换更低档位模型即可继续。',
			'若遇到其他问题请联系客服。'
		]
	},
]

const vipDocObj = {
	// wxVipUrl: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/wx/group-vip.jpg?2024-10-02',
	wxVipUrl: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/wx/caili.jpg', // 暂存用
	info: '微信群聊正在升级中，请耐心等待！ \n'
	// info: '扫描二维码，添加官方工作人员（备注付费用户入群）。' +
	// 	'\n 发送个人中心、会员中心截图入群。'
	// info: '🍎用户长按“采贝余额”区域获取采贝'
}

const cardList = [
	{
		id: 'card_1h',
		originalPrice: 2998,
		price: 999, // 999
		hour: 1, // 1
		gift: 3, // 3
		minute: 63, // 1*60 + 3
		hot: false,
	},
	{
		id: 'card_3h',
		originalPrice: 8998,
		price: 2898, // 2899
		hour: 3,  // 3
		gift: 15, // 15
		minute: 195, // 3*60 + 15
		hot: false,
	},
	{
		id: 'card_8h',
		originalPrice: 23998,
		price: 7898, // 7899
		hour: 8, // 16
		gift: 45, // 45
		minute: 525, // 8*60 + 45
		hot: true,
	}
]
const cardInfo = {
	show: true,
	cardTotal: 10000,
	title: '无限聊天 • 购买后立即生效 • 多次购买累积生效',
	desc: '*购买前请先点击右侧阅读畅聊卡说明👉。',
	tipImg: ''
}

const giftBagList = [
	{
		id: 'giftBag_week_fl',
		name: '周末福利礼包',
		originalPrice: 7998,
		price: 3998, // 4998
		freePrice: '40元',
		vip: 7,
		cb: 1200,
		card: 3,
		bg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/user/vip/gift-bag/week.png?date=05-09'
	},
	{
		id: 'giftBag_week_hh',
		name: '周末豪华礼包',
		originalPrice: 15998,
		price: 7998, // 9998
		freePrice: '80元',
		vip: 30,
		cb: 2500,
		card: 6,
		bg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/user/vip/gift-bag/week-pro.png?date=05-09',
		isPro: true
	}
]
const giftBagInfo = {
	show: true
}

module.exports = {
	vipList,
	cbList,
	vipQyList,
	cbDocList,
	vipDocObj,

	cardList,
	cardInfo,

	giftBagList,
	giftBagInfo
}
