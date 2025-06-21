const vipList = [
	// {
	// 	name: '3天会员',
	// 	day: 3,
	// 	originalPrice: 998, // 1398
	// 	price: 798, // 998
	// 	hot: false,
	// 	desc: '周末限时福利'
	// },
	{
		name: '周卡',
		day: 7,
		originalPrice: 1698, // 1398
		price: 1298, // 998
		hot: false,
		desc: '新人尝鲜'
	},
	{
		name: '月卡',
		day: 30,
		originalPrice: 4298, // 3998
		price: 2898, // 2498
		hot: true,
		desc: '超值特惠'
	},
	{
		name: '季卡',
		day: 90,
		originalPrice: 11998, // 9998
		price: 6898, // 5998
		hot: false,
		desc: '低至0.6/天'
	},
	{
		name: '年卡',
		day: 365,
		originalPrice: 38998, // 36998
		price: 22898, // 19998
		hot: false
	}
]

const cbList = [
	// {
	// 	originalPrice: 668,
	// 	price: 498, // 368
	// 	num: 200,
	// 	gift: 0,
	// 	hot: false,
	// },
	{
		originalPrice: 1398,
		price: 996, // 368
		num: 360, // 360
		gift: 0, // 0 首充赠品不显示，数量必须为0
		hot: false,
	},
	{
		price: 998, // 600
		num: 280,
		gift: 0, // 0
		hot: false,
	},
	{
		price: 1800, // 1800
		num: 540,
		gift: 60, // 60
		hot: false
	},
	{
		price: 3200, // 3200
		num: 960,
		gift: 150, // 150
		hot: true
	},
	{
		price: 6800, // 6800
		num: 2060,
		gift: 360, // 360
		hot: false
	},
	{
		price: 11800, // 11800
		num: 3560,
		gift: 810, // 810
		hot: false
	},
	{
		price: 19800, // 19800
		num: 5980,
		gift: 1560, // 1560
		hot: false
	},
	{
		price: 32800, // 32800
		num: 9880,
		gift: 3060, // 3060
		hot: false
	},
	{
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

const cbDocList = [
	{
		title: '采贝是什么？',
		arr: [
			'“采贝”是采黎AI软件内的通用货币。',
			'10/100 => 免费采贝/付费采贝。免费采贝每天凌晨重置，付费采贝永久累积。',
			'聊天时会自动消耗采贝，优先消耗免费采贝。',
			'采贝用来解锁ai模型、语音、剧情、音色等付费功能，可通过做任务、充值会员/采贝等方式获取。',
		]
	},
	{
		title: 'Token是什么？',
		arr: [
			'token是AI模型输入输出的计量单位。',
			'1个汉字约等于0.8~1.3个token。',
			'1采贝 = 1000token，不同的模型消耗采贝比例不同。在计算的过程中会存在小数，软件显示内会向上取整。'
		]
	},
	{
		title: '角色聊天消耗token逻辑是什么？',
		arr: [
			'角色预设prompt + 聊天上下文 + 用户输入 + 模型输出 = 该轮对话所消耗的token数。',
			'假设角色预设为200汉字，用户输入+模型输出为30汉字，该轮消耗token数约为230，消耗采贝数约为0.23。',
			'10采贝可与角色聊天40轮对话，角色预设prompt的大小会直接决定token消耗的数量。',
			'token消耗会随着聊天轮数（聊天记录）的增多而增大，请适当的清除聊天记录，以防消耗过多采贝。',
			'会员可使用角色微调功能，优化角色prompt信息大小，从而减少采贝的消耗。'
		]
	},
	{
		title: '语音消耗逻辑是什么？',
		arr: [
			'普通用户20字符消耗1采贝，付费用户（会员/付费采贝）40字符消耗1采贝。',
			'1个汉字算2个字符，英文字母、标点符号算1个字符。',
			'播放角色开场白不消耗采贝。',
			'已生成的语音再次播放不消耗采贝。',
			'采音阁为会员专属功能，当前限时免费。'
		]
	},
	{
		title: '为什么还有采贝却无法聊天/播放语音？',
		arr: [
			'假设：当前角色背景 + 聊天记录 = 1200token，而账户只有1采贝，故采贝余额不足。语音同理。',
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
		originalPrice: 2998,
		price: 999, // 999
		hour: 1, // 1
		gift: 3, // 3
		minute: 63, // 1*60 + 3
		hot: false,
	},
	{
		originalPrice: 8998,
		price: 2899, // 2899
		hour: 3,  // 3
		gift: 15, // 15
		minute: 195, // 3*60 + 15
		hot: true,
	},
	{
		originalPrice: 23998,
		price: 7899, // 7899
		hour: 8, // 16
		gift: 45, // 45
		minute: 525, // 8*60 + 45
		hot: false,
	},
]
const cardInfo = {
	show: true,
	cardTotal: 100,
	title: '无限聊天 • 购买后立即生效 • 多次购买累积生效',
	desc: '*购买前请先点击右侧阅读畅聊卡说明👉。',
	tipImg: ''
}

const giftBagList = [
	{
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
