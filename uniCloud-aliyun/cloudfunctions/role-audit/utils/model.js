/**
 * @file role-audit · 火山方舟多模态调用封装
 * @description 仿 talk-text/index.obj.js 的 callArk，改为审核场景：低温求稳、关思考、支持 image_url。
 */

const { ARK_API_KEY, ARK_BASE_URL } = require('../config.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 调火山方舟多模态（OpenAI 兼容），失败指数退避重试。
 * @param {Array}  messages OpenAI 兼容 messages（user.content 可为数组，含 {type:'image_url'}）
 * @param {object} cfg      { model, max_tokens, temperature, top_p }
 * @param {object} [opts]   { retry }
 * @returns {Promise<{content:string, usage:object, error:any}>}
 */
async function callVision(messages, cfg = {}, { retry = 3 } = {}) {
  const requestBody = {
    model: cfg.model,
    max_tokens: cfg.max_tokens || 1200,
    // 审核求稳定、可复现 → temperature=0 贪婪解码（同一角色每次判定一致，避免温度抖动导致误驳）、关思考
    temperature: cfg.temperature == null ? 0 : cfg.temperature,
    top_p: cfg.top_p == null ? 0.7 : cfg.top_p,
    messages,
    thinking: { type: 'disabled' },
  };
  const params = {
    url: ARK_BASE_URL,
    method: 'POST',
    header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ARK_API_KEY}` },
    data: requestBody,
    timeout: 60000,
  };

  let lastErr = null;
  for (let attempt = 0; attempt < retry; attempt++) {
    try {
      const res = await uniCloud.request(params);
      const d = res && res.data;
      if (d && d.error) { lastErr = d.error; await sleep(400 * (attempt + 1)); continue; }
      const content = d && d.choices && d.choices.length ? (d.choices[0].message.content || '') : '';
      return { content, usage: (d && d.usage) || {}, error: null };
    } catch (e) {
      lastErr = e;
      await sleep(400 * (attempt + 1));
    }
  }
  return { content: '', usage: {}, error: lastErr || { message: '请求失败' } };
}

module.exports = { callVision };
