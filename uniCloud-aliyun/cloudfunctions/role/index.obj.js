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
	async createRole ({ category_id, user_id, prompt, username, nickname }) {
		try {

			if (!category_id) return { data: null, errMsg: '请选择采崽分类' }
			if (!user_id) return { data: null, errMsg: '请重新登录' }
			if (!prompt) return { data: null, errMsg: '请填写采崽设定' }

			const roleObj = {
				category_id,
				sort: 0,
				show: true,
				name: '',
				user_name: '我',
				avatar: '',
				avatar_long: '',
				gender: 0,
				desc: '',
				tag_list: [],
				styles: 1,
				prompt,
				hide_prompt: '',
				guide_list: [],
				hot_count: 0,
				talk_count: 0,
				/* 2.5新增 */
				today_hot_count: 0,
				today_talk_count: 0,
				like_count: 0,
				voice_id: '',
				voice_url: '',
				last_talk_time: '',
				create_time: Date.now(),
				update_time: '',
				creator_id: user_id,
				looks_prompt: '',
				username,
				nickname
			}

			const { errMsg } = await rolesMyDb.add(roleObj).catch(e => e)
			if (errMsg) return { data: null, errMsg }

			return { data: true, errMsg: '创建成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	}
}
