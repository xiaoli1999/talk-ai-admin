/* chat-migrate 配置：
 * AppSecret — 本地验签自签 JWT 用（须与 user/config.js 的 AppSecret 一致）
 * statsKey  — stats 看板口令（控制台运行 stats 方法时传 {"key": statsKey}；防公开刮取） */
module.exports = {
	AppSecret: '28fde98414a459bebbada964d2789584',
	statsKey: 'cl-migrate-stats-2026'
}
