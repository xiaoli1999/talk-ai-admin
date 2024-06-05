const homeData = require('./data/home.js')
const { chatData, getTipList } = require('./data/chat.js')
const roleData = require('./data/role.js')

const db = uniCloud.database();

/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)
const worksJqlDb = dbJQL.collection('works')
const rolesJqlDb = dbJQL.collection('roles')

module.exports = {
	/**
	 * todo 暂时保留，防止旧版报错
	 * @function getBasicData 获取基础信息
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @return { object } data.homeData 首页基础数据
	 * @return { object } data.chatData 问答页基础数据
	 * @return { object } data.roleData 角色页基础数据
	 * @return { Array } data.workList 助手页数据
	 * @return { Array } data.roleList 角色页数据
	 */
	async getBasicData () {
		try {
			const workData = await worksJqlDb.get()
			const rolesData = await rolesJqlDb.get()

			const data = {
				homeData,
				chatData: { ...chatData, tipList: getTipList() },
				roleData,
				workList: workData.data || [],
				roleList: rolesData.data || []
			}

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getHomeBasicData 获取首页基础数据
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @returns { object } data 首页基础数据
	 */
	async getHomeBasicData () {
		try {
			return { data: homeData, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getWorkBasicData 获取助手页基础数据
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @returns { object } data 助手页基础数据
	 */
	async getWorkBasicData () {
		try {
			const workData = await worksJqlDb.limit(1000).get()

			const data = {
				list: workData.data || []
			}

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getChatBasicData 获取聊天页基础数据
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @returns { object } data 聊天页基础数据
	 */
	async getChatBasicData () {
		try {
			const data = { ...chatData, tipList: getTipList() }

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getRoleBasicData 获取角色页基础数据
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @returns { object } data 角色页基础数据
	 */
	async getRoleBasicData () {
		try {
			const rolesData = await rolesJqlDb.limit(1000).get()

			const data = {
				...roleData,
				list: rolesData.data || []
			}

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	}
}
