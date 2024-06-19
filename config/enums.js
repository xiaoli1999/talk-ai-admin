/**
 * @file enums.ts 枚举配置
 * @description 相关枚举值
 * @author xiao li
 * @copyright 采黎AI
 * @createDate 2024-05-11 12:05
 */


const enumsToList = (obj) => Object.entries(obj).map(([id, value]) => ({ id: Number(id), value }))

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
	wxad: '微信搜索广告',
	'wxad-show': '微信展示广告',
	'wxad-pyq': '微信朋友圈广告',
	'wxad-video': '微信视频号广告'
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
