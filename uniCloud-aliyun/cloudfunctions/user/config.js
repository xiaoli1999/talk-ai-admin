/* 正常版本 */
const cbNum = 20 // 普通用户-登录采贝奖励 20
const rewardPayCb = 60 // 会员用户-登录采贝奖励 60

const rewardCb = 5 // 更新信息奖励5
const inviteCb = 10 // 邀请奖励5

const videoAdCb = 2 // 广告视频奖励2
const lookVideoCount = 50 // 每天观看广告次数50次

const todayNeedTalkCount = 60 // 每天需要聊天60次才能领取采贝奖励
const rewardTodayTalkCb = 20 // 领取每天聊天奖励的采贝20个

const addMpRewardCb = 20 // 「添加到我的小程序」一次性奖励采贝 20

const createSwiperList = [
	// {
	// 	url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/swiper/img-style.png',
	// 	pageUrl: '/pages/doc/doc?type=捏崽新画风'
	// },
	{
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/swiper/create-role.png',
		pageUrl: '/pages/doc/doc?type=创建采崽'
	},
	{
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/guide.png',
		pageUrl: '/pages/doc/doc?type=捏崽攻略'
	},
	// {
	// 	url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/ckeck.png',
	// 	pageUrl: '/pages/doc/doc?type=捏崽审核规范'
	// },
	// {
	//     url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/convention.png',
	//     pageUrl: '/pages/doc/doc?type=采黎AI社区公约&theme=dark'
	// },
]

// const giftBagSwiper = 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/user/swiper-61.png'
const giftBagSwiper = ''

/* 端午版本活动（弹窗 / 说明页 / 补偿领取 / 双倍登录 共用一套，全云端可配）。
   - 既下发 BasicData 供前端展示，又由 user 云对象服务端发放(signReward 双倍 / claimCompensation 补偿)直接读取，防前端篡改。
   - 下线整个活动：show=false。日期均为北京时间、含当天；popupImg 留空则弹窗不弹（防空窗）。 */
const duanwu = {
	show: false,                         // 活动总开关
	popupImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/swiper/banner-duanwu.png?x-oss-process=image/resize,w_600', // 弹窗主视觉(16:9)；⚠️占位=模型banner，待换端午补偿主视觉
	claimStart: '2026-06-19',           // 补偿领取期 + 双倍登录期 开始
	claimEnd: '2026-06-21',             // 结束（含当天 23:59:59）
	payStart: '2026-06-12',             // 付费补偿资格窗口 开始
	payEnd: '2026-06-18',               // 付费补偿资格窗口 结束（含当天）
	freeCb: 100,                        // 全员免费补偿（计入 cb_num 免费采贝）
	payCb: 100,                         // 近一周付费用户额外补偿（计入 cb_pay_num 付费采贝）
	loginMultiplier: 2,                 // 端午期间登录奖励倍率
}

/* 体验官调研问卷（v2）—— 前端展示/入口/弹窗用（福利中心入口卡 + 首页强弹窗都读它）。
   ⚠️ version / startDate / endDate / reward 需与 survey/config.js 的 meta 两处同步：
      本处只负责前端展示（倒计时/文案/弹窗），真正的"是否开放/已填/发奖"由 survey 云对象按 survey/config.js 判定。
   - 下线整套：show=false。popupImg 留空则首页弹窗不弹（防空窗，待设计稿替换）。 */
const survey = {
	version: 'v2',              // 当前激活版本（与 survey/config.js meta.version 同步）
	show: true,                // 总开关：关 = 福利中心入口 + 首页弹窗都不出
	startDate: '2026-06-24',   // 开始（北京，含当天）—— 与 survey/config.js 同步
	endDate: '2026-06-28',     // 结束（北京，含当天）—— 06-24~06-28 共 5 天窗口（与 survey/config.js 同步）
	reward: 50,                // 展示用奖励数（实际发放以 survey/config.js 为准）
	entrySection: '限时调研',     // 福利中心分区小标题（仿「新手有礼」，置于每日任务之上）
	entryTitle: '体验官限时问卷',
	entryDesc: '说说你的心声，填写可得 ',
	popupShow: true,           // 首页强弹窗开关（叠加 show；仿端午弹窗三道闸）
	popupImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/swiper/surve-v2.png?x-oss-process=image/resize,w_600',              // 弹窗主视觉，留空则不弹（防空窗，待设计稿）
	popupTitle: '听见你的心声 · 限时问卷',
	popupDesc: '填写即得 50 采贝，仅剩这几天',
}

const userBasicData = {
	cbNum, // 普通用户-登录采贝奖励
	rewardPayCb, // 会员用户-登录采贝奖励

	rewardCb, // 更新信息奖励5
	inviteCb, // 邀请奖励5

	videoAdCb, // 广告视频奖励2
	lookVideoCount, // 每天观看广告次数30次

	todayNeedTalkCount, // 每天需要聊天30次才能领取采贝奖励
	rewardTodayTalkCb, // 领取每天聊天奖励的采贝10个
	addMpRewardCb, // 「添加到我的小程序」一次性奖励采贝

	showHotSearch: true, // 展示热门搜索
	shareImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/share/share.png',

	/* 按次计费单价（云端可配，不写死在前端）：灵感回复 / 语音播放 采贝/次。
	   ⚠️ T1-T5 档位单价在 talk-text/utils/model.js 的 modelList[].price（1/2/3/4/5），客户端读 modelInfo.price，不在此处重复。
	   改这里 → 重传 user 云对象，前端下次取 BasicData 即生效（talk.vue 的 ideaPrice/soundPrice 计算属性读取）。*/
	talkPrice: {
		idea: 1,   // 灵感回复 采贝/次
		sound: 1,  // 语音播放 采贝/次
	},

	/* 端午活动：下发前端展示（详见上方 const duanwu；服务端 signReward/claimCompensation 也读它） */
	duanwu,

	/* 体验官调研问卷（v2）：下发前端展示，驱动福利中心入口卡 + 首页强弹窗（见上方 const survey） */
	survey,

	/* ── 聊天搬迁·云控开关（P0；缺省=安全态）──
	   共用形态 { enabled?:boolean, onlyUsers?:[uid], hideUsers?:[uid] }（判定逻辑见前端 chat-local.js resolveUserGate）：
	   · chatSplit   开屏收敛同步（搬迁=复制不删除）。不配=全员开（无感搬迁）。{enabled:false}=全员急停 / {hideUsers:[uid]}=定向停 /
	                 {strip:true}=第二步·删除 vuex 旧包释放 1MB（⚠️ 新正式版全量稳定后才开；开了=烧掉回滚退路）
	   · storagePage 「我的→存储管理」页+入口。缺省=全员隐藏；开发者本人常驻名单，随时看全量产品形态。
	   改这里 → 重传 user 云对象即生效（无需发版）。 */
	// chatSplit: { strip: true },
	storagePage: { onlyUsers: ['669468e0213929350aba6c74'] }, // 开发者（黎）本人常开

	createSwiperList,
	giftBagSwiper,

	/* 星球页右上角排行榜入口图标，置空即下线入口 */
	rankingLogo: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/role/ranking/ranking-logo.png?x-oss-process=image/resize,w_400',

	/* 邀新功能入口（可插拔）：返回 inviteEntry: true 才展示福利中心入口，false 或不返回(注释)即隐藏；inviteBanner 置空则首页不展示 banner 入口 */
	inviteEntry: true,   // ← 要上线福利中心入口时，取消本行注释
	inviteBanner: '',

	/* 「添加到我的小程序」任务入口（可插拔）：返回 addMpEntry: true 才展示，false 或不返回(注释)即隐藏 */
	addMpEntry: true,

	/* 模型升级公告弹窗（可插拔）：show 为 true 且配了图才弹，先于登录奖励、每天弹（用户可勾"今日不再提示"）。
	   下线 = false 或注释；图任意比例（3:2/16:9/4:3），弹窗内按 4:3 居中裁切 */
	upgradePopupShow: false, // ← 已被端午版本更新弹窗(duanwu)替换下线（见上方 duanwu 配置）
	upgradePopupImg: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/home/banner-model.png?x-oss-process=image/resize,w_600',     // ← 运营图 URL

	imgVersion: 'default-2026-02-16-00-00',
}


module.exports = {
	AppID: 'wx260bd9caa0c332d3',
	AppSecret: '28fde98414a459bebbada964d2789584',

	cbNum, // 普通用户-登录采贝奖励
	rewardPayCb, // 会员用户-登录采贝奖励

	rewardCb, // 更新信息奖励5
	inviteCb, // 邀请奖励5

	videoAdCb, // 广告视频奖励2
	lookVideoCount, // 每天观看广告次数30次

	todayNeedTalkCount, // 每天需要聊天30次才能领取采贝奖励
	rewardTodayTalkCb, // 领取每天聊天奖励的采贝10个
	addMpRewardCb, // 「添加到我的小程序」一次性奖励采贝
	duanwu, // 端午活动配置（服务端 signReward 双倍 / claimCompensation 补偿 读取）

	userBasicData
}
