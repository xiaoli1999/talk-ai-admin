/**
 * @file 捏崽分类 id ↔ 名称映射
 * @description 取自 pages/create/role/role.vue 的 menuList（共 5 类）。
 *   攻略文档曾写"4 种"实列 5 个，以此为准。审核时把 category_id 翻成名称喂模型，
 *   模型判分类是否匹配；P2 自动通过若需写回分类，用 categoryId(name) 反查。
 */

const CATEGORIES = [
  { id: '6634e1558620667bb4fe5fc0', name: '虚拟想象' },
  { id: '663c306f0d2b315faf92d78a', name: '动漫人物' },
  { id: '663c30b40d2b315faf92e382', name: '游戏角色' },
  { id: '663c3133c3b5c96502b4019d', name: '小说角色' },
  { id: '663c30f5213929f866b41dcb', name: '历史人物' },
];

const ID2NAME = {};
const NAME2ID = {};
CATEGORIES.forEach((c) => { ID2NAME[c.id] = c.name; NAME2ID[c.name] = c.id; });

/** category_id → 名称（找不到返回空串） */
const categoryName = (id) => ID2NAME[id] || '';
/** 名称 → category_id（找不到返回空串） */
const categoryId = (name) => NAME2ID[name] || '';

module.exports = { CATEGORIES, categoryName, categoryId };
