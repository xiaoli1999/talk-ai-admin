/**
 * Prompt 装配总入口
 * buildSystemPrompt(tier, character) → 完整系统 prompt
 *   tier ∈ '1'~'5' | 'idea'
 *   character = { name, rawText, edgeLv }
 */

const tier1 = require('./tier-1-common');
const tier2 = require('./tier-2-detail');
const tier3 = require('./tier-3-romance');
const tier4 = require('./tier-4-plot');
const tier5 = require('./tier-5-dream');
// 灵感档不走通用派发：参数更多(tier/草稿/人设)，由 index.obj.js 直接调 inspiration.buildIdeaSystemPrompt

const TIER_BUILDERS = {
  '1': tier1,
  '2': tier2,
  '3': tier3,
  '4': tier4,
  '5': tier5,
};

/**
 * @param {string} tier '1'~'5' | 'idea'
 * @param {object} character { name, rawText, edgeLv }
 * @returns {string} 系统 prompt
 */
function buildSystemPrompt(tier, character) {
  const builder = TIER_BUILDERS[String(tier)];
  if (!builder) throw new Error(`Unknown tier: ${tier}`);
  return builder.buildSystemPrompt(character);
}

module.exports = { buildSystemPrompt };
