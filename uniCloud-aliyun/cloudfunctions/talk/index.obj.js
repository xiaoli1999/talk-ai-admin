const { XF, MINIMAX } = require('./config.js')
const CryptoJS = require("./utils/crypto-js.js")
const base64 = require("./utils/base64.js")
const voiceData = require('./utils/voice')
const { getTalkTextRealValue } = require('./utils/common')

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

	/* 所有用户都用3.5 */
	const { APPID, APISecret, APIKey, WSS, VERSION } = XF
	url = url || WSS

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
			await db.collection(type).doc(id).update({ hot_count: db.command.inc(10), today_hot_count: db.command.inc(10) })

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
				const params = {
					talk_count: db.command.inc(1),
					hot_count: db.command.inc(1)
				}
				await db.collection(type).doc(id).update(params)
			}

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getRolesTalkAnswer 获取角色回答
	 * @param { Object } params { name, user_name, prompt, talkList } 角色id、Ai名称、用户名称、对话记录
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getRolesTalkAnswer ({ name, user_name, prompt, talkList } = {}) {
		try {
			// if (!id) return { errMsg: '对话模型已失效' }

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

			return { data , errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
	/**
	 * @function deductUserTalkCount 扣除用户对话次数
	 * @param { Object } params { id } 用户id、表类型
	 * @returns { object } { errMsg: '', data： {}} 用户对话次数及错误信息
	 */
	async deductUserTalkCount ({ id, role_id, tokens, sound_tokens } = {}) {
		try {
			if (!id) return { errMsg: '找不到该用户' }

			tokens = tokens || 0
			sound_tokens = sound_tokens || 0
			let useCbNum = 0

			if (tokens) {
				useCbNum = (tokens / 1000).toFixed(2) - 0
			} else if (sound_tokens) {
				useCbNum = (sound_tokens / 20).toFixed(2) - 0
			} else {
				useCbNum = 1
			}

			/* 异步增加该模型热度 */
			const { data: userList } = await db.collection('users').doc(id).get()
			let { cb_num, cb_pay_num } = userList[0]
			cb_num = cb_num || 0, cb_pay_num
			cb_pay_num = cb_pay_num || 0

			const params = { cb_num, cb_pay_num }

			if ((cb_num + cb_pay_num) > useCbNum) {
				/* 先使用免费采贝 */
				if (cb_num >= useCbNum) {
					params.cb_num = parseInt((cb_num - useCbNum) * 100) / 100
				} else {
					const num = useCbNum - cb_num
					params.cb_pay_num = parseInt((cb_pay_num - num) * 100) / 100

					params.cb_num = 0
				}
			} else {
				params.cb_num = 0
				params.cb_pay_num = 0
			}

			const { doc } = await db.collection('users').doc(id).updateAndReturn(params)

			/* 兼容旧版本 */
			if (role_id) {
				/* 增加该模型热度 */
				let addCount = sound_tokens ? 2 : 1
				const rolesParams = {
					talk_count: db.command.inc(addCount),
					hot_count: db.command.inc(addCount),
					today_hot_count: db.command.inc(addCount),
					today_talk_count: db.command.inc(addCount),
					last_talk_time: Date.now()
				}
				await db.collection('roles').doc(role_id).update(rolesParams)
			}


			return { data: { cb_num: doc.cb_num, cb_pay_num: doc.cb_pay_num },  errMsg: '采贝扣减成功' }
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

	/**
	 * 音频
	 */

	/**
	 * @function getVoiceData 获取音色数据
	 * @param { Object } params { version } 音色版本号
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getVoiceData ({ version } = {}) {
		try {
			if (version === voiceData.version) {
				return { data: null, errMsg: '音色未更新' }
			} else {
				return { data: voiceData, errMsg: '获取成功' }
			}
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getTalkSound 获取对话音频
	 * @param { Object } params { id, text } 角色id、文本内容text
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getRoleExampleSound ({ id, name, text } = {}) {
		try {
			let textValue = getTalkTextRealValue(text)

			const requestBody = {
				model: "speech-01-240228",
				text: textValue || text,
				stream: false,
				voice_setting:{
					voice_id: id,
					speed: 1,
					vol: 1,
					pitch: 0
				},
				audio_setting:{
					sample_rate: 32000,
					bitrate: 128000,
					format: "wav",
					channel: 2
				}
			}

			const params = {
				url: `https://api.minimax.chat/v1/t2a_v2?GroupId=${MINIMAX.GROUPID}`,
				method: 'POST',
				header: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${MINIMAX.APIKEY}`,
				},
				data: requestBody
			}

			const { data: { data } } = await uniCloud.request(params)
			if (!data) return { data: null, errMsg: '语音生成失败' }

			const buffer = Buffer.from(data.audio, 'hex');

			/* 上传文件 */
			const result = await uniCloud.uploadFile({
				cloudPath: `/sound/role-prologue/${name}/${Date.now()}.mp3`,
				cloudPathAsRealPath: true,
				fileContent: buffer
			});

			return { data: { url: result.fileID } , errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getTalkSound 获取对话音频
	 * @param { Object } params { voice_id, text } 音色voice_id、文本内容text
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getTalkSound ({ voice_id, text } = {}) {
		try {
			const requestBody = {
				model: "speech-01-240228",
				text,
				stream: false,
				voice_setting:{
					voice_id,
					speed: 1,
					vol: 1,
					pitch: 0
				},
				audio_setting:{
					sample_rate: 32000,
					bitrate: 128000,
					format: "mp3",
					channel: 1
				},
				"pronunciation_dict":{
					"tone": ["操/(cao4)", "草/(cao4)"]
				},
			}

			const params = {
				url: `https://api.minimax.chat/v1/t2a_v2?GroupId=${MINIMAX.GROUPID}`,
				method: 'POST',
				header: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${MINIMAX.APIKEY}`,
				},
				data: requestBody
			}

			const { data: { data, extra_info } } = await uniCloud.request(params)
			if (!data) return { data: null , errMsg: '语音生成失败' }

			const buffer = Buffer.from(data.audio, 'hex');

			/* 上传文件 */
			const result = await uniCloud.uploadFile({
				cloudPath: `/sound/user-talk/test-${Date.now()}.mp3`,
				cloudPathAsRealPath: true,
				fileContent: buffer
			});

			return { data: { url: result.fileID, characters: extra_info.usage_characters } , errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * 音频数据初始化
	 */

	/**
	 * @function batchSetSoundUrl 批量设置音色
	 * @param { Object } params { roleId, botName, userName, talkList } 角色id、Ai名称、用户名称、对话记录
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async batchSetSoundUrl() {
		const list = [
			/* 官方音色 */
			{
				"id": "Bingjiao_zongcai_platform",
				"name": "霸道严主",
				"tag": [
					"男",
					"青年",
					"严主"
				],
				"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/霸道严主.wav",
				"cb": 1,
				"text": "跪好了，知道错了吗？"
			},
			{
				"id": "wuzhao_test_4",
				"name": "撒娇女友",
				"tag": [
					"女",
					"青年",
					"撒娇"
				],
				"url": "https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/sound/example/撒娇女友.wav",
				"cb": 1,
				"text": "宝宝， 人家求你了！"
			},
		]

		for (let i = 0; i < list.length; i++) {
			console.log('----当前为第---', (i - 0) +1)
			const { id, text, name } = list[i]

			const requestBody = {
				model: "speech-01-240228",
				text,
				stream: false,
				voice_setting:{
					voice_id: id,
					speed: 1,
					vol: 1,
					pitch: 0
				},
				audio_setting:{
					sample_rate: 32000,
					bitrate: 128000,
					format: "wav",
					channel: 2
				}
			}

			const params = {
				url: `https://api.minimax.chat/v1/t2a_v2?GroupId=${MINIMAX.GROUPID}`,
				method: 'POST',
				header: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${MINIMAX.APIKEY}`,
				},
				data: requestBody
			}

			const { data: { data, extra_info } } = await uniCloud.request(params)
			if (!data) {
				console.log('\n 该语音合成失败 \n')
			} else {
				const buffer = Buffer.from(data.audio, 'hex');

				/* 上传文件 */
				const result = await uniCloud.uploadFile({
					cloudPath: `/sound/example/${name}.wav`,
					cloudPathAsRealPath: true,
					fileContent: buffer
				});

				list[i].url = result.fileID
			}
		}

		console.log('---------list---------\n')

		return { list }
	}
}
