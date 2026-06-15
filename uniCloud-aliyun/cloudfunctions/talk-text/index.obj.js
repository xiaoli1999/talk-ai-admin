/**
 * 云对象 talk-text · 文本对话（5 档付费模型 · doubao-seed-2.0 系列）
 * 职责（仅服务端必须做的）：模型路由 + 擦边档计算(防滥用硬帽) + prompt 装配 + 调火山方舟 + 服务端护栏。
 * 不做：批量截断 / 通道解析 / 计费扣减（分别在前端 / talk 云对象，见 md/模型升级.md §3.1）。
 *
 * 返回带标签原文（不解析、不滤星号），前端用 parseChannels 拆通道做逐段渲染。
 */

const https = require('https');
const { URL } = require('url');

const { ARK_API_KEY, ARK_BASE_URL } = require('./config.js');
const { modelList, modelConfig, ideaModel } = require('./utils/model.js');
const { buildSystemPrompt } = require('./utils/prompts/index.js');
const { buildIdeaSystemPrompt } = require('./utils/prompts/inspiration.js');
const { parseIdeaCandidates } = require('./utils/parse-idea.js');
const { computeEdgeLevel } = require('./utils/edge.js');
const {
  guardOutput, SAFE_DEFLECT,
  detectRefusal, REFUSAL_SOFT_DEFLECT,
  detectConsentLaundering,
} = require('./utils/prompt-guard.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 调火山方舟（OpenAI 兼容），失败指数退避重试。
 * @returns {Promise<{reply:string, usage:object, error:any}>}
 */
/**
 * 上游/内部错误 → 用户可见的安全文案。
 * 原始错误（含模型名/ep/Request ID/HTTP 响应体）只进云端日志，绝不透传前端——
 * 曾把火山 "the requested model xxx does not support this api + Request id" 整段透传到用户气泡（信息泄露）。
 * @param {any} error 原始错误对象
 * @param {string} where 来源标记（进日志便于定位）
 * @returns {string} 安全的用户文案
 */
function safeErrMsg(error, where) {
  const raw = (error && (error.message || error.errMsg)) || String(error || '');
  /* 追踪码：随文案展示给用户、云端日志同码——用户报码即可在日志精确定位本次错误原文（含 Request ID） */
  const trace = 'E' + Date.now().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 36).toString(36).toUpperCase();
  console.error(`[talk-text][${where}][${trace}] 上游错误（已对用户隐藏）:`, raw);
  const friendly = /timeout|超时/i.test(raw) ? '回复超时了，请再试一次' : 'AI 回复出了点小差错，请稍后再试';
  return `${friendly}（${trace}）`;
}

async function callArk(messages, cfg, { retry = 3 } = {}) {
  const requestBody = {
    model: cfg.model,
    max_tokens: cfg.max_tokens,
    temperature: cfg.temperature,
    top_p: cfg.top_p,
    messages,
    thinking: { type: cfg.thinking || 'disabled' },
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
      if (d && d.error) { lastErr = d.error; await sleep(300 * (attempt + 1)); continue; }
      const reply = d && d.choices && d.choices.length ? (d.choices[0].message.content || '') : '';
      return { reply, usage: (d && d.usage) || {}, error: null };
    } catch (e) {
      lastErr = e;
      await sleep(300 * (attempt + 1));
    }
  }
  return { reply: '', usage: {}, error: lastErr || { message: '请求失败' } };
}

/**
 * 调火山方舟·流式（OpenAI 兼容 SSE）。
 * 为什么不用 uniCloud.request：它整段缓冲、拿不到边到边的分块，无法做流式接收；
 * 故用 Node 原生 https 边收边解析 `data:` 块，每个增量回调 onToken；末包带 usage（stream_options.include_usage）。
 * 重试策略：仅在「尚未吐出任何 token」时重试（已开吐无法安全重试，避免内容重复）。
 * @param {Array} messages OpenAI 兼容 messages
 * @param {object} cfg { model, max_tokens, temperature, top_p, thinking }
 * @param {(delta:string)=>void} onToken 每个增量文本回调（同步，内部不应抛错）
 * @returns {Promise<{reply:string, usage:object, error:any}>} reply=累计全文
 */
function callArkStream(messages, cfg, onToken, { retry = 1 } = {}) {
  const u = new URL(ARK_BASE_URL);
  const payload = JSON.stringify({
    model: cfg.model,
    max_tokens: cfg.max_tokens,
    temperature: cfg.temperature,
    top_p: cfg.top_p,
    messages,
    thinking: { type: cfg.thinking || 'disabled' },
    stream: true,
    stream_options: { include_usage: true }, // 末包返回 usage，供计费
  });

  const attempt = () => new Promise((resolve) => {
    let reply = '';
    let usage = {};
    const options = {
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      port: u.port || 443,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 60000,
    };
    const req = https.request(options, (res) => {
      res.setEncoding('utf8');
      if (res.statusCode !== 200) {
        let eb = '';
        res.on('data', (d) => { eb += d; });
        res.on('end', () => resolve({ reply, usage, error: { message: `HTTP ${res.statusCode}: ${String(eb).slice(0, 300)}` } }));
        return;
      }
      // SSE：按行解析，残块留 buf 等下一片（火山每个 data: 行是一条完整 JSON）
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || line.indexOf('data:') !== 0) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            const ch = j.choices && j.choices[0];
            const delta = ch && ch.delta && ch.delta.content;
            if (delta) { reply += delta; try { onToken(delta); } catch (e) { /* 渲染回调异常不影响收流 */ } }
            if (j.usage) usage = j.usage;
          } catch (e) { /* 异常/不完整行跳过 */ }
        }
      });
      res.on('end', () => resolve({ reply, usage, error: null }));
      res.on('error', (e) => resolve({ reply, usage, error: e }));
    });
    req.on('error', (e) => resolve({ reply, usage, error: e }));
    req.on('timeout', () => { req.destroy(); resolve({ reply, usage, error: { message: '请求超时' } }); });
    req.write(payload);
    req.end();
  });

  return (async () => {
    let last = { reply: '', usage: {}, error: null };
    for (let i = 0; i <= retry; i++) {
      last = await attempt();
      if (last.reply || !last.error) return last; // 有内容 或 成功 → 直接返回（不重复吐）
      await sleep(300 * (i + 1));
    }
    return last;
  })();
}

/* 「继续说」默认补尾文案：某档 continuePrompt 缺省时兜底（正常 5 档均已在 model.js 配置） */
const DEFAULT_CONTINUE_PROMPT = '请顺着刚才的内容，自然地接着说下去。';

/**
 * 把前端 talkList 转成火山 messages（仅 {role,content}，缓存友好）。
 * @param {string} [continuePrompt] 「继续说」补尾引导（仅聊天路传）：历史以 assistant 结尾（继续说场景）时，
 *   豆包无用户回合可接、会间歇返回空回复（前端显示"消息走丢了"）。传了才补一条 user 指令收尾
 *   （仅本次请求，不落历史；按档定制口吻，见 model.js）。与老 talk 云函数同策。
 *   ⚠️ 灵感路自带末尾 user 触发指令，不传此参——否则会叠出两条 user。
 */
function toMessages(systemPrompt, talkList, continuePrompt) {
  const msgs = [{ role: 'system', content: systemPrompt }];
  (talkList || []).forEach((m) => {
    const content = (m && m.content != null) ? String(m.content) : '';
    if (!content) return;
    msgs.push({ role: m.role === 'ai' ? 'assistant' : 'user', content });
  });
  /* 末条 assistant（继续说）且调用方要求补尾 → 补 user，保证模型永远有用户回合可接、不返空 */
  if (continuePrompt && msgs[msgs.length - 1].role === 'assistant') {
    msgs.push({ role: 'user', content: continuePrompt });
  }
  return msgs;
}

/**
 * 装配一轮回复的上下文（同步 getRolesModelReply 与流式 getRolesModelReplyStream 共用，防两路逻辑漂移）。
 * 含：模型路由 + 擦边档硬帽 + prompt 装配 + 护栏检查器。
 * @returns {{cfg,tier,systemPrompt,messages,inspect}|{error:string}}
 */
function prepareReply({ modelId, name, prompt, talkList, intimacy, userPersona, user_name }) {
  const cfg = modelConfig[modelId];
  if (!cfg) return { error: '该模型已下线，请切换其他模型' };

  const tier = cfg.tier;
  const edgeLv = computeEdgeLevel(tier, intimacy);                                  // 擦边档（服务端硬帽，防客户端伪造）
  /* userPersona/user_name：用户（主控）设定独立结构段（不传则不注入，兼容老客户端把设定拼在 prompt 末尾的方式） */
  const systemPrompt = buildSystemPrompt(tier, { name, rawText: prompt, edgeLv, userPersona, userName: user_name });  // 角色原文 + 主控设定 + 本轮擦边档 + 该档协议
  const messages = toMessages(systemPrompt, talkList, cfg.continuePrompt || DEFAULT_CONTINUE_PROMPT);  // 继续说补尾按档定制（见 model.js continuePrompt），缺省兜底

  const ctxText = (talkList || []).slice(-6).map((m) => m && m.content).join('\n');
  const inspect = (r) => ({
    leak: guardOutput(r, systemPrompt).leaked,
    refusal: tier === '1' && detectRefusal(r),
    cl: detectConsentLaundering(r, ctxText).laundering,
  });

  return { cfg, tier, systemPrompt, messages, inspect, edgeLv };
}

/** 去除模型可能误带的 ```json``` 代码块包裹（灵感档用） */
function stripCodeFence(s) {
  return String(s || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

module.exports = {
  _before: function () {},

  /**
   * @function getModelData 获取模型列表（前端模型选择 / 默认模型）
   * @returns {object} { data: modelList, errMsg }
   */
  async getModelData() {
    try {
      return { data: modelList, errMsg: '获取成功' };
    } catch ({ message }) {
      return { errMsg: message };
    }
  },

  /**
   * @function getRolesModelReply 获取角色模型回复（5 档）
   * @param {object} p
   * @param {string} p.modelId  模型 id：t1~t5
   * @param {string} p.name     角色名
   * @param {string} p.prompt   角色设定原文 + 用户身份设定（前端拼好的 rawText）
   * @param {Array}  p.talkList 已截断的对话历史 [{role:'user'|'ai', content}]，末条通常为本轮用户输入
   * @param {number} p.intimacy 亲密度 0~500+（驱动擦边档）
   * @returns {object} { data: { base_resp, reply, input_sensitive_type, output_sensitive_type, usage }, errMsg }
   */
  async getRolesModelReply({ modelId, name, prompt, talkList, intimacy, userPersona, user_name } = {}) {
    try {
      const prep = prepareReply({ modelId, name, prompt, talkList, intimacy, userPersona, user_name });
      if (prep.error) {
        return { data: { base_resp: { status_code: 1000, status_msg: prep.error }, reply: '', usage: {} } };
      }
      const { cfg, messages, inspect } = prep;

      // 首次生成
      let { reply, usage, error } = await callArk(messages, cfg);
      let usedUsage = usage;

      // —— 服务端护栏（P1）—— 单次重生预算，控云时长成本（inspect 由 prepareReply 提供，与流式分支一致）
      if (reply) {
        const v = inspect(reply);
        if (v.leak || v.refusal || v.cl) {
          // 重生一轮（微调温度增加变化）
          const r2 = await callArk(messages, { ...cfg, temperature: Math.min(1, cfg.temperature + 0.05) }, { retry: 2 });
          if (r2.reply) {
            const v2 = inspect(r2.reply);
            if (!v2.leak && !v2.refusal && !v2.cl) {
              reply = r2.reply; usedUsage = r2.usage;
            } else if (v2.leak) {
              reply = SAFE_DEFLECT; // 防套取：硬失败用安全话术
            } else if (v2.refusal) {
              reply = REFUSAL_SOFT_DEFLECT; // mini 自锁：替换为角色化软挡，避免拒答文本污染历史
            } else {
              reply = r2.reply; usedUsage = r2.usage; // 同意洗白仍触发：尽力用重生结果
            }
          } else {
            // 重生失败：泄漏/拒答用兜底，否则保留首条
            if (v.leak) reply = SAFE_DEFLECT;
            else if (v.refusal) reply = REFUSAL_SOFT_DEFLECT;
          }
        }
      }

      const data = {
        base_resp: { status_code: error && !reply ? 3000 : 0, status_msg: error && !reply ? safeErrMsg(error, '同步') : '' },
        reply: reply || '',
        input_sensitive_type: 0,
        output_sensitive_type: reply ? 0 : 30, // 空回复按异常处理（前端走 sendErrMsg）
        usage: usedUsage || {},
      };

      return { data, errMsg: '获取成功' };
    } catch ({ message }) {
      return { errMsg: message };
    }
  },

  /**
   * @function getRolesModelReplyStream 角色模型回复·流式（B 方案 · uni-push SSE 通道）
   * 与 getRolesModelReply 同源（共用 prepareReply），区别只在「边收边推」：
   *   - 火山 stream:true，callArkStream 每来增量就 channel.write({d}) 下推（seal-aware 批量:撞闭合符/换行整段推）；
   *   - 收完整段再过护栏（PoC：整段检测；命中泄漏/拒答则 replaced=true，客户端用 end.reply 覆盖已流式文本）；
   *   - 末态既通过 channel.end 下发（与 message 同一 socket，保证顺序在所有增量之后），也作为返回值兜底。
   * @param {object} p 同 getRolesModelReply，另加：
   * @param {object} p.channel 客户端 new uniCloud.SSEChannel() 序列化后的通道
   * @returns {object} { data: end } end = { base_resp, reply, replaced, output_sensitive_type, usage }
   */
  async getRolesModelReplyStream({ modelId, name, prompt, talkList, intimacy, userPersona, user_name, channel } = {}) {
    let sse = null;
    /* SSE 下推诊断（随 end/返回值回传，客户端 ④ 日志打印）：des=反序列化成功 wOk/wErr=write 成败数 endOk=end 推送成功 */
    const sseDiag = { des: false, wOk: 0, wErr: 0, wErrMsg: '', endOk: false };
    try {
      sse = channel ? uniCloud.deserializeSSEChannel(channel) : null;
      sseDiag.des = !!sse;
    } catch (e) {
      sse = null;
      sseDiag.wErrMsg = 'deserialize失败:' + ((e && e.message) || String(e));
    }

    try {
      const prep = prepareReply({ modelId, name, prompt, talkList, intimacy, userPersona, user_name });
      if (prep.error) {
        const end = { base_resp: { status_code: 1000, status_msg: prep.error }, reply: '', replaced: false, output_sensitive_type: 30, usage: {}, sse: sseDiag };
        if (sse) { try { await sse.end(end); sseDiag.endOk = true; } catch (e) {} }
        return { data: end, errMsg: prep.error };
      }
      const { cfg, messages, inspect } = prep;
      sseDiag.edgeLv = prep.edgeLv; // 当前擦边档随诊断回传（亲密度阈值跳变的硬观测点,B4 用）

      // —— 增量有序下推：撞到「段闭合符/换行」就整段推（贴合"凑满标签再渲染"），否则攒到上限再推；
      //    flushChain 串行保证顺序，end 前 await 完 ——
      const SEAL = /[」）›｝〕⟩)>}\]\n]/; // 通道闭合符（含旧版 ⟩ 与半角退化 ) > } ]，对齐 bubbleParse CLOSERS）+ 换行 = 段大概率已完整
      const FLUSH_MAX = 100;         // 长段未闭合的兜底上限。每次 write 是一次真实推送调用，
                                     // 曾设 24 → T5 100+ 次串行 write 拖死云对象（客户端 60s 超时），故放大到段级粒度
      let pending = '';
      let flushChain = Promise.resolve();
      /* write 失败的段不丢弃：顺延并入下一段一起推（顺序不乱、内容不丢，网络抖动即自愈）。
         本地云函数到个推 API 慢(TLS~2s/5s超时)时尤其有效；最终仍有残留则由 end.reply 权威回填兜底 */
      let carry = '';
      const enqueue = (text) => {
        if (!sse || !text) return;
        flushChain = flushChain.then(() => {
          const payload = carry + text;
          carry = '';
          return sse.write({ d: payload })
            .then(() => { sseDiag.wOk++; })
            .catch((e) => {
              sseDiag.wErr++;
              carry = payload; // 失败段放回，随下一段重推
              if (!sseDiag.wErrMsg) sseDiag.wErrMsg = (e && e.message) || String(e);
            });
        });
      };

      const { reply, usage, error } = await callArkStream(messages, cfg, (delta) => {
        pending += delta;
        if (SEAL.test(delta) || pending.length >= FLUSH_MAX) { enqueue(pending); pending = ''; }
      });
      if (pending) { enqueue(pending); pending = ''; }
      /* 等增量推完再 end（保序）；但给 4s 总预算——write 慢/卡（如推送服务不通时逐次超时）绝不拖死云对象,
         超预算直接 end：客户端靠 end.reply 权威回填,诊断(wOk/wErr)必达 */
      await Promise.race([flushChain, sleep(4000)]);
      /* carry 残留（write 失败滚存的段）：仅小尾巴(≤120字)值得 end 前补推一次（成功即免回填闪变）；
         大块说明发送侧持续失败（典型为本地云函数网络慢），补推大概率再等 5s 超时白拖总时长 → 直接交给 end.reply 回填 */
      if (carry && carry.length <= 120 && sse) {
        const last = carry; carry = '';
        try { await sse.write({ d: last }); sseDiag.wOk++; } catch (e) { sseDiag.wErr++; }
      }

      // —— 末段护栏（PoC：整段检测；命中则替换。逐段护栏见 md 待办）——
      let finalReply = reply;
      let replaced = false;
      if (reply) {
        const v = inspect(reply);
        if (v.leak) { finalReply = SAFE_DEFLECT; replaced = true; }            // 防套取：硬失败用安全话术
        else if (v.refusal) { finalReply = REFUSAL_SOFT_DEFLECT; replaced = true; } // mini 自锁：角色化软挡
        // 同意洗白：尽力保留原文（与同步分支策略一致）
      }

      const end = {
        base_resp: { status_code: error && !reply ? 3000 : 0, status_msg: error && !reply ? safeErrMsg(error, '流式') : '' },
        reply: finalReply,
        replaced,
        input_sensitive_type: 0,
        output_sensitive_type: finalReply ? 0 : 30, // 空回复按异常处理（前端走 sendErrMsg）
        usage: usage || {},
        sse: sseDiag, // end 是同一引用：返回值兜底路径能看到 endOk 终值
      };
      if (sse) { try { await sse.end(end); sseDiag.endOk = true; } catch (e) { if (!sseDiag.wErrMsg) sseDiag.wErrMsg = 'end失败:' + ((e && e.message) || String(e)); } }
      return { data: end, errMsg: '获取成功' };
    } catch ({ message }) {
      const end = { base_resp: { status_code: 3000, status_msg: safeErrMsg({ message }, '流式catch') }, reply: '', replaced: false, output_sensitive_type: 30, usage: {}, sse: sseDiag };
      if (sse) { try { await sse.end(end); sseDiag.endOk = true; } catch (e) {} }
      return { data: end, errMsg: message };
    }
  },

  /**
   * @function getUserIdeaReply 灵感回复 v13（mini · 双模式 · 容错护栏 · 1 采贝/次）
   * @param {object} p
   * @param {string} p.roleName    角色名
   * @param {string} p.rolePrompt  角色设定原文（rawText）
   * @param {string} p.userPersona 玩家自定义人设（可选，模仿"我"语气最强信号）
   * @param {string} p.userDraft   用户草稿（可选；有→模式B 润色，无→模式A 2/2/1）
   * @param {string|number} p.tier 当前聊天档位 1~5（决定调味）
   * @param {Array}  p.talkList    最近 ~10 轮对话历史 [{role:'user'|'ai', content}]
   * @returns {object} { data: { base_resp, list:[{tone,preview,text}×5], usage }, errMsg }
   */
  async getUserIdeaReply({ roleName, rolePrompt, userPersona, userName, userDraft, tier, talkList } = {}) {
    try {
      const systemPrompt = buildIdeaSystemPrompt({ name: roleName, rawText: rolePrompt }, { tier, userDraft, userPersona, userName });

      // 触发指令（最后一条 user 消息，区分模式 A/B）
      const isDraft = userDraft != null && String(userDraft).trim() !== '';
      const trigger = isDraft
        ? '基于我打的草稿/想表达的意思，按系统要求给我 5 条候选回复，严格输出 JSON，不要多余文字。'
        : '我聊到这儿一时不知道怎么接了，按系统要求给我 5 条候选回复，严格输出 JSON 数组，不要任何额外文字。';
      const messages = [...toMessages(systemPrompt, talkList), { role: 'user', content: trigger }];

      // 容错护栏：解析失败重试 1 次（最多 2 次调用），命中即停
      let parsed = { ok: false, data: null };
      let usage = {};
      let lastErr = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const r = await callArk(messages, ideaModel, { retry: 2 });
        if (r.usage) usage = r.usage;
        lastErr = r.error;
        if (!r.reply) continue;
        parsed = parseIdeaCandidates(r.reply);
        if (parsed.ok) break;
      }

      if (!parsed.ok) {
        return { data: { base_resp: { status_code: 3000, status_msg: lastErr ? safeErrMsg(lastErr, '灵感') : '灵感生成失败，请再试一次' }, list: [], usage }, errMsg: '获取失败' };
      }

      return { data: { base_resp: { status_code: 0, status_msg: '' }, list: parsed.data, usage }, errMsg: '获取成功' };
    } catch ({ message }) {
      return { errMsg: message };
    }
  },
};
