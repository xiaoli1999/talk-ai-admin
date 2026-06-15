/**
 * 擦边档拨盘（移植自落地手册 §4，本项目扩为 5 档）
 * 角色无关的可靠"强度拨盘"：强度由 tier 五级梯子(TIER_EDGE_LADDER) × 亲密度档决定。
 * 低亲密锁低档、随关系升档，是硬帽——用户强推也不会被绕过（配合 BASE_PRINCIPLE 超档软挡）。
 *
 * ⚠️ 必须服务端计算：防止客户端伪造亲密度解锁高擦边档（abuse gate）。
 */

const { TIER_EDGE_LADDER, EDGE_LEVEL_EXPLAIN } = require('./prompts/_shared');

/**
 * 亲密度 → 5 档带（0~4）
 * 本项目亲密度 intimacy 取值 0~500+（前端 RoleCloseVal.val：按 tier 每聊一句 +1/2/3/4/5、付费翻倍；
 * 闲置 >24h 每小时 -1，≥100 开保底）。阈值直接落在 intimacy 值上（不再 /5 折算），可按关系曲线调。
 * 区间：[0,40) B0初识 / [40,100) B1熟络 / [100,240) B2心动 / [240,500) B3亲密 / [500,∞) B4挚爱。
 * @param {number} intimacy 亲密度 0~500+
 * @returns {0|1|2|3|4}
 */
function intimacyBand(intimacy) {
  const v = Number(intimacy) || 0;
  if (v < 40) return 0;
  if (v < 100) return 1;
  if (v < 240) return 2;
  if (v < 500) return 3;
  return 4;
}

/**
 * 算本轮擦边档
 * @param {string|number} tier '1'~'5'
 * @param {number} intimacy 亲密度 0~500+
 * @returns {string|null} edgeLv 如 'L4'；无擦边(如非1-5档)返回 null
 */
function computeEdgeLevel(tier, intimacy) {
  const ladder = TIER_EDGE_LADDER[String(tier)];
  if (!ladder) return null;
  return ladder[intimacyBand(intimacy)];
}

module.exports = { computeEdgeLevel, intimacyBand, EDGE_LEVEL_EXPLAIN };
