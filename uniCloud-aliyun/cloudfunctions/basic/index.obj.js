const homeData = require('./data/home.js')
const chatData = require('./data/chat.js')
const roleData = require('./data/role.js')

const db = uniCloud.database();

/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)
const worksJqlDb = dbJQL.collection('works')
const rolesJqlDb = dbJQL.collection('roles')

module.exports = {
	/**
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
				chatData,
				roleData,
				workList: workData.data || [],
				roleList: rolesData.data || []
			}

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	}
}
