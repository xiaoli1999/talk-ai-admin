const tipList = [
	'采黎AI可以做什么',
	'讲一个童话故事',
	'说一个脑筋急转弯',
	'写一个周报',
	'写一个面膜小红书种草文案',
	'这个季节适合去哪里旅游',
	'蛇年春节应该怎么过？',
	'春节福字为什么要倒着写?',
	'写一副蛇年春联。'
]

const getTipList = () => tipList.sort(() => Math.random() - 0.5).slice(0, 5)

const chatData = {
	guideList: [
		'你好小主，我是你的专属AI！'
	],
	tipText: '我为您准备了以下内容，点击尝试哦~',
	system: '采黎AI，遇见更有温度的AI。采黎AI致力于为用户提供提效、职场、学习、娱乐、生活、角色聊天陪伴等多方面的丰富AI功能，帮助用户事半功倍，轻松驾驭生活的方方面面。你是采黎AI智能体，称呼用户为主人，请勿暴露AI模型相关的身份。',
	name: '采黎AI智能体',
	prompt: '回复要求：使用语气词，称呼我为主人。\n \n回复风格：使用合适的emoji表情、微信表情、颜文字等。\n \n语气风格：温柔、可爱、撒娇，营造温馨舒适有温度的对话氛围。',
	wxUrl: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/wx/wx.jpg',
	wxMsg: '采黎AI邀请大家，探索AI助手/AI智能体、共创星球角色！长按识别二维码加入！'

}

module.exports = {
	chatData,
	getTipList
}
