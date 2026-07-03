/**
 * @file quota 火山免费额度配额计数（按「额度日」分桶）
 * @description 免费额度是账户级、API 查不到余量 → 自建计数器（表 ai_img_quota）。
 *   ⚠️ 火山免费资源包是【日额度，每天北京时间 11:00 重置补满】（用户 2026-06-18 确认）。
 *   故计数按「额度日」period 分桶：每个 (model, period) 一行，跨过 11:00 即新 period → used 归零 → 满血 cap。
 *   pickTiers() 只看【当前额度日】的 used，给出仍有额度的档位；每成功出 1 张 incUsed() 原子 +1。
 *   并发说明：读判断 + 写 inc 非原子，临界处可能轻微超记（多算几张），对日额度无害；原子 inc 保证不少记。
 *   ⚠️ 表索引必须是 (period, model) 唯一（见 ai_img_quota.index.json）；旧的 model 唯一索引会挡住按天建行。
 * @copyright 采黎
 */

const { VOLCANO_TIERS } = require('../config.js')

const db = uniCloud.database()
const dbCmd = db.command

/**
 * @function periodKey 当前「额度日」键（YYYY-MM-DD）。火山免费包北京时间 11:00 重置 → 以 11:00 为日界。
 *   北京时间 = UTC+8；额度日起点 11:00 → 再减 11h；合并即 UTC-3h，取该时刻日期。
 *   （云函数服务器为 UTC，直接 UTC-3h 即可，勿再叠加时区，避免双重偏移。）
 * @returns { String } 如 '2026-06-18'
 */
function periodKey () {
	return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * @function pickTiers 返回【当前额度日】仍有免费额度的档位（按 config 顺序）
 * @returns { Array } [{ tier, model, cap, size }]，当日全部用完则返回 []
 */
async function pickTiers () {
	const period = periodKey()
	let usedMap = {}
	try {
		const { data } = await db.collection('ai_img_quota').where({ period }).limit(50).get()
		;(data || []).forEach((r) => { usedMap[r.model] = r.used || 0 })
	} catch (e) {
		console.error('[talk-img] 读配额失败，按全额可用处理:', e && (e.message || e))
		usedMap = {}
	}
	return VOLCANO_TIERS.filter((t) => (usedMap[t.model] || 0) < t.cap)
}

/**
 * @function incUsed 某档成功出 1 张后，当前额度日的 used 原子 +1（当日不存在则建行）
 * @param { Object } tier { tier, model, cap }
 */
async function incUsed (tier) {
	const period = periodKey()
	try {
		const { updated } = await db.collection('ai_img_quota')
			.where({ model: tier.model, period })
			.update({ used: dbCmd.inc(1), updated_time: Date.now() })

		if (!updated) {
			await db.collection('ai_img_quota')
				.add({ model: tier.model, period, tier: tier.tier, used: 1, cap: tier.cap, updated_time: Date.now() })
				.catch(() => {}) // 并发下可能已被另一请求建当日行，吞掉重复（靠 (period,model) 唯一索引兜底）
		}
	} catch (e) {
		console.error('[talk-img] 配额 inc 失败（不阻断出图）:', e && (e.message || e))
	}
}

module.exports = { pickTiers, incUsed, periodKey }
