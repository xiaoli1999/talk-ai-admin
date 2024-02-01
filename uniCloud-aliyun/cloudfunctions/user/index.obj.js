const { AppID, AppSecret, talkCount, vipCount, inviteCount } = require('./config.js')
const { createToken, verifyToken } = require('./utils/token.js')
const { userField } = require('./utils/field.js')
const dayjs = require('./utils/dayjs.js')

const db = uniCloud.database();
/* 传统数据库集合 */
const usersDb = db.collection('users')

/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)
const usersJqlDb = dbJQL.collection('users')

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
			const { data: userList } = await usersJqlDb.where({ openid }).field(userField).get()

			if (!userList || !userList.length) return { errMsg: '找不到该用户' }

			if ((exp - nowTime) > leaveTime) {
				console.log(`\n----------用户【${userList[0].nickname}】登录未过期----------\n`, userList[0]);
				return { data: userList[0], errMsg: '登录未过期' }
			} else {
				const newToken = createToken({ openid })
				await usersJqlDb.where({ openid }).update({ token: newToken })

				const { data: newUserList } = await usersJqlDb.where({ openid }).field(userField).get()

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
				await usersJqlDb.add({ ...userData, talk_count: talkCount })
			}

			const { data: newUserList } = await usersJqlDb.where({ openid }).field(userField).get()

			return { data: newUserList[0], errMsg: '登录成功' }
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
	async updateUser ({ token, params }) {
		try {
			if (!token) return { errMsg: '无效token' }

			const { openid } = verifyToken(token)
			if (!openid) return { errMsg: '无效用户' }

			await usersJqlDb.where({ openid }).update(params)
			const { data } = await usersJqlDb.where({ openid }).field(userField).get()

			return { data: data[0], errMsg: '更新成功' }
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
				/* 处理普通用户 */
				const updateInfo = { talk_count: talkCount }
				
				/* 处理vip */
				if (user.vip_end_time > current_time) updateInfo.vip_count = vipCount
				
				/* 更新信息 */
				await usersJqlDb.doc(user._id).update(updateInfo)
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

}

module.exports = main