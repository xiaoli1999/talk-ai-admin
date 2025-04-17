const UniSubscribemsg = require('uni-subscribemsg');

// 初始化实例
let uniSubscribemsg = new UniSubscribemsg({
	dcloudAppid: "__UNI__EA1DCA9",
	provider: "weixin-mp",
});

/* 数据库 */
const db = uniCloud.database();
const dbJQL = uniCloud.databaseForJQL(db)

const likesDb = db.collection('roles_like')
const likesJQLDb = dbJQL.collection('roles_like')

const rolesDb = db.collection('roles')

const rolesMyDb = db.collection('roles_my')


module.exports = {
	_before: function () { // 通用预处理器

	},

	/**
	 * @function getLikeRoleList 获取用户喜欢角色列表
	 * @param { Object } params { user_id } 用户user_id
	 * @returns {object} { errMsg: '', data: { url: '', appid } } 错误信息及url
	 */
	async getLikeRoleList ({ user_id }) {
		try {
			const { data } = await likesDb.where({ user_id }).limit(1000).orderBy('create_time', 'desc').get()

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function saveLikeRole 保存用户喜欢角色列表
	 * @param { Object } params { user_id, role_id, isLike } user_id用户id、role_id角色id，是否喜欢操作
	 * @returns {object} { errMsg: '', data: { url: '', appid } } 错误信息及url
	 */
	async saveLikeRole ({ category_id, role_id, role_name, user_id, user_name, user_avatar, isLike }) {
		try {


			if (isLike) {
				/* 使用jql语法，默认值会生效 */
				likesJQLDb.add({ category_id, role_id, role_name, user_id, user_name, user_avatar })
			} else {
				likesJQLDb.where({ role_id, user_id }).remove()
			}

			const { doc } = await rolesDb.doc(role_id).updateAndReturn({ like_count: db.command.inc(isLike ? 1 : -1), hot_count: db.command.inc(isLike ? 10 : 0) })

			return { data: doc, errMsg: '操作成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function createRole 创建角色
	 * @param { Object } params { category_id, user_id, prompt } user_id用户id、role_id角色id，是否喜欢操作
	 * @returns {object} { errMsg: '', data: true } 错误信息及创建结果
	 */
	async createRole (event) {
		try {
			let { _id, category_id, avatar, avatar_long, name, gender, tag_list, desc, prompt, guide_list, voice_id, create_time, state, user_id, username, nickname, vip, user_cb_pay_num, styles } = event

			if (!user_id) return { data: null, errMsg: '请重新登录' }

			/* 暂用styles代替提交审核次数 */
			styles = state === 0 ? (styles || 0) + 1 : styles || 0

			const roleObj = {
				category_id,
				sort: 0,
				show: true,
				name,
				user_name: '我',
				avatar,
				avatar_long,
				gender,
				desc,
				tag_list,
				styles,
				prompt,
				hide_prompt: '',
				guide_list,
				hot_count: 0,
				talk_count: 0,

				/* 2.5新增 */
				today_hot_count: 0,
				today_talk_count: 0,
				like_count: 0,
				voice_id,
				voice_url: '',
				last_talk_time: '',
				create_time: create_time || Date.now(),
				update_time: Date.now(),
				creator_id: user_id,
				looks_prompt: '',
				username,
				nickname,
				/* 3.5新增 */
				vip,
				version: avatar_long ? 3.8 : 3.52,
				/*3.52新增*/
				user_cb_pay_num,

				/* 3.8 todo 捏崽功能 */
				state,
				refuse_reason: ''
			}

			const { errMsg } = _id ? await rolesMyDb.doc(_id).update(roleObj).catch(e => e) : await rolesMyDb.add(roleObj).catch(e => e)
			if (errMsg) return { data: null, errMsg }

			return { data: true, errMsg: '创建成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function checkRoleAndNotice 审核角色并通知
	 * @param { Object } event { category_id } 创作者id
	 * @returns {object} { errMsg: '', data: true } 错误信息及创建结果
	 */
	async checkRoleAndNotice (event) {
		try {
			console.log(event)
			const { state, roleInfo, date } = event
			if (!roleInfo) return { errMsg: '缺少角色数据' }

			/* 获取用户信息 */
			const { data: userList } = await db.collection('users').doc(roleInfo.creator_id).get()
			const userInfo = userList[0]
			if (!userInfo) return { errMsg: '未找到该用户' }

			let thing1 = roleInfo.name
			let phrase2 = ''
			let phrase3 = ''
			let thing5 = ''
			let page = ''

			if (state === -1) {
				/* 打回草稿 */
				phrase2 = '驳回草稿箱'
				phrase3 = ''
				thing5 = '请阅读捏崽攻略，优化采崽信息。'
				page = 'pages/create/draft/draft'

			} else if (state === 1) {
				/* 审核失败 */
				phrase2 = '未通过'
				phrase3 = ''
				thing5 = '审核未通过，请根据驳回原因再次修改。'
				page = 'pages/role/my/my?state=1'

			} else if (state === 0) {
				/* 审核成功 */
				phrase2 = '已通过'
				phrase3 = roleInfo.high_quality ? '优质采崽' : '普通采崽'
				thing5 = roleInfo.high_quality ? '优质采崽！流量扶持！奖励20个采贝！' : '普通采崽，奖励5个采贝！期待你的优质采崽哦！'
				page = `pages/role/talk/talk?id=${ roleInfo._id }`

				/* 发放采贝奖励 */
				const params = { cb_num: userInfo.cb_num }

				params.cb_num = Math.ceil(params.cb_num + (roleInfo.high_quality ? 20 : 5))

				await db.collection('users').doc(roleInfo.creator_id).update(params)
			}

			await uniSubscribemsg.sendSubscribeMessage({
				touser: userInfo.openid,
				template_id: "ZW7rs8CAPeezX7GeIjQl8uS2aDr5oqAhjY7IyZy9ALw",
				page: page, // 小程序页面地址
				miniprogram_state: "developer", // 跳转小程序类型：developer为开发版；trial为体验版；formal为正式版；默认为正式版
				lang: "zh_CN",
				data: {
					thing1: { value: thing1 },
					phrase2: { value: phrase2 },
					phrase3: { value: phrase3 },
					time4: { value: date },
					thing5: { value: thing5 }

					// thing1: { value: "张三" },
					// phrase2: { value: "已通过" },
					// phrase3: { value: "未推荐" },
					// time4: { value: "2025-04-16 00:32:20" },
					// thing5: { value: "审核测试哦" },
				}
			});

			return { date: true }

		} catch ({ message }) {
			return { errMsg: message }
		}
	},
}
