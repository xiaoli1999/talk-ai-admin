const db = uniCloud.database();

/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)
const worksJqlDb = dbJQL.collection('works')
const scenesJqlDb = dbJQL.collection('scenes')

const guideList = [
	'采黎AI为你答疑解惑',
	'快开始提问吧~'
]

const tipList = [
	'今天天气',
	'写一个周报',
	'推荐一道清淡的菜',
	'获奖感言',
	'天秤座今日运势',
	'制定一套健身规划',
	'鸡兔同笼',
	'这个季节适合去哪里旅游',
	'唇釉小红书种草文案',
	'春节祝福语',
	'写一个龙年春节对联',
	'讲一个童话故事',
	'描述冰天雪地的景色',
	'春节的由来',
	'为什么说冬吃萝卜夏吃姜'
]

const bannerList = [
	{
		imgUrl: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/img/swiper/swiper1.png',
		pageUrl: '/pages/talk/talk?id=65b8a5677c3538ed40b5641f&type=scenes'
	},
	{
		imgUrl: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/img/swiper/swiper2.png',
		pageUrl: '/pages/talk/talk?id=65b8a5677c3538ed40b56421&type=scenes'
	}
]

module.exports = {
	_before: function () { // 通用预处理器
		this.tipList = tipList.sort(() => Math.random() - 0.5).slice(0, 10);
	},
	/**
	 * @function getBasicData 获取基础信息
	 * @returns { object } { errMsg: '', data: {} } 错误信息及url
	 * @return { Array } data.guideList AI引导语列表
	 * @return { Array } data.tipList 提示列表
	 * @return { Array } data.workList 创作列表
	 * @return { Array } data.sceneList 情景列表
	 */
	async getBasicData () {
		try {
			const workData = await worksJqlDb.get()
			const sceneData = await scenesJqlDb.get()

			const data = {
				guideList,
				tipList: this.tipList,
				workList: workData.data || [],
				sceneList: sceneData.data || [],
				bannerList
			}

			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	}
}
