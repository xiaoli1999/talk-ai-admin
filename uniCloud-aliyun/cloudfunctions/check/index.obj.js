const UniSecCheck = require('uni-sec-check');

module.exports = {
	_before: function () { // 通用预处理器

	},
	async checkText ({ content, openid } = {}) {
		try {
			// 初始化实例
			const uniSecCheck = new UniSecCheck({
				provider: 'mp-weixin',
				requestId: this.getUniCloudRequestId(), // 云函数内则写 context.requestId 云对象内则写 this.getUniCloudRequestId()
			});

			const { result } = await uniSecCheck.textSecCheck({
				// content: '特3456书yuuo莞6543李zxcz蒜7782法fgnv级 完2347全dfji试3726测asad感3847知qwez到', // 文本内容，不可超过500KB
				content, // 文本内容，不可超过500KB
				openid, // 用户的小程序openid
				scene: 1, // 场景值
				version: 2, // 接口版本号
			});

			return { data: result || {} , errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
	async checkImg ({ image } = {}) {
		try {
			// 初始化实例
			const uniSecCheck = new UniSecCheck({
				provider: 'mp-weixin',
				requestId: this.getUniCloudRequestId(), // 云函数内则写 context.requestId 云对象内则写 this.getUniCloudRequestId()
			});

			const data = await uniSecCheck.textSecCheck({
				image: '', // 文本内容，不可超过500KB
				openid: '', // 用户的小程序openid
				scene: 1, // 场景值
				version: 1, // 接口版本号
			});
			console.log('checkRes: ', data);

			return { data , errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
}
