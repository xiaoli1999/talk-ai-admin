/**
 * pay-manual 登录配置(私密仓库,密钥明文入库——07-22 黎拍板,与 talk 云函数同待遇)
 * ACCOUNTS:后台账号 → 密码(黎 09-01 定 xiaoli/284943);账号名同时是订单 operator 留痕与后台 globalData.name(tongyao 隐藏两个 tab 的老逻辑仍按名字生效)
 * TOKEN_SECRET:签 token 的 HMAC 密钥,换掉即全员下线
 * TOKEN_TTL_MS:token 有效期 7 天
 */
module.exports = {
	ACCOUNTS: {
		xiaoli: '284943'
	},
	TOKEN_SECRET: '8734c234a27df9d946a4cf97fb881dacaed48d952cb8e30b',
	TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000
}
