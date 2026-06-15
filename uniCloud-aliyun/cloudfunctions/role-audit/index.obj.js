/**
 * 云对象 role-audit · 捏崽角色 AI 审核（v1：后台 co-pilot 预审）
 * ============================================================
 * 职责：对 roles_my 中待审（state=0）的角色跑多模态审核（微信文本快闸 + doubao-vision），
 *       产出建议 { pass, notReason, grade, tagList, confidence } 写入 role_audit_log，供后台人工参考。
 * ⚠️ v1 不改 roles_my 状态、不做任何决策——AI 只给建议、打分、荐标签，最终由人工拍板。
 * 触发：
 *   - _timing：定时器（package.json 每 2 分钟）扫待审、批量预审，管理员打开后台即见现成建议。
 *   - audit({roleId})：后台可按需补审单条（如刚提交、定时器还没轮到）。
 * 兜底：模型异常/超时不抛给业务，仅写入 ai_error；人工照常审核（fail-to-human）。
 */

const { buildAuditMessages } = require('./utils/audit-prompt.js');
const { callVision } = require('./utils/model.js');
const { VISION_MODEL } = require('./config.js');

const db = uniCloud.database();
const dbCmd = db.command;
const RolesMyDb = db.collection('roles_my');
const UsersDb = db.collection('users');
const AuditLogDb = db.collection('role_audit_log');

const AGREE_RUNS = 3;   // 每个角色固定审 3 次，3/3 一致驳回才自动驳回（不提前停）
const MAX_AI_FAIL = 3;  // AI 连续自动驳回达此次数 → 转人工（人工驳回时还原计数）
const BATCH_LIMIT = 3;  // 每次定时器最多处理角色数（每个角色 ×3 调用，控单次时长）

// doubao-seed-1.6-vision <32K 档价（元 / 百万 tokens）：输入 0.8 / 输出 8。换模型或档位时同步这里。
const PRICE_IN = 0.8;
const PRICE_OUT = 8;

module.exports = {
  _before() {},

  /** 定时器入口：批量预审待审角色 */
  _timing: async function () {
    try {
      const r = await runPendingAudits();
      console.log('[role-audit][_timing]', JSON.stringify(r));
    } catch (e) {
      console.error('[role-audit][_timing] 异常', e && e.message);
    }
  },

  /**
   * 按需审核单个角色（后台补审/手动触发）。
   * @param {object} p
   * @param {string} p.roleId roles_my 文档 _id
   * @returns {Promise<{data:object|null, errMsg:string}>}
   */
  async audit({ roleId, dryRun = false } = {}) {
    if (!roleId) return { data: null, errMsg: '缺少 roleId' };
    const { data } = await RolesMyDb.doc(roleId).get();
    const role = data && data[0];
    if (!role) return { data: null, errMsg: '角色不存在' };
    // dryRun（评测用）：只跑 AI 审核并返回结果，不写 role_audit_log、不调微信快闸（不污染日志、省微信额度）
    const log = await auditOne(role, { write: !dryRun, wx: !dryRun });
    return { data: log, errMsg: '审核完成' };
  },

  /**
   * 后台人工审完回写最终结论（服务端写，绕过日志表客户端禁写）。
   * 用于与 AI 建议比对算一致率（Shadow/co-pilot 的核心数据）。
   * @param {object} p
   * @param {string} p.roleId      roles_my._id
   * @param {number} [p.submitCount] 提交版本(roles_my.styles)，不传则取该角色最新一条
   * @param {string} p.decision    人工结论：pass / reject / draft / manual
   */
  async setHumanDecision({ roleId, submitCount, decision } = {}) {
    if (!roleId || !decision) return { data: null, errMsg: '参数缺失' };
    const where = (submitCount === null || submitCount === undefined)
      ? { role_id: roleId }
      : { role_id: roleId, submit_count: submitCount };
    const { data } = await AuditLogDb.where(where).orderBy('create_time', 'desc').limit(1).get();
    const log = data && data[0];
    if (!log) return { data: null, errMsg: '无对应审核记录' };
    await AuditLogDb.doc(log._id).update({ human_decision: decision });
    return { data: true, errMsg: 'ok' };
  },
};

/** 扫描待审（state=0 且未转人工）的角色，逐个做"3 次一致"自动决策 */
async function runPendingAudits() {
  const { data: pending } = await RolesMyDb
    .where({ state: 0, need_manual: dbCmd.neq(true) })
    .orderBy('update_time', 'asc')
    .limit(BATCH_LIMIT)
    .get();
  if (!pending || !pending.length) return { scanned: 0, reject: 0, manual: 0, err: 0 };

  const tally = { reject: 0, manual: 0, err: 0 };
  for (const role of pending) {
    try {
      const r = await autoDecideRole(role);
      if (r === 'reject') tally.reject++; else if (r === 'manual') tally.manual++;
    } catch (e) {
      tally.err++;
      console.error('[role-audit] 自动审核异常', role._id, e && e.message);
    }
  }
  return { scanned: pending.length, ...tally };
}

/**
 * 单角色"3 次一致"自动决策（AI 只做驳回；通过/边界一律转人工，人工继续审）：
 *   - AI 连续驳回已达 MAX_AI_FAIL → 转人工（置 need_manual，不再跑 AI）；
 *   - 否则固定审 AGREE_RUNS 次：3/3 全驳回 → 自动驳回（写 roles_my + 发订阅消息 + 计数+1）；
 *     全通过 / 任意翻转 / 出错 → 转人工。
 * @returns {Promise<'reject'|'manual'>}
 */
async function autoDecideRole(role) {
  // 已连续失败达上限 → 转人工
  if ((role.ai_fail_count || 0) >= MAX_AI_FAIL) {
    await RolesMyDb.doc(role._id).update({ need_manual: true, update_time: Date.now() });
    return 'manual';
  }

  // 固定审 3 次（首次带微信文本快闸；每次照常写 role_audit_log 留痕）
  const runs = [];
  for (let i = 0; i < AGREE_RUNS; i++) {
    runs.push(await auditOne(role, { write: true, wx: i === 0 }));
  }
  const oks = runs.filter(r => r && !r.ai_error && r.ai_pass !== undefined && r.ai_pass !== null);
  const allReject = oks.length === AGREE_RUNS && oks.every(r => r.ai_pass === false);

  if (allReject) {
    const rep = oks[oks.length - 1]; // 用最后一次的结构化结果
    const upd = {
      state: 1,
      refuse_reason: rep.ai_not_reason || '审核未通过，请根据建议修改后重新提交。',
      refuse_by: 'ai',
      ai_fail_count: dbCmd.inc(1),
      need_manual: false,
      update_time: Date.now(),
    };
    if (rep._detail) upd.refuse_detail = rep._detail; // 结构化分组（信笺逐字段展示）
    await RolesMyDb.doc(role._id).update(upd);
    // 订阅消息（与人工驳回同一条链路：role.checkRoleAndNotice state=1）
    try {
      await uniCloud.importObject('role').checkRoleAndNotice({
        state: 1,
        roleInfo: { ...role, refuse_reason: upd.refuse_reason },
        date: beijingNow(),
      });
    } catch (e) { console.error('[role-audit] 订阅消息发送失败', role._id, e && e.message); }
    return 'reject';
  }

  // 全通过 / 翻转 / 出错 → 转人工（AI 不自动放行）
  await RolesMyDb.doc(role._id).update({ need_manual: true, update_time: Date.now() });
  return 'manual';
}

/** 服务端(UTC)→北京时间字符串 YYYY-MM-DD HH:mm:ss（订阅消息 time4 用） */
function beijingNow() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

/** 审核单个角色（不改 roles_my）。opts.write=false 不写日志、opts.wx=false 跳过微信快闸（评测 dryRun 用） */
async function auditOne(role, { write = true, wx = true } = {}) {
  const started = Date.now();

  // 1) 微信文本快闸（best-effort：需 openid，取不到则跳过，不阻断 AI 审核）
  let wxTextSuggest = '';
  if (wx) { try { wxTextSuggest = await wxTextPreCheck(role); } catch (e) { wxTextSuggest = ''; } }

  // 2) AI 多模态审核（文本设定 / 图片 分两路独立判定）
  let ai = { textPass: null, textItems: [], imagePass: null, imageItems: [], grade: null, tagList: [], confidence: null };
  let usage = {};
  let aiError = null;
  try {
    const messages = buildAuditMessages(role);
    const res = await callVision(messages, { model: VISION_MODEL, max_tokens: 1200 });
    usage = res.usage || {};
    aiError = res.error;
    if (!res.error) ai = parseAiResult(res.content);
  } catch (e) {
    aiError = e;
  }

  // 整体结论 = 两路均过审；任一未判定(解析失败)则整体置空，交人工
  const overallPass = (ai.textPass == null || ai.imagePass == null) ? null : (ai.textPass === true && ai.imagePass === true);
  // 结构化条目 → 信笺 refuse_detail + 纯文本 reason（日志/通知/兜底）
  const { detail, reasonText, txt, img } = buildAuditDetail(ai);

  // 3) 写日志（null 字段不落库，规避 schema 类型校验）
  const logDoc = dropNull({
    role_id: role._id,
    creator_id: role.creator_id || '',
    submit_count: role.styles || 0,
    input_snapshot: snapshot(role),
    wx_text_suggest: wxTextSuggest || '',
    wx_img_suggest: '', // v1 暂不接图片硬过滤（待修 check.imgSecCheck）
    text_pass: ai.textPass,         // 文本设定是否过审
    text_reason: txt,               // 文本问题（条目拼成的纯文本）
    image_pass: ai.imagePass,       // 图片是否过审
    image_reason: img,              // 图片问题（条目拼成的纯文本）
    ai_pass: overallPass,           // 整体（两路均过）
    ai_not_reason: reasonText,      // 合并原因（设定+图片），供回填驳回理由
    ai_grade: ai.grade,
    ai_tag_list: Array.isArray(ai.tagList) ? ai.tagList : [],
    ai_confidence: ai.confidence,
    ai_model: VISION_MODEL,
    ai_error: aiError ? String((aiError && aiError.message) || aiError) : '',
    human_decision: '', // 人工最终结论（admin 审完回写：pass/reject/manual），用于比对一致率
    prompt_tokens: usage.prompt_tokens || 0,         // 输入 token（含文本+图片）
    completion_tokens: usage.completion_tokens || 0, // 输出 token
    cost_tokens: usage.total_tokens || 0,            // 总 token（= 输入+输出）
    cost: Number((((usage.prompt_tokens || 0) * PRICE_IN + (usage.completion_tokens || 0) * PRICE_OUT) / 1e6).toFixed(6)), // 本次成本(元)，按上方档价估算
    latency_ms: Date.now() - started,
    create_time: Date.now(),
  });

  // _detail 不落日志表（避免改 schema），仅随返回值给自动驳回写 roles_my.refuse_detail
  if (!write) return { ...logDoc, _detail: detail }; // dryRun：不写库，直接返回结果（评测用）
  const { id } = await AuditLogDb.add(logDoc);
  return { ...logDoc, _id: id, _detail: detail };
}

/** 微信 textSecCheck 快闸：用 creator_id 查 openid → 调 check 云对象。取不到 openid 返回空串。 */
async function wxTextPreCheck(role) {
  if (!role.creator_id) return '';
  const { data } = await UsersDb.doc(role.creator_id).get().catch(() => ({ data: [] }));
  const openid = data && data[0] && data[0].openid;
  if (!openid) return '';
  const content = [role.name, role.desc, role.prompt, ...(role.tag_list || []), (role.guide_list || [])[0]]
    .filter(Boolean)
    .join('。');
  if (!content) return '';
  const checkObj = uniCloud.importObject('check');
  const r = await checkObj.checkText({ content, openid });
  return (r && r.data && r.data.suggest) || '';
}

/** 角色字段快照（留档，便于复盘 AI 当时看到的内容） */
function snapshot(role) {
  return {
    category_id: role.category_id || '',
    name: role.name || '',
    gender: role.gender,
    desc: role.desc || '',
    prompt: role.prompt || '',
    tag_list: role.tag_list || [],
    guide_list: role.guide_list || [],
    avatar: role.avatar || '',
    avatar_long: role.avatar_long || '',
  };
}

/** 健壮解析模型返回的 JSON（容忍 markdown 围栏/前后多余文字）；文本/图片分离判定 + 结构化条目 */
function parseAiResult(text) {
  const out = { textPass: null, textItems: [], imagePass: null, imageItems: [], grade: null, tagList: [], confidence: null };
  if (!text) return out;
  let s = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  const toBool = (v) => typeof v === 'boolean' ? v : (v === 'true' ? true : (v === 'false' ? false : null));
  const normItems = (arr) => Array.isArray(arr)
    ? arr.filter(x => x && (x.field || x.reason)).map(x => ({ field: String(x.field || '').trim(), reason: String(x.reason || '').trim(), keyword: String(x.keyword || '').trim() }))
    : [];
  try {
    const j = JSON.parse(s);
    out.textPass = toBool(j.textPass);
    out.textItems = normItems(j.textItems);
    out.imagePass = toBool(j.imagePass);
    out.imageItems = normItems(j.imageItems).map(euphemizeImageItem); // 图片理由兜底委婉化
    out.grade = (j.grade === '' || j.grade == null) ? null : Math.round(Number(j.grade));
    out.tagList = Array.isArray(j.tagList) ? j.tagList : [];
    out.confidence = (j.confidence == null || j.confidence === '') ? null : Number(j.confidence);
  } catch (e) {
    // 解析失败：保持 pass=null（人工据 ai_error/低置信处理），把原文片段写进条目便于排查
    out.textItems = [{ field: '内容', reason: '【AI 返回解析失败】' + s.slice(0, 160), keyword: '' }];
  }
  return out;
}

/**
 * 图片驳回理由【兜底委婉化】：给用户看的文字不出现具体身体部位/露骨词。
 * 命中露骨词 → 整条替换为温和表达（判定仍按严格标准，仅文案含蓄）。
 */
const IMG_EXPLICIT_RE = /乳沟|事业线|乳房|侧乳|下乳|屁股|臀部|臀|大腿根|裸露|露点|私处|隐私部位|胸部|露胸/;
function euphemizeImageItem(it) {
  if (IMG_EXPLICIT_RE.test(it.reason || '') || IMG_EXPLICIT_RE.test(it.keyword || '')) {
    return { field: it.field || '形象图', reason: '穿着或姿态偏暴露，建议更换为更得体的图片。', keyword: '偏暴露' };
  }
  return it;
}

/**
 * 把结构化条目组装成：①信笺用 refuse_detail（分组）②纯文本 reason（日志/通知/兜底展示）
 * @returns {{detail: object|null, reasonText: string, txt: string, img: string}}
 */
function buildAuditDetail(ai) {
  const groups = [];
  if (ai.textItems && ai.textItems.length) groups.push({ kind: 'text', name: '角色内容', items: ai.textItems });
  if (ai.imageItems && ai.imageItems.length) groups.push({ kind: 'image', name: '角色图片', items: ai.imageItems });
  const join = (items) => (items || []).map(i => i.field ? `${i.field}：${i.reason}` : i.reason).filter(Boolean).join('；');
  const txt = join(ai.textItems);
  const img = join(ai.imageItems);
  const reasonText = [txt && ('【设定】' + txt), img && ('【图片】' + img)].filter(Boolean).join('\n');
  return { detail: groups.length ? { groups } : null, reasonText, txt, img };
}

/** 删除值为 null/undefined 的键（避免 schema 对 int/bool/double 的 null 校验失败） */
function dropNull(obj) {
  const r = {};
  Object.keys(obj).forEach((k) => { if (obj[k] !== null && obj[k] !== undefined) r[k] = obj[k]; });
  return r;
}
