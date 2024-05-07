const { XF, MINIMAX } = require('./config.js')
const CryptoJS = require("./utils/crypto-js.js")
const base64 = require("./utils/base64.js")

/* 数据库 */
const db = uniCloud.database();
const dbJQL = uniCloud.databaseForJQL(db)

/**
* @function createTalkUrl 创建url
* @returns { String } url 创建的url
*/
const createTalkUrl  = (url) => {
	const host = "spark-api.xf-yun.com";
	const apiKeyName = "api_key";
	const date = new Date().toGMTString();
	const algorithm = "hmac-sha256";
	const headers = "host date request-line";

	/* 区分普通用户和vip用户 */
	const { APPID, APISecret, APIKey, WSS, VERSION } = XF['vip']
	url = url || WSS

	// const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v3.1/chat HTTP/1.1`;
	const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /${VERSION}/chat HTTP/1.1`;
	const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, APISecret);
	const signature = CryptoJS.enc.Base64.stringify(signatureSha);

	const authorizationOrigin = `${apiKeyName}="${APIKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
	const authorization = base64.encode(authorizationOrigin);

	return {
		url: `${url}?authorization=${authorization}&date=${encodeURI(date)}&host=${host}`,
		appid: APPID
	}
}

module.exports = {
	_before: function () { // 通用预处理器

	},

	/**
	 * @function getTalkInfo 获取当前对话信息
	 * @param { Object } params { id, type } 系统id、表类型
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getTalkInfo ({ id, type } = {}) {
		try {
			if (!id) return { errMsg: '对话模型已失效' }
			if (!type) return { errMsg: '对话模型类型失效' }

			/* 获取对话信息 */
			const res = await dbJQL.collection(type).doc(id).get()
			const data = res && res.data && res.data.length ? res.data[0] : {}
			/* 增加该模型热度 */
			await db.collection(type).doc(id).update({ hot_count: db.command.inc(5) })

			return { data , errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getTalkUrl 获取对话url
	 * @param { Object } params { id, type, wss } 对话表id、表类型， wss链接
	 * @returns {object} { errMsg: '', data: { url: '', appid } } 错误信息及url
	 */
	async getTalkUrl ({ id, type, wss }) {
		try {
			const data = createTalkUrl(wss)

			if (id && type) {
				/* 增加该模型对话次数 */
				await db.collection(type).doc(id).update({ talk_count: db.command.inc(1) })
			}

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getRolesTalkAnswer 获取角色回答
	 * @param { Object } params { roleId, botName, userName, talkList } 角色id、Ai名称、用户名称、对话记录
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getRolesTalkAnswer ({ id, name, user_name, prompt, talkList } = {}) {
		try {
			if (!id) return { errMsg: '对话模型已失效' }

			const messages = talkList.map(i => ({
				sender_type: i.role === 'ai' ? 'BOT' : 'USER',
				sender_name: i.role === 'ai' ? name : user_name,
				text: i.content
			}))

			const requestBody = {
				/* 模型设定 */
				model: "abab5.5s-chat",
				tokens_to_generate: 1024,
				temperature: 0.88,
				top_p: 0.96,
				stream: false,
				mask_sensitive_info: true, /* 隐私打码 */

				/* 角色设定 */
				bot_setting: [
					{
						bot_name: name,
						content: prompt
					}
				],

				/* 指定角色模型回复 */
				reply_constraints: {
					sender_type: "BOT",
					sender_name: name
				},

				/* 对话消息 */
				messages

			}

			const params = {
				url: `https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=${MINIMAX.GROUPID}`,
				method: 'POST',
				header: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${MINIMAX.APIKEY}`,
				},
				data: requestBody
			}

			const { data } = await uniCloud.request(params)

			/* todo 判断返回信息并上报日志 */

			/* 增加该模型热度 */
			await db.collection('roles').doc(id).update({ talk_count: db.command.inc(1) })

			return { data , errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
	/**
	 * @function addTalkCount 增加模型对话次数
	 * @param { Object } params { id, type } 系统id、表类型
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async addTalkCount ({ id, type } = {}) {
		try {
			if (!id) return { errMsg: '对话模型已失效' }
			if (!type) return { errMsg: '对话模型类型失效' }

			/* 异步增加该模型热度 */
			await db.collection(type).doc(id).update({ talk_count: db.command.inc(1) })

			return { errMsg: '操作成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
	/**
	 * @function deductUserTalkCount 扣除用户对话次数
	 * @param { Object } params { id } 用户id、表类型
	 * @returns { object } { errMsg: '', data： {}} 用户对话次数及错误信息
	 */
	async deductUserTalkCount ({ id } = {}) {
		try {
			if (!id) return { errMsg: '找不到该用户' }

			/* 异步增加该模型热度 */
			const { data: userList } = await db.collection('users').doc(id).get()
			const currentUserInfo = { talk_count: userList[0].talk_count, vip_count: userList[0].vip_count }

			if (currentUserInfo.talk_count > 0) {
				currentUserInfo.talk_count -= 1
			} else if (currentUserInfo.vip_count > 0) {
				currentUserInfo.vip_count -= 1
			} else {
				return { data: currentUserInfo, errMsg: '暂无对话次数' }
			}

			const { doc } = await db.collection('users').doc(id).updateAndReturn(currentUserInfo)

			return { data: { talk_count: doc.talk_count, vip_count: doc.vip_count },  errMsg: '次数扣减成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
	/**
	 * @function addTalkContent 记录对话内容
	 * @param { Object } params { id, type } 系统id、表类型
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async addTalkContent (event) {
		try {
			if (!event.user_id) return { errMsg: '找不到该用户' }

			await dbJQL.collection('users_chats').add(event)

			return { errMsg: '操作成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

}
