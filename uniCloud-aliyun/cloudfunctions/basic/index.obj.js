const homeData = require('./data/home.js')
const { chatData, getTipList } = require('./data/chat.js')
const roleData = require('./data/role.js')

const db = uniCloud.database();
const rolesDb = db.collection('roles');

/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)
const rolesJqlDb = dbJQL.collection('roles')
const rolesLikeJqlDb = dbJQL.collection('roles_like')
const worksJqlDb = dbJQL.collection('works')

module.exports = {

	/**
	 * @function todo 旧版数据 getHomeBasicData 获取首页基础数据
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
	 * @function getHomeData 获取首页数据
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @returns { object } data 首页基础数据
	 */
	async getHomeData ({ gender }) {
		try {
			const data = { ...homeData }

			const whereData = { show: true }
			if (gender) whereData.gender = gender === 1 ? 2 : 1

			/* 获取最新角色 */
			const { data: newList } = await rolesDb.where(whereData).limit(5).orderBy('create_time', 'desc').get()
			data.newList = newList || []

			/* 获取最近在聊的角色 */
			const { data: talkList } = await rolesDb.where(whereData).limit(2).orderBy('last_talk_time', 'desc').get()
			data.talkList = talkList || []

			// /* 获取最喜欢的角色 */
			// const roles = rolesJqlDb.getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系
			// const rolesLike = rolesLikeJqlDb.orderBy('create_time desc').limit(10).getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系

			/* 随机取最喜欢的角色 */
			const skip =  Math.floor(Math.random() * 81)

			const { data: likeList } = await rolesJqlDb.where(whereData).orderBy('like_count desc').skip(skip).limit(3).get()
			data.likeList = (likeList || []).map(i => ({ ...i, _id: { _value: i._id }, list: [] }))
			console.log(data)


			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getHomeHotList 获取首页最热数据
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @returns { Array } data 首页最热数据
	 */
	async getHomeHotList ({ gender }) {
		try {

			const whereData = { show: true }
			if (gender) whereData.gender = gender === 1 ? 2 : 1

			/* 获取当天热度最高的角色 */
			const { data } = await rolesDb.where(whereData).limit(9).orderBy('today_hot_count', 'desc').get()

			return { data, errMsg: '获取成功' }
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
}
