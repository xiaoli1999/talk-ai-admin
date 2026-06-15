/**
 * @module invite/config 邀新奖励规则配置（单一真源）
 *
 * ⭐ 调整邀请奖励只改本文件即可：后端发奖直接读这里，前端展示通过
 *    invite.getInviteData 接口下发的 config 渲染，不在别处硬编码。
 */

/* JWT 签名密钥（与 user 云对象一致）。本地验 token 用，避免每次鉴权跨对象调 user 函数（按秒计费、有跨函数开销）。
 * 按项目"各云函数各存一份周期/密钥"约定就地放一份；与 user/config.js 的 AppSecret 必须保持同一个值。 */
const AppSecret = '28fde98414a459bebbada964d2789584'

/* 邀请成功判定：被邀请人需「完善资料(gender!=0)」且「与采崽聊天满 needChatCount 次」 */
const needChatCount = 3

/* 每位成功邀请奖励的采贝（逐条手动领取） */
const inviteSuccessCb = 10

/**
 * 里程碑（累计成功邀请人数达档奖励，自助领取，不限本周）
 *   - type: 'cb' 采贝 / 'vip' 会员 / 'talkcard' 畅聊卡
 *   - value + unit: vip/talkcard 的时长（day/hour）；cb 直接为采贝数
 *   - label: 前端展示文案（与档位标签一致）
 */
const milestones = [
	{ tier: 5,   type: 'cb', value: 10,  unit: '', label: '+10采贝' },
	{ tier: 10,  type: 'cb', value: 30,  unit: '', label: '+30采贝' },
	{ tier: 20,  type: 'cb', value: 60,  unit: '', label: '+60采贝' },
	{ tier: 50,  type: 'cb', value: 120, unit: '', label: '+120采贝' },
	{ tier: 100, type: 'cb', value: 200, unit: '', label: '+200采贝' }
]

/**
 * 每周邀请榜「前三名」奖励（周结算后发放，页面可领取）
 *   - rank: 名次（1/2/3）
 *   - type/value/unit/label: 同里程碑（当前为会员时长 vip + day）
 *   改档位/奖励只改这里；结算时会把当时的奖励快照写入 invite_week_rank（改配置不影响已结算的历史）
 */
const weeklyRankRewards = [
	{ rank: 1, type: 'vip', value: 30, unit: 'day', label: '1个月会员' },
	{ rank: 2, type: 'vip', value: 14, unit: 'day', label: '2周会员' },
	{ rank: 3, type: 'vip', value: 7,  unit: 'day', label: '1周会员' }
]

/* 分享卡片文案/配图（CTA 唤起微信分享时用） */
const share = {
	title: '采黎AI · 邀你来撩，聊得越久礼越多',
	imageUrl: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/share/share.png'
}

module.exports = {
	AppSecret,
	needChatCount,
	inviteSuccessCb,
	milestones,
	weeklyRankRewards,
	share
}
