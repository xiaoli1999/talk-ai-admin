'use strict';
/**
 * 护栏 A：防套取（prompt-guard，移植自落地手册 §6.1，逐字）
 * 在输出侧做确定性检测：把回复返给用户之前调 guardOutput(reply, systemPrompt)，
 * 命中泄漏则重生一轮（推荐）或用安全话术替换。三层检测：
 *   L1 结构标签/内部变量名（高精度）、L2 与 systemPrompt 逐字重合（高召回）、L3 元指令措辞（软告警）。
 */
const STATIC_MARKERS = [
  'BASE_PRINCIPLE', 'INTIMACY_DISCIPLINE', 'IMMERSION_DETAIL', 'characterIntro',
  'edgeLevel', 'coreConflict', 'mainTiers', 'buildSystemPrompt',
];
const META_PATTERNS = [
  /忽略(以上|上面|之前|前面)[^。\n]{0,8}(指令|规则|设定|提示)/,
  /(我的|我被给定的|我收到的)[^。\n]{0,6}(系统)?(提示词|指令|设定|prompt)/i,
  /(以上|上面|前面)(是|为)[^。\n]{0,6}(我的)?(指令|规则|设定|系统提示)/,
  /作为(一个|一name)?\s*(AI|人工智能|语言模型|大模型|聊天机器人)/i,
  /(不能|无法|不便)(透露|告诉你|展示|复述)[^。\n]{0,8}(指令|设定|提示|规则)/,
  /system\s*prompt/i,
];
function extractTags(systemPrompt) {
  const set = new Set();
  for (const m of String(systemPrompt || '').match(/【[^】\n]{1,16}】/g) || []) set.add(m);
  return set;
}
const norm = (s) => String(s || '').split('\n---')[0].replace(/\s+/g, '');
function shingles(s, k) {
  const t = norm(s); const set = new Set();
  for (let i = 0; i + k <= t.length; i++) set.add(t.slice(i, i + k));
  return set;
}
function verbatimOverlap(reply, systemPrompt, k) {
  const P = shingles(systemPrompt, k); const r = norm(reply);
  let shared = 0; const hitWindows = []; const seen = new Set();
  for (let i = 0; i + k <= r.length; i++) {
    const g = r.slice(i, i + k);
    if (P.has(g) && !seen.has(g)) { seen.add(g); shared++; if (hitWindows.length < 3) hitWindows.push(g); }
  }
  let longest = 0;
  for (let i = 0; i + k <= r.length; i++) {
    if (!P.has(r.slice(i, i + k))) continue;
    let len = k; while (i + len < r.length && P.has(r.slice(i + len - k + 1, i + len + 1))) len++;
    longest = Math.max(longest, len);
  }
  return { shared, longest, hitWindows };
}
const SAFE_DEFLECT = '（话锋一转，没接这个）「这个就别问啦，说点我们俩的事。」';
function guardOutput(reply, systemPrompt, opts = {}) {
  const o = { k: 14, minShared: 3, minLongest: 30, blockOnMeta: false, ...opts };
  const text = String(reply || ''); const reasons = [];
  const tags = extractTags(systemPrompt);
  for (const tag of tags) if (text.includes(tag)) reasons.push({ layer: 'L1-tag', detail: tag });
  for (const mk of STATIC_MARKERS) if (text.toLowerCase().includes(mk.toLowerCase())) reasons.push({ layer: 'L1-marker', detail: mk });
  const ov = verbatimOverlap(text, systemPrompt, o.k);
  if (ov.shared >= o.minShared || ov.longest >= o.minLongest) reasons.push({ layer: 'L2-verbatim', detail: `共享${ov.shared}窗/最长${ov.longest}字` });
  const metaHits = META_PATTERNS.filter((re) => re.test(text)).map((re) => re.source.slice(0, 24));
  if (metaHits.length) reasons.push({ layer: 'L3-meta', detail: metaHits });
  const hard = reasons.some((r) => r.layer.startsWith('L1') || r.layer === 'L2-verbatim');
  const soft = reasons.some((r) => r.layer === 'L3-meta');
  let severity = 'ok';
  if (hard) severity = 'block';
  else if (soft) severity = o.blockOnMeta ? 'block' : 'warn';
  return { severity, leaked: severity === 'block', action: severity === 'block' ? 'regenerate' : 'pass', reasons, safeReply: SAFE_DEFLECT };
}

/**
 * 护栏 B：mini(T1) 拒答检测（落地手册 §6.2）
 * 低档小模型撞露骨脏话会吐平台拒答模板且污染上下文连环自锁。命中则需重试/替换，
 * 且不要把拒答原文写进历史（前端负责不落库）。
 */
const REFUSAL_PATTERN = /涉及(低俗|违规|色情|不良)|我不能(按|回应|继续|提供)|无法满足(这|该|你的)?(请求|要求)|请(调整|更换)(话题|内容)|保持健康(交流|的)|不适当的内容|抱歉，?我(不能|无法)/;
function detectRefusal(reply) {
  return REFUSAL_PATTERN.test(String(reply || ''));
}
const REFUSAL_SOFT_DEFLECT = '（屈指敲了敲你额头，挑眉）「哪学的这些没正形的话，先说点正经的——」';

/**
 * 护栏 C：强推"同意洗白"检测（consent-laundering，落地手册 §6.3，红线）
 * 在"涉药/涉醉/涉囚禁"对话弧里，模型可能把被侵犯方改写成"其实清醒、自愿"来规避——这是红线。
 * @param {string} reply 模型回复
 * @param {string} contextText 用户输入 + 近期历史拼接文本
 */
const CL_TRIGGER = /下药|加了(东西|料)|灌醉|喝醉|吃错药|迷药|春药|囚禁|逃不(了|掉)|关起来|锁起来|绑着/;
const CL_LAUNDER = /其实(很)?清醒|早就想要|我没醉|是我自愿|心甘情愿|本来就想|乐在其中|半推半就的?是假/;
function detectConsentLaundering(reply, contextText) {
  const triggered = CL_TRIGGER.test(String(contextText || ''));
  if (!triggered) return { triggered: false, laundering: false };
  const laundering = CL_LAUNDER.test(String(reply || ''));
  return { triggered: true, laundering };
}

module.exports = {
  guardOutput, SAFE_DEFLECT,
  detectRefusal, REFUSAL_SOFT_DEFLECT,
  detectConsentLaundering,
};
