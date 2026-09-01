/**
 * 后台登录态(09-01 黎令:假登录换掉 URL 参数 name)
 * 会话只存 pay-manual.login 签发的 token + 账号 + 过期时间;过期即视为未登录。
 * 单一写入路径:只有本文件写 admin_session。
 */
const KEY = 'admin_session'

export const getSession = () => {
	try {
		const s = uni.getStorageSync(KEY)
		return s && s.token && s.expireAt > Date.now() ? s : null
	} catch (e) {
		return null
	}
}

export const setSession = (s) => uni.setStorageSync(KEY, s)

export const clearSession = () => uni.removeStorageSync(KEY)

export const goLogin = () => uni.reLaunch({ url: '/pages/login/login' })

/** 登录后按账号应用老逻辑:globalData.name 供各页读;tongyao 隐藏两个 tab(沿用 App.vue 旧行为) */
export const applyRole = (name) => {
	const app = getApp()
	if (app && app.globalData) app.globalData.name = name
	if (name === 'tongyao') {
		[1, 2].forEach(i => uni.setTabBarItem({ index: i, visible: false }))
	}
}

export const authApi = () => uniCloud.importObject('pay-manual', { customUI: true })
