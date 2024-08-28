const { AppID, AppSecret, inviteCb, videoAdCb, rewardCb, rewardPayCb } = require('./config.js')
const { createToken, verifyToken } = require('./utils/token.js')
const dayjs = require('./utils/dayjs.js')
const { disableUserList } = require('./utils/disable.js')

const db = uniCloud.database();
/* 传统数据库集合 */
const usersDb = db.collection('users')

/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)
const usersJqlDb = dbJQL.collection('users')
const usersCopyJqlDb = dbJQL.collection('users_copy')
const usersPromptJqlDb = dbJQL.collection('users_prompt')
const RolesJqlDb = dbJQL.collection('roles')

const main = {
	_before: function () { // 通用预处理器

	},
	_timing: async function() {
		await main.dawnUpdateUserTalkCount()
		await main.dawnClearExpireOrder()
	},

	/**
	 * @function verifyUser 校验用户token
	 * @param { String } token 微信登录返回的code
	 * @returns { Object } data 当前用户信息
	 */
	async verifyLogin(token) {
		try {
			const { openid, exp } = verifyToken(token)

			if (!openid) return { errMsg: '登录过期' }

			/* 校验是否为黑名单用户 */
			if (disableUserList.includes(openid)) return { disable: true, errMsg: '该账号已被禁用' }

			const nowTime = Math.floor(Date.now() / 1000)
			const leaveTime = 60 * 60 * 1

			/* 查询用户 */
			const { data: userList } = await usersJqlDb.where({ openid }).get()

			if (!userList || !userList.length) return { errMsg: '找不到该用户' }

			const last_login_date = Date.now()
			const login_count = userList[0].login_count + 1

			if ((exp - nowTime) > leaveTime) {
				const newToken = createToken({ openid })
				await usersJqlDb.where({ openid }).update({ last_login_date, login_count })
				console.log(`\n----------用户【${userList[0].nickname}】登录未过期----------\n`, userList[0]);
				return { data: userList[0], errMsg: '登录未过期' }
			} else {
				const newToken = createToken({ openid })
				await usersJqlDb.where({ openid }).update({ token: newToken, last_login_date, login_count })

				const { data: newUserList } = await usersJqlDb.where({ openid }).get()

				console.log(`\n----------用户【${newUserList[0].nickname}】重新登陆----------\n`, newUserList[0]);

				return { data: newUserList[0], errMsg: '刷新token' }
			}
		} catch ({ message }) {
			console.log('\n----------校验用户token异常----------\n', message);
			return { errMsg: message }
		}
	},

	/**
	 * @function login 登录
	 * @param { Object } event 携带参数
     * @param { String } event.code 微信登录返回的code
     * @param { String } event.inviteUid 邀请码
	 * @returns {object} { errMsg: '', data: '' } 错误信息及用户信息data
	 */
	async login (event) {
		try {
			/* 获取用于唯一openid */
			const params = {
				url: 'https://api.weixin.qq.com/sns/jscode2session',
				method: 'GET',
				data: {
					appid: AppID,
					secret: AppSecret,
					js_code: event.code,
					grant_type: 'authorization_code'
				}
			}

			const { data: { session_key, openid, unionid, errcode } } = await uniCloud.request(params)
			if (!session_key || !openid) {
				const errObj = {
					40029: 'code无效',
					45011: 'API调用频繁',
					40226: '登录被拦截',
					'-1': '系统繁忙',

				}
				return { errMsg: errObj[errcode] }
			}

			/* 校验是否为黑名单用户 */
			if (disableUserList.includes(openid)) return { disable: true, errMsg: '该账号已被禁用' }

			/* 组装用户最新数据 */
			const token = createToken({ openid })

			const userData = {
				openid,
				session_key,
				unionid,
				token,
				last_login_date: Date.now(),
				login_count: 1
			}

			let isPlatformRegisterVip = false

			/* 查库判断用户是否存在该用户，有则更新，无则添加新用户 */
			const { data: userList } = await usersJqlDb.where({ openid }).get()

			if (userList.length) {
				userData.login_count = userList[0].login_count + 1
				await usersJqlDb.doc(userList[0]._id).update(userData)
			} else {
				/* 添加用户唯一名称 */
				userData.username = `cl${ dayjs().add(8, 'hour').format('YYYYMMDDHHmmssSSS') }`

				/* 注册时若携带inviteUid，则代表为受邀用户 */
				if (event.inviteUid) {
					userData.inviter_uid = event.inviteUid
					userData.invite_time = Date.now()

					/* 邀请者发放奖励（异步会不执行） */
					await usersDb.doc(event.inviteUid).update({ cb_num: db.command.inc(inviteCb), receive_cb_total: db.command.inc(inviteCb) })
				}

				/* 注册时若携带platform，则记录下平台并发放奖励 */
				if (event.platform) userData.register_platform = event.platform

				/* 注册时初始次数为0，在用户首次授权时设置次数 */
				userData.cb_num = 0

				await usersJqlDb.add(userData)
			}

			const { data: newUserList } = await usersJqlDb.where({ openid }).get()

			return { data: newUserList[0], errMsg: userList.length ? '登录成功' : '注册成功' }
		} catch ({ message }) {
			console.log('\n----------用户注册登录异常----------\n', message);
			return { errMsg: message }
		}
	},

	/**
	 * @function updateUser 更新用户信息
	 * @param { Object } event 携带参数
	 * @param { String } event.token 用户token
	 * @param { Object } event.params 用户要更新的信息
	 * @returns {object} { errMsg: '', data: '' } 错误信息及用户更新后的信息
	 */
	async updateUser ({ token, params, reward }) {
		try {
			if (!token) return { errMsg: '无效token' }

			const { openid } = verifyToken(token)
			if (!openid) return { errMsg: '无效用户' }

			/* 授权更新信息奖励10次对话次数 */
			if (reward) {
				params.cb_num = db.command.inc(rewardCb)
				params.receive_cb_total = db.command.inc(rewardCb)
			}

			const data = await usersDb.where({ openid }).updateAndReturn(params)

			return { data: data.doc, errMsg: '更新成功' }
		} catch ({ message }) {
			console.log('\n----------更新用户信息异常----------\n', message);
			return { errMsg: message }
		}
	},

	/**
	 * @function getUserInfo 更新用户信息
	 * @param { Object } event 携带参数
	 * @param { String } event.token 用户token
	 * @returns {object} { errMsg: '', data: '' } 错误信息及用户更新后的信息
	 */
	async getUserInfo ({ token }) {
		try {
			if (!token) return { errMsg: '无效token' }

			const { openid } = verifyToken(token)
			if (!openid) return { errMsg: '无效用户' }

			const { data } = await usersDb.where({ openid }).get()

			return { data: data[0], errMsg: '获取成功' }
		} catch ({ message }) {
			console.log('\n----------获取用户信息异常----------\n', message);
			return { errMsg: message }
		}
	},

	/**
	 * @function dawnUpdateUserTalkCount 每天凌晨更新用户对话次数
	 */
	async dawnUpdateUserTalkCount () {
		try {
			console.time('updateUser')
			console.log('\n----------更新用户采贝触发时间----------', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));

			/* 获取调用时间 */
			const current_time = Date.now()

			console.log('\n ----清除非会员用户免费采贝及当天看视频广告次数----', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));
			usersJqlDb.where(`cb_num > 0 && vip_end_time < ${ current_time }`).update({ cb_num: 0 })
			usersJqlDb.where('today_video_ad_count > 0').update({ today_video_ad_count: 0 })

			console.log('\n ----清除角色当天热度及聊天数', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));
			RolesJqlDb.where('today_hot_count > 0').update({ today_hot_count: 0, today_talk_count: 0 })

			/* 暂停非会员次数更新，引导用户获取次数 */
			// console.log('\n ----更新非会员（次数小于默认次数且更新过信息）用户次数----', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));
			// usersJqlDb.where(`vip_end_time < ${current_time } && talk_count < ${ talkCount }  && gender != 0`).update({ talk_count: talkCount })


			console.log('\n----------更新用户采贝' +
				'结束时间----------', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));
			console.log('\n----------本地更新耗时----------\n');
			console.timeEnd('updateUser')

			return { errMsg: '更新成功' }
		} catch ({ message }) {
			console.log('\n----------更新用户异常----------\n', message);
			return { errMsg: message }
		}
	},

	/**
	 * @function dawnClearExpireOrder 每天凌晨清除失败订单
	 */
	async dawnClearExpireOrder () {
		try {
			console.time('clearOrder')
			console.log('\n----------清除无效订单触发时间----------', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));

			/* 获取调用时间 */
			const current_time = dayjs().subtract(1, 'day').valueOf()

			await db.collection('orders').where({
				create_time: db.command.lt(current_time),
				status: 0
			}).remove()

			console.log('\n----------清除无效订单结束时间----------', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));
			console.log('\n----------本地更新耗时----------\n');
			console.timeEnd('clearOrder')

			return { errMsg: '清除无效订单成功' }
		} catch ({ message }) {
			console.log('\n----------清除无效订单异常----------\n', message);
			return { errMsg: message }
		}
	},
	/**
	 * @function saveUserCopy 记录用户复制内容
	 * @param { Object } event 携带参数
	 * @param { String } event.token 用户token
	 * @param { Object } event.params 用户要复制的信息
	 * @returns {object} { errMsg: '', data: '' } 错误信息及用户更新后的信息
	 */
	async saveUserCopy ({ token, params }) {
		try {
			if (!token) return { errMsg: '无效token' }

			const { openid } = verifyToken(token)
			if (!openid) return { errMsg: '无效用户' }

			const data = await usersCopyJqlDb.add(params)

			return { data: data.doc, errMsg: '保存成功' }
		} catch ({ message }) {
			console.log('\n----------记录用户复制内容异常----------\n', message);
			return { errMsg: message }
		}
	},
	/**
	 * @function saveUserPrompt 记录用户微调prompt内容
	 * @param { Object } event 携带参数
	 * @param { String } event.token 用户token
	 * @param { Object } event.params 用户修改prompt信息
	 * @returns {object} { errMsg: '', data: '' } 错误信息及用户更新后的信息
	 */
	async saveUserPrompt ({ token, params }) {
		try {
			if (!token) return { errMsg: '无效token' }

			const { openid } = verifyToken(token)
			if (!openid) return { errMsg: '无效用户' }

			const data = await usersPromptJqlDb.add(params)

			return { data: data.doc, errMsg: '保存成功' }
		} catch ({ message }) {
			console.log('\n----------记录用户微调prompt内容异常----------\n', message);
			return { errMsg: message }
		}
	},
	/**
	 * @function giveUserVideoAdReward 为用户发放看广告的奖励
	 * @param { Object } event 携带参数
	 * @param { String } event.token 用户token
	 * @param { Object } event.date 上次看广告的时间
	 * @returns {object} { errMsg: '', data: '' } 错误信息及用户更新后的信息
	 */
	async giveUserVideoAdReward ({ token, date }) {
		try {
			if (!token) return { errMsg: '无效token' }

			const now = Date.now()
			if (date && (now - date < 20 * 1000)) return { errMsg: '请勿频繁看广告' }

			const { openid } = verifyToken(token)
			if (!openid) return { errMsg: '无效用户' }

			const params = {
				cb_num: db.command.inc(videoAdCb),
				receive_cb_total: db.command.inc(videoAdCb),
				today_video_ad_count: db.command.inc(1),
				video_ad_count: db.command.inc(1),
				video_ad_last_date: now
			}

			const { doc } = await usersDb.where({ openid }).updateAndReturn(params)

			return { data: doc, errMsg: '奖励采贝已发放' }
		} catch ({ message }) {
			console.log('\n----------记录用户看广告得次数异常----------\n', message);
			return { errMsg: message }
		}
	},
	/**
	 * @function signReward 登录签到奖励
	 * @param { Object } event 携带参数
	 * @param { String } event.id 用户id
	 * @returns {object} { errMsg: '', data: '' } 错误信息及用户更新后的信息
	 */
	async signReward ({ id, date, isVip }) {
		try {
			if (!id) return { errMsg: '无效用户' }

			const { data } = await usersDb.doc(id).get()
			const { receive_cb_date, receive_vip_cb_date, receive_cb_total, receive_cb_count, cb_num } = data[0]

			if (!isVip && date === receive_cb_date) return { errMsg: '已经领取过了' }
			if (isVip && date === receive_vip_cb_date) return { errMsg: '已经领取过了' }

			let params = {}

			if (isVip) {
				params.receive_vip_cb_date = date
				params.receive_cb_total = (receive_cb_total || 0) + rewardPayCb
				params.cb_num = (cb_num || 0) + rewardPayCb
			} else {
				params.receive_cb_date = date
				params.receive_cb_total = (receive_cb_total || 0) + rewardCb
				params.cb_num = (cb_num || 0) + rewardCb

				params.receive_cb_count = (receive_cb_count || 0) + 1
			}

			const { doc } = await usersDb.doc(id).updateAndReturn(params)


			return { data: doc, errMsg: '领取成功' }
		} catch ({ message }) {
			console.log('\n----------记录用户签到赠送奖励异常----------\n', message);
			return { errMsg: message }
		}
	},
}

module.exports = main
