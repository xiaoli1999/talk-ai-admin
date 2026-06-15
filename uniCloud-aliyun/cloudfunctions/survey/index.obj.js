// survey/index.js
const { questions }  = require('./config.js')
const db = uniCloud.database();

module.exports = {
	_before: function () {
		// 可以在这里做 token 校验等前置拦截
		// this.clientInfo.uid
	},

	/**
	 * 获取问卷配置
	 */
	async getConfig({ userId }) {
		const { data: surveyList } = await db.collection('surveys').where({ user_id: userId }).get();

		const isCompleted = surveyList && surveyList.length > 0;

		return {
			isOpen: true,
			title: "体验官调研问卷",
			// 修改：将文案替换为富文本格式，段落划分更清晰，加入加粗高亮
			intro: `
                <div style="">
                    <p style="margin-bottom: 8px; color: #d4d4d8;">嗨！采友们，大家好。</p>
                    <p style="margin-bottom: 8px;">过去的一年里，因为一些不可抗力，采黎AI经历了漫长的停更与蛰伏。但好在，我们终于挺过来了，带着全新的期待重新出发！感谢你依然记得我们，甚至还在默默陪伴。</p>
                    <p style="margin-bottom: 8px;">为了把采黎AI打造成最懂你的“梦中情AI”，我们非常需要你的“神仙脑洞”和“无情吐槽”。请放心大胆地说出你的真实想法，尽管开火！运营、开发组的每一个同学都会逐字认真看，虚心接受，并快马加鞭地把你们的期待变成现实。</p>
                    <p style="margin-bottom: 8px;"><strong style="color: #c084fc;">你的每一句话都价值千金，认真填写问卷，我们将直接送上 50 采贝 的小心意！</strong></p>
                </div>
            `,
			isCompleted,
			questions: isCompleted ? [] : questions
		}
	},

	/**
	 * 提交问卷
	 */
	async submit(data) {
		const { answers, duration, userId, source } = data;

		// 云端再次校验时长防刷
		if (duration < 60) {
			return { code: 400, msg: '填写速度太快啦，请仔细阅读题目哦~' };
		}

		try {
			// 1. 数据入库
			await db.collection('surveys').add({
				answers,
				duration,
				user_id: userId,
				source
			});

			/* 发放采贝奖励 */
			const { data: userList } = await db.collection('users').doc(userId).get()
			let { cb_num } = userList[0]

			cb_num = parseInt(cb_num  + 50)

			/* 更新用户采贝余额 */
			const { doc } = await db.collection('users').doc(userId).updateAndReturn({ cb_num })

			//返回数据给客户端
			return { data: doc, errMsg: '提交成功，50采贝已发放到账！' }
		} catch (e) {
			console.error(e);
			return { data: null, errMsg: e.message };
		}
	}
}
