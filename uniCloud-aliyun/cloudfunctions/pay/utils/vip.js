const vipList = [
	{
		name: '周卡',
		day: 7,
		originalPrice: 998,
		price: 698, // 698
		hot: false,
		desc: '新用户尝鲜'
	},
	{
		name: '月卡',
		day: 30,
		originalPrice: 3698,
		price: 1998, // 1998
		hot: true,
		desc: '限时特价'
	},
	{
		name: '季卡',
		day: 90,
		originalPrice: 8998,
		price: 4998, // 4998
		hot: false,
		desc: '低至0.5/天'
	},
	{
		name: '年卡',
		day: 365,
		originalPrice: 32998,
		price: 13898, // 13898
		hot: false
	}
]

const cbList = [
	{
		originalPrice: 568,
		price: 368, // 368
		num: 100,
		gift: 0,
		hot: false,
	},
	{
		price: 600, // 600
		num: 120,
		gift: 0,
		hot: false,
	},
	{
		price: 1800, // 1800
		num: 360,
		gift: 40,
		hot: false
	},
	{
		price: 3200, // 3200
		num: 640,
		gift: 100,
		hot: true
	},
	{
		price: 6800, // 6800
		num: 1360,
		gift: 240,
		hot: false
	},
	{
		price: 11800, // 11800
		num: 2360,
		gift: 540,
		hot: false
	},
	{
		price: 19800, // 19800
		num: 3960,
		gift: 1040,
		hot: false
	},
	{
		price: 32800, // 32800
		num: 6560,
		gift: 2040,
		hot: false
	},
	{
		price: 64800, // 64800
		num: 12960,
		gift: 5040,
		hot: false
	},
]

const vipQyList = [
	'每日领取6倍采贝',
	'无上限对话记忆',
	'购买采贝赠送10%',
	'高峰期优先回复',
	'会员社群资格',
	'免费角色微调'
]

const cbDocList = [
	{
		title: '采贝是什么？',
		arr: [
			'“采贝”是采黎AI软件内的通用货币。',
			'10/100 => 免费采贝/付费采贝。免费采贝每天凌晨重置，付费采贝永久累积。',
			'聊天时会自动消耗采贝，采贝还可以解锁语音、剧情、音色等付费功能。',
			'可通过福利中心、开通会员、充值采贝等方式获取采贝。'
		]
	},
	{
		title: 'Token是什么？',
		arr: [
			'token是AI模型输入输出的计量单位。',
			'1个汉字约等于0.8~1.3个token。',
			'1采贝 = 1000token。在计算的过程中会存在小数，软件显示内会向上取整。'
		]
	},
	{
		title: '角色聊天消耗token逻辑是什么？',
		arr: [
			'角色预设prompt + 聊天上下文 + 用户输入 + 模型输出 = 该轮对话所消耗的token数。',
			'假设角色预设为200汉字，用户输入+模型输出为30汉字，该轮消耗token数约为230，消耗采贝数约为0.23。',
			'10采贝可与角色聊天40轮对话，角色预设prompt的大小会直接决定token消耗的数量。',
			'token消耗会随着聊天轮数（聊天记录）的增多而增大，请适当的清除聊天记录，以防消耗过多采贝。',
			'会员可使用角色微调功能，优化角色prompt信息大小，从而减少采贝的小号。'
		]
	},
	{
		title: '为什么还有采贝却无法聊天？',
		arr: [
			'假设：当前角色背景 + 聊天记录 = 1200token，而账户只有1采贝，故采贝余额不足。',
			'若遇到其他问题请联系客服。'
		]
	},
]

const vipDocObj = {
	wxUrl: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/wx/wx.jpg?2024-07-15-17-01',
	info: '新版会员已取消无限聊天功能，改为按量扣费，请谅解。 \n 我们正在不断加强会员特权，为您提供会员专享权益！'
}


module.exports = {
	vipList,
	cbList,
	vipQyList,
	cbDocList,
	vipDocObj
}
