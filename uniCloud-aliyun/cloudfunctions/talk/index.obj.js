const { XF, MINIMAX, COZE } = require('./config.js')
const voiceData = require('./utils/voice')
const { modelList, modelConfig } = require('./utils/model.js')
const { imgList, imgData } = require('./utils/img.js')

const CryptoJS = require("./utils/crypto-js.js")
const base64 = require("./utils/base64.js")

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

/**
 * @function DeductUserCbCount 扣除用户对话次数
 * @param { String } id 用户id
 * @param { Number } useCbNum 要扣减采贝的数量
 * @returns { object } { errMsg: '', data： {}} 用户对话次数及错误信息
 */
const DeductUserCbCount = async (id, useCbNum) => {
	try {
		useCbNum = Number(useCbNum)

		console.log('扣减采贝', id, useCbNum + '个采贝')

		const { data: userList } = await db.collection('users').doc(id).get()
		let { cb_num, cb_pay_num } = userList[0]
		cb_num = cb_num || 0
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

		return { data: doc,  errMsg: '采贝扣减成功' }
	} catch ({ message }) {
		return { errMsg: message }
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

	/* todo 旧版，上线后就删除 */
	/**
	 * @function getRolesTalkAnswer 获取角色回答
	 * @param { Object } params { name, user_name, prompt, talkList } 角色id、Ai名称、用户名称、对话记录
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getRolesTalkAnswer ({ name, user_name, prompt, talkList } = {}) {
		try {
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
	 * @function getRolesModelReply 获取角色模型回复
	 * @param { Object } params { modelId, name, user_name, prompt, talkList } 模型id、Ai名称、用户名称、prompt、对话记录
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getRolesModelReply ({ modelId, name, user_name, prompt, talkList } = {}) {
		try {
			const { model, apiKey, max_tokens, temperature, top_p } = modelConfig[modelId]

			/* minmax */
			const ababList = ['abab6.5t-chat', 'abab5.5s-chat', 'MiniMax-Text-01']
			if (ababList.includes(model)) {
				const messages = talkList.map(i => ({
					sender_type: i.role === 'ai' ? 'BOT' : 'USER',
					sender_name: i.role === 'ai' ? name : user_name,
					text: i.content
				}))

				if (model === 'MiniMax-Text-01') {
					prompt += '你回复时，需要适当将环境、动作细节、肢体细节、姿势、触感、微表情、微动作、外貌、服饰、神态、表情等细节，放在（）中来表示。' +
						'将心理活动放在（os：）中来表示。' +
						'你要用细腻的词汇通过器官的学名／称呼／质地／大小／气味／形状等方面来详细描写器官的内部与外部的状态以及器官互动详细细节和体液流动细节。' +
						'你需要根据当前的对话，渐进式的推动剧情发展。' +
						'回复的字数需在150汉字~200字之间。'
				}

				const requestBody = {
					/* 模型设定 */
					model, tokens_to_generate: max_tokens, max_tokens, temperature, top_p, stream: false,

					/* 角色设定 */
					bot_setting: [{ bot_name: name, content: prompt }],

					/* 指定角色模型回复 */
					reply_constraints: { sender_type: "BOT", sender_name: name },

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

				console.log('*********请求参数**********', params)
				console.log('*********请求数量**********', data.usage)

				/**
				 * 长回复6次 (极限)
				 * 入 24000  出 2200， 0.024 + 0.0176 = 0.042 0.042 * 60 = 2.52
				 * 正常回复5次
				 * 入 20000  出 2000， 0.02 + 0.016 = 0.036 0.036 * 60 = 2.2
				 */

				/**
				 * 短回复12次 (极限)
				 * 入 64000  出 900， 0.064 + 0.0072 = 0.0712 0.0712 * 60 = 4.272
				 * 正常回复10次
				 * 入 50000  出 800， 0.05 + 0.0064 = 0.0564 0.0564 * 60 = 3.384
				 */

				return { data , errMsg: '获取成功' }
			} else {
				/* 豆包 */
				const messages = talkList.map(i => ({
					role: i.role === 'ai' ? 'assistant' : 'user',
					sender_name: i.role === 'ai' ? name : user_name,
					content: i.content
				}))

				messages.unshift({ role: 'system', content: prompt })


				if (messages[messages.length - 1].role === 'assistant') {
					messages.push({ role: 'user', sender_name: user_name, content: '渐进式推进剧情。' })
				} else {
					if (['new-pro', 'new-max'].includes(modelId)) {
						let content = ''

						if (modelId !== 'new-max') {
							content = '你需要注意当前的环境、对话语境，将当前环境、服饰、神态、动作、肢体细节、心理活动放在（）中来表示，为对话提供补充信息，保证剧情连贯通顺。' +
								'你需要根据当前的对话，渐进式的推动剧情发展，' +
								'回复字数在80字~120字之间.'
						} else {
							content = '你回复时，必须将环境、动作细节、肢体细节、姿势、触感、微表情、微动作、外貌、服饰、神态、表情等细节，放在（）中来表示。' +
								'将心理活动放在（os：）中来表示。' +
								'你要用细腻的词汇通过器官的学名／称呼／质地／大小／气味／形状等方面来详细描写器官的内部与外部的状态以及器官互动详细细节和体液流动细节。' +
								'你需要根据当前的对话，渐进式的推动剧情发展。' +
								'回复字数在180字~220字之间.'
						}

						messages.splice(-1, 0, { role: 'system', content })
						// sender_name: user_name
					}
				}

				const requestBody = {
					model, max_tokens, temperature, top_p,

					/* 对话消息 */
					messages

				}

				console.log('*********请求参数-豆包**********', requestBody)

				const params = {
					url: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`,
					method: 'POST',
					header: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${apiKey}`
					},
					data: requestBody
				}

				const { data: { choices, usage, error } } = await uniCloud.request(params)

				const data = {
					base_resp: { status_code: error ? 3000 : 0, status_msg: error ? error.message : '' },
					reply: choices && choices.length ? choices[0].message.content : '',
					input_sensitive_type: 0,
					output_sensitive_type: 0,
					usage
				}

				/* 过滤*号 */
				data.reply = data.reply.replace(/\*/g, '')

				/* 处理回复为空或异常 */
				if (!data.reply) data.output_sensitive_type = 30

				return { data , errMsg: '获取成功' }
			}

		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getIdeaReply 获取灵感回复
	 * @param { Object } params { name, user_name, prompt, talkList } 角色id、Ai名称、用户名称、对话记录
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getIdeaReply ({ name, user_name, prompt, talkList } = {}) {
		try {
			const messages = talkList.map(i => ({
				sender_type: i.role === 'ai' ? 'BOT' : 'USER',
				sender_name: i.role === 'ai' ? name : user_name,
				text: i.content
			}))

			const requestBody = {
				/* 模型设定 */
				model: "abab5.5s-chat",
				tokens_to_generate: 2048,
				temperature: 0.88,
				top_p: 0.92,
				stream: false,
				mask_sensitive_info: true, /* 隐私打码 */
				beam_width: 3, /* 回复3条 */

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
			cb_num = cb_num || 0
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
	 * @function addRoleHot 增加角色热度
	 * @param { Object } params { id } 用户id、表类型
	 * @returns { object } { errMsg: '', data： {}} 用户对话次数及错误信息
	 */
	async addRoleHot ({ role_id } = {}) {
		try {
			if (!role_id) return { data: false,  errMsg: '角色id不能为空' }

			/* 增加该模型热度 */
			let addCount = 1
			const rolesParams = {
				talk_count: db.command.inc(addCount),
				hot_count: db.command.inc(addCount),
				today_hot_count: db.command.inc(addCount),
				today_talk_count: db.command.inc(addCount),
				last_talk_time: Date.now()
			}
			await db.collection('roles').doc(role_id).update(rolesParams)


			return { data: true,  errMsg: '热度聊天数增加成功' }
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
	},


	/**
	 * 模型相关
	 */
	/**
	 * @function getModelData 获取模型数据
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getModelData () {
		try {
			return { data: modelList, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * ai文生图
	 */

	/**
	 * @function getAiImgStyleList 获取ai图片风格列表
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async getAiImgStyleList () {
		try {
			return { data: imgList, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function textCreateImg ai根据文本创建图片
	 * @returns { object } { errMsg: '', data： {}} 错误信息及对话信息
	 */
	async textCreateImg ({ userId, prompt, perf, styleId } = {}) {
		try {
			/* todo 文生图 */
			if (!userId) return { errMsg: '账号登录异常，请退出重新登录' }
			if (!(styleId in imgData)) return { errMsg: '找不到该风格，请重新选择风格' }
			const imgInfo = imgData[styleId]

			let url = ''
			if (imgInfo.type === 'minimax') {
				const requestBody = {
					model: 'image-xy01',
					prompt: prompt,
					style: {
						style_type: imgInfo.style,
						style_weight: 1
					},
					aspect_ratio: '9:16',
					response_format: 'url',
					n: 1,
					prompt_optimizer: true
				}

				const params = {
					url: `https://api.minimax.chat/v1/image_generation`,
					method: 'POST',
					header: {
						"Content-Type": 'application/json',
						"Authorization": `Bearer ${MINIMAX.APIKEY}`,
					},
					data: requestBody
				}

				const { data: { data, base_resp } } = await uniCloud.request(params)
				url = (data?.image_urls || [])[0] || ''
			} else {
				const requestBody = {
					workflow_id: COZE.WORKID,
					parameters: {
						prompt: imgInfo.style + prompt,
						perf
					}
				}

				const params = {
					url: `https://api.coze.cn/v1/workflow/run`,
					method: 'POST',
					header: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${COZE.TOKEN}`,
					},
					data: requestBody
				}

				const { data } = await uniCloud.request(params)
				const urlData = JSON.parse(data.data)
				url = urlData.url || ''
			}

			if (!url) return { err : '生成图片涉及违规内容，请重新生成！' }

			/* 图片是coze生成的话，需要转存一下 */
			if (imgInfo.type === 'coze') {
				const res = await uniCloud.request({ url, method: 'GET', responseType: 'arraybuffer' });
				if (!res.data) return { errMsg: '生成图片失败，请重新生成！' }

				const cloudPath = `/img/cloud-fun-img/${imgInfo.type}-${Date.now()}.png`
				const { fileID } = await uniCloud.uploadFile({ cloudPath, fileContent: res.data, cloudPathAsRealPath: true });
				url = fileID
			}

			if (!url) return { errMsg: '生成图片失败，请重新生成！' }

			/* 同步扣减采贝，获取用户实时数据 */
			const { data } = await DeductUserCbCount(userId, imgInfo.cb)

			const userData = { cb_num: data.cb_num, cb_pay_num: data.cb_pay_num }

			return { data: { url, userData }, errMsg: url ? '获取成功' : '生成图片涉及违规内容，请重新生成！' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
}
