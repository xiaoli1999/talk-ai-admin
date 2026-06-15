module.exports = {
	wxPay: {
		appId: 'wx260bd9caa0c332d3',
		mchId: '1662504735',
		v3Key: 'MTU4MjkzNTE1NTUxNTkwMjkxMDY5NTI2',
	},
	wxVirtualPay: {
		appId: "wx260bd9caa0c332d3", // 小程序的appid
		secret: "28fde98414a459bebbada964d2789584",
		mchId: 1739865682, // 商户id
		offerId: "1450483577", // 支付应用ID
		appKey: "lhd2CdOhxu7VMtrbfl0Wok3ZfJQmqBSE", // 现网AppKey（正式环境）
		sandboxAppKey: "", // 沙箱AppKey
		rate: 100, // 代币兑换比例，比如1元兑换100代币，那么这里就是100（需要开通虚拟支付的时候也设置成 1 人民币 = 100 代币）
		token: "CAILIAI", // 微信小程序通信的token，在开发 - 开发管理 - 消息推送 - Token(令牌)
		encodingAESKey: "FkmeS5B6bpfsU8HXHJutOCEEPn0xq9gmCy3D62swkln", // 必须43位，微信小程序消息加密密钥，在开发 - 开发管理 - 消息推送 - EncodingAESKey(消息加解密密钥)
		notifyUrl: 'https://fc-mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.next.bspapp.com/pay-v2/notify',


		sandbox: false, // 是否是沙箱环境（注意：沙箱环境异步回调可能有延迟，建议直接正式环境测试）
		v3VirtualDevKey: 'ammmD9pV3ZeJc1WdqSrWmwAMjQdI05f8',
		v3VirtualProKey: 'lhd2CdOhxu7VMtrbfl0Wok3ZfJQmqBSE',
	},
}
