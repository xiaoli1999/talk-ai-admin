'use strict';
/**
 * 灵感回复 JSON 容错护栏（必做）。源：生产落地手册 v13 §5（逐字移植）。
 * mini ~2% 会把中文标点漏进 JSON 骨架（最典型：键的闭引号+冒号被压成一个中文冒号）→ JSON.parse 崩。
 * 本解析器只修"结构位"的中文标点，不动 text 内容里的中文标点；失败由调用方重试 1 次。
 */
function stripFence(s) {
  const m = String(s == null ? '' : s).match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  return (m ? m[1] : String(s == null ? '' : s)).trim();
}
function tryArr(str) { try { const d = JSON.parse(str); return Array.isArray(d) ? d : null; } catch (e) { return null; } }

function parseIdeaCandidates(raw) {
  const s0 = stripFence(raw);
  // 1) 原样直接 parse（~98% 命中）
  let d = tryArr(s0);
  if (d) return { ok: true, data: d, repaired: false };
  // 2) 只修 JSON 结构位的中文标点（不动 text 内容），再 parse
  const fixed = s0
    .replace(/"(tone|preview|text)："/g, '"$1":"')                                  // "text："你 → "text":"你
    .replace(/"(tone|preview|text)"\s*：/g, '"$1":')                                // "text"： → "text":
    .replace(/("(?:tone|preview|text)":)\s*“([\s\S]*?)”(\s*[,}\]])/g, '$1"$2"$3')   // 值用中文引号 “…” → ASCII
    .replace(/,\s*(?=[}\]])/g, '');                                                 // 尾逗号
  d = tryArr(fixed);
  if (d) return { ok: true, data: d, repaired: true };
  // 3) 仍失败 → 交调用方：重试 1 次 / 兜底
  return { ok: false, data: null };
}

module.exports = { parseIdeaCandidates };
