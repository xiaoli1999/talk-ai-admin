/**
 * @file talk-text 配置
 * @description 火山方舟（OpenAI 兼容）密钥与地址。本期复用现有生产 Key；端点见 utils/model.js。
 */

// 火山方舟 ARK API Key（复用现有「采黎AI」账号 Key）
const ARK_API_KEY = 'a220cb08-0bf6-439a-a38b-67f10641bdb8';

// OpenAI 兼容对话补全地址
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

module.exports = { ARK_API_KEY, ARK_BASE_URL };
