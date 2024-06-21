const vipList = [
	{
		name: '天会员',
		date: 1,
		day: 1,
		originalPrice: 298,
		price: 98,
		hot: true,
		desc: '新用户优惠'
	},
	{
		name: '天会员',
		date: 1,
		day: 1,
		originalPrice: 298,
		price: 198,
		hot: false
	},
	{
		name: '天会员',
		date: 3,
		day: 3,
		originalPrice: 800,
		price: 498,
		hot: false
	},
	{
		name: '天会员',
		date: 7,
		day: 7,
		originalPrice: 1600,
		price: 998,
		hot: true
	},
	{
		name: '月会员',
		date: 1,
		day: 30,
		originalPrice: 3600,
		price: 2898,
		hot: true
	},
	{
		name: '月会员',
		date: 3,
		day: 90,
		originalPrice: 8999,
		price: 6698,
		hot: false
	},
	{
		name: '年会员',
		date: 1,
		day: 365,
		originalPrice: 30000,
		price: 26999,
		hot: false
	}
]

const vipGainList = [
	'会员每天不限对话次数，助您畅快体验！',
	'会员支持联系上下文对话， 最高可支持1w中文、6k英文字数。',
	'会员将优先体验我们推出的新功能，快人一步享受。',
	'会员将有资格进入“会员社群”，可与其他会员互相交流，提出新功能建议等。',
	'我们为会员提供最新的AI模型，在文案生成、语义理解、知识问答、陪伴聊天等方面都有显著提升。',
	'购买会员后即刻生效；若会员未到期续费会员后，我们会自动为您续约会员',
	'会员为虚拟商品，暂不支持退款（建议先购买新人套餐体验）。',
]

module.exports = {
	vipList,
	vipGainList
}
