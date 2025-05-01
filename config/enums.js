/**
 * @file enums.ts 枚举配置
 * @description 相关枚举值
 * @author xiao li
 * @copyright 采黎AI
 * @createDate 2024-05-11 12:05
 */


const enumsToList = (obj) => Object.entries(obj).map(([id, value]) => ({ id: id, value }))

export const platformEnums = {
	juejin: '掘金',
	csdn: 'CSDN',
	v2ex: 'V2EX',
	w2solo: 'W2Solo',
	xiaozhong: '小众软件',
	xioahongshu: '小红书',
	gongzhonghao: '公众号',
	pengyouqaun: '朋友圈',
	poster: '主海报',
	wxad: '广告-搜索',
	'wxad-pyq': '广告-朋友圈',
	'wxad-video': '广告-视频号',
	'wxad-cover': '广告-小程序封面',
	'wxad-popup': '广告-小程序插屏',
}

export const genderEnums = {
	0: '未知',
	1: '男',
	2: '女'
}
export const genderEnumsList = enumsToList(genderEnums)

export const genderImgEnums = {
	1: '/static/icon/men.png',
	2: '/static/icon/women.png'
}

export const sortEnums = {
	0: '按推荐排序',
	1: '按最热排序',
	2: '按最新排序'
}
export const sortEnumsList = enumsToList(sortEnums)

export const htmlEnums = {
	/* 新枚举，直接使用汉字做key */
	'版本更新': '版本更新',
	'新人必读': '新人必读',

	'补偿奖励': '补偿奖励',
	'投稿下线通知': '投稿下线通知',
	'紧急通知': '紧急通知',

	'新春畅聊卡': '新春畅聊卡',

	'亲密玩法': '亲密玩法',
	'模型升级': '模型升级',
	'春节福利': '春节福利',

	'newVersion': '新版本（旧）',
}
export const htmlEnumsList = enumsToList(htmlEnums)

export const payEnums = {
	'': '全部',
	'cb': '采贝',
	'vip': '会员',
	'first-cb': '首充',
	'card': '畅聊卡',
	'gift-bag': '礼包',
}
export const payEnumsList = enumsToList(payEnums)
