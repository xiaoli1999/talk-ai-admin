const { AppID, AppSecret, talkCount, vipCount, inviteCount } = require('./config.js')
const { createToken, verifyToken } = require('./utils/token.js')
const dayjs = require('./utils/dayjs.js')

const db = uniCloud.database();
/* 传统数据库集合 */
const usersDb = db.collection('users')

/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)
const usersJqlDb = dbJQL.collection('users')
const usersCopyJqlDb = dbJQL.collection('users_copy')

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

			const nowTime = Math.floor(Date.now() / 1000)
			const leaveTime = 60 * 60 * 1

			/* 查询用户 */
			const { data: userList } = await usersJqlDb.where({ openid }).get()

			if (!userList || !userList.length) return { errMsg: '找不到该用户' }

			const last_login_date = Date.now()

			if ((exp - nowTime) > leaveTime) {
				const newToken = createToken({ openid })
				await usersJqlDb.where({ openid }).update({ last_login_date })
				console.log(`\n----------用户【${userList[0].nickname}】登录未过期----------\n`, userList[0]);
				return { data: userList[0], errMsg: '登录未过期' }
			} else {
				const newToken = createToken({ openid })
				await usersJqlDb.where({ openid }).update({ token: newToken, last_login_date })

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

			/* 组装用户最新数据 */
			const token = createToken({ openid })
			const userData = {
				openid,
				session_key,
				unionid,
				token,
				last_login_date: Date.now(),
				username: `cl${ dayjs().add(8, 'hour').format('YYYYMMDDHHmmssSSS') }`
			}


			/* 查库判断用户是否存在该用户，有则更新，无则添加新用户 */
			const { data: userList } = await usersJqlDb.where({ openid }).get()

			if (userList.length) {
				await usersJqlDb.doc(userList[0]._id).update(userData)
			} else {
				/* 注册时若携带inviteUid，则代表为受邀用户 */
				if (event.inviteUid) {
					userData.inviter_uid = event.inviteUid
					userData.invite_time = Date.now()

					/* 邀请者发放奖励（异步会不执行） */
					await usersDb.doc(event.inviteUid).update({ talk_count: db.command.inc(inviteCount) })
				}

				/* 注册时若携带platform，则记录下平台并发放奖励 */
				if (event.platform) {
					userData.register_platform = event.platform
				}

				await usersJqlDb.add({ ...userData, talk_count: talkCount })
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
			if (reward) params.talk_count = db.command.inc(10)

			const data = await usersDb.where({ openid }).updateAndReturn(params)

			return { data: data.doc, errMsg: '更新成功' }
		} catch ({ message }) {
			console.log('\n----------更新用户信息异常----------\n', message);
			return { errMsg: message }
		}
	},

	/**
	 * @function dawnUpdateUserTalkCount 每天凌晨更新用户对话次数
	 */
	async dawnUpdateUserTalkCount () {
		try {
			console.time('updateUser')
			console.log('\n----------更新用户对话次数触发时间----------', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));

			/* 获取调用时间 */
			const current_time = Date.now()

			const field = {
				_id: true,
				talk_count: true,
				vip_count: true,
				vip_end_time: true
			}
			const { data } = await usersJqlDb.field(field).get()

			if (!data || !data.length) return { errMsg: '更新失败', data }

			for(const user of data) {
				/* 默认次数 */
				let count = 0

				/* 处理vip用户 */
				if ((user.vip_end_time || 0) > current_time) {
					count = vipCount
				} else {
					/* 处理普通用户，若当前次数大于默认次数，则不更新 */
					count = user.talk_count > talkCount ? user.talk_count : talkCount
				}

				/* 更新信息 */
				await usersJqlDb.doc(user._id).update({ talk_count: count })
			}

			console.log('\n----------更新用户对话次数结束时间----------', dayjs().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss'));
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
	async saveUserCopy ({ token, params, reward }) {
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

}

module.exports = main
