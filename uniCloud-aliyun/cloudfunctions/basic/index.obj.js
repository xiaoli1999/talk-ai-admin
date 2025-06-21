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

			// const newWhereData = {
			// 	_id: db.command.in(['67dd04322eea6559d2e0af65', '68386202fe975fd64c1ceced', '67f105f255b3373c729673e1'])
			// }
			// const { data: newManList } = await rolesDb.where(newWhereData).orderBy('hot_count', 'desc').get()
			// data.newList = newManList || []
			// data.newList = []

			const newWhereData = {
				show: true,
				$or: [
					{ high_quality: true },
					{ talk_count: db.command.gte(1000) } // gte 表示 greater than or equal（大于等于）
				]
			}

			/* 获取最新角色（最新暂时不区分性别） */
			const { data: newManList } = await rolesDb.where({ ...newWhereData, gender: 1 }).limit(18).orderBy('create_time', 'desc').get()
			const { data: newWomanList } = await rolesDb.where({ ...newWhereData, gender: 2 }).limit(18).orderBy('create_time', 'desc').get()

			let newList = []
			for (let i = 0; i < Math.max(newManList.length, newWomanList.length); i++) {
				if (gender === 1) {
					if (newWomanList[i]) newList.push(newWomanList[i]);
					if (newManList[i]) newList.push(newManList[i]);
				} else {
					if (newManList[i]) newList.push(newManList[i]);
					if (newWomanList[i]) newList.push(newWomanList[i]);
				}
			}

			data.newList = newList || [...newManList, ...newWomanList]


			const whereData = {
				show: true
			}

			if (gender) whereData.gender = gender === 1 ? 2 : 1

			// /* 获取最喜欢的角色 */
			// const roles = rolesJqlDb.getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系
			// const rolesLike = rolesLikeJqlDb.orderBy('create_time desc').limit(10).getTemp() // 临时表field方法内需要包含关联字段，否则无法建立关联关系

			/* 随机取最喜欢的角色 */
			const skip =  Math.floor(Math.random() * 100)

			const { data: likeList } = await rolesJqlDb.where(whereData).orderBy('like_count desc').skip(skip).limit(5).get()
			data.likeList = likeList || []

			/* 获取最近在聊的角色 */
			const { data: talkList } = await rolesDb.where(whereData).limit(2).orderBy('last_talk_time', 'desc').get()
			data.talkList = talkList || []

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
			// let data = []
			//
			// const whereData = {
			// 	_id: db.command.in(['68445eec4b92476e97e41cb5'])
			// }
			// const { data: list } = await rolesDb.where(whereData).get()
			// data = list || []

			const whereData = { show: true }

			if (gender) whereData.gender = gender === 1 ? 2 : 1

			/* 获取当天热度最高的男、女 */
			const { data: menList } = await rolesDb.where({ show: true, gender: 1 }).limit(20).orderBy('today_hot_count', 'desc').orderBy('last_talk_time', 'desc').get()
			const { data: womenList } = await rolesDb.where({ show: true, gender: 2 }).limit(20).orderBy('today_hot_count', 'desc').orderBy('last_talk_time', 'desc').get()

			const data = []

			menList.forEach((item, i) => {
				if (gender === 1) {
					data.push(womenList[i])
					data.push(menList[i])
				} else {
					data.push(menList[i])
					data.push(womenList[i])
				}
			})

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
	/**
	 * @function getVersion 获取当前版本
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @returns { object } data 聊天页基础数据
	 */
	async getVersion () {
		try {
			return { data: '3.6.2', errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},
}
