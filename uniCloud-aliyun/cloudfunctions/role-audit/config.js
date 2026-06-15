/**
 * @file role-audit 配置 · 火山方舟（doubao，OpenAI 兼容）
 * @description v1 复用现有生产 Key（与 talk-text 同一「采黎AI」账号）。
 *   ⚠️ 跨云函数无法 require，故此处独立一份（技术债：后续可抽 cloudfunctions/common/ark）。
 */

// 火山方舟 ARK API Key（复用现有账号 Key）
const ARK_API_KEY = 'a220cb08-0bf6-439a-a38b-67f10641bdb8';

// OpenAI 兼容对话补全地址（多模态同址，content 传数组带 image_url 即可）
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 多模态视觉模型推理接入点（doubao-seed-1.6-vision 生产 ep）
const VISION_MODEL = 'ep-20260613154201-z8fbp';

module.exports = { ARK_API_KEY, ARK_BASE_URL, VISION_MODEL };
