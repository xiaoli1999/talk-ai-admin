/**
 * drama-admin 鉴权配置——**照抄 pay-manual/config.js 的 ACCOUNTS/TOKEN_SECRET**(09-08 黎令:不跨云函数 require,各自目录内拷贝)。
 * 后台登录仍走 pay-manual.login 签 token,本对象只验不签;所以两边密钥必须一致——
 * ⚠️ 换 TOKEN_SECRET 或加减账号时,pay-manual/config.js 与本文件要一起改、一起传。
 * 密钥明文入库=私密仓库策略(07-22 黎拍板,与 talk 云函数同待遇)。
 */
module.exports = {
	ACCOUNTS: {
		"xiaoli": "284943"
	},
	TOKEN_SECRET: "8734c234a27df9d946a4cf97fb881dacaed48d952cb8e30b",
	TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000
}
