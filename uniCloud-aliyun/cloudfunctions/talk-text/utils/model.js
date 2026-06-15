/**
 * @file talk-text 模型配置
 * @description 5 档付费文本模型（doubao-seed-2.0 系列）+ 灵感档。
 *   - modelList：前端用 UI 元数据（名称/描述/标签/价格/记忆/锁）
 *   - modelConfig：服务端用（档位 tier / 端点 model / 采样参数）
 *
 * ⚠️ 端点说明（本期决策：复用现有 Key，端点由你创建）：
 *   下面 3 个端点【临时】指向现有可用 ep，用于把管线先跑通；
 *   待你在火山方舟控制台为 doubao-seed-2.0-mini/lite/pro 创建生产推理接入点后，替换 EP 三个值即可。
 */

/* —— 火山方舟推理接入点（ep-xxx）——
 * 生产决策：5 档 + 灵感共【6 个独立接入点】，额度/限流/计费按档隔离、互不挤兑。
 * 各档对应模型：t1→seed-2.0-mini(260428)｜t2/t3→seed-2.0-lite(260428)｜t4/t5→seed-2.0-pro(260215)｜idea→seed-2.0-mini(260428)
 * ⚠️ 以下暂指向评测期调通的 3 个测试 ep（mini/lite/pro 复用占位）；
 *   生产接入点在火山方舟控制台创建后，按行逐项替换 6 个值即可（仅此一处，其余代码无需动）。 */
const EP = {
  t1:   'ep-20260612152042-n8ps2', // T1 日常 ← 暂用测试 mini ep
  t2:   'ep-20260612155308-l4vp4', // T2 恋爱 ← 暂用测试 lite ep
  t3:   'ep-20260612152148-cstmz', // T3 梦女 ← 暂用测试 lite ep（生产需独立）
  t4:   'ep-20260612152209-6s9t9', // T4 剧情 ← 暂用测试 pro ep
  t5:   'ep-20260612152244-j5hnc', // T5 梦境 ← 暂用测试 pro ep（生产需独立）
  idea: 'ep-20260612151956-z25zl', // 灵感回复 ← 暂用测试 mini ep（生产需独立）
};

/**
 * 服务端模型配置：id → { tier, model(端点), max_tokens, temperature, top_p, thinking, continuePrompt }
 * max_tokens 是输出上限（落地手册 §2.1）：T1=300 T2=450 T3=700 T4=1100 T5=1500 idea=700
 * 采样参数与思考开关【按档独立可调】（初值=原全档统一 0.95/0.92/关思考；调优直接改对应档位行）
 * continuePrompt：「继续说」补到末尾的 user 引导——历史以 assistant 结尾时豆包无用户回合可接、会间歇返空
 *   （前端显示"消息走丢了"，见 index.obj.js toMessages）；按档定制续写口吻，直接改对应档位行即可调。
 *   ⚠️ 只引导"接着说什么"，别写"补细节/更沉浸/写长"这类扩写指令——篇幅由各档系统提示词的字数约定独立管
 *   （T1 60-120｜T2 160-200｜T3 240-320｜T4 360-440｜T5 400-700），补尾文案须保持篇幅中性，否则继续说越写越长。
 *
 * thinking 思考开关可选值（doubao-seed 系列；index.obj.js 实际传 thinking:{type:此值}）：
 *   - 'disabled'：关闭思考，直接生成——最快最省，陪伴场景默认（当前全档）
 *   - 'enabled' ：强制思考，回复前先内部推理——长剧情的逻辑连贯/伏笔回收预期更好，
 *                 但首字延迟约 +2~8s（流式下 TTFT 同样变慢，T1/T2 同步会明显变卡）
 *   - 'auto'    ：模型自行判断是否思考——延迟与费用不可预期，线上慎用，适合评测对比
 *   ⚠️ 计费红线：思考链 token 会计入 usage.total_tokens → 用户采贝扣费跟着涨，
 *     而思考内容用户看不到（等于白扣）。若试完决定某档开思考，需同步评估该档 price 倍率是否还合理。
 */
const modelConfig = {
  t1: { tier: '1', model: EP.t1, max_tokens: 300,  temperature: 0.96, top_p: 0.95, thinking: 'disabled',
        continuePrompt: '顺着刚才的话题自然往下聊，像真人聊天一样自然随意，别硬转话题。' },
  t2: { tier: '2', model: EP.t2, max_tokens: 450,  temperature: 0.96, top_p: 0.94, thinking: 'disabled',
        continuePrompt: '顺着刚才的暧昧氛围自然接话或回应，让心动再进一步，篇幅照常就好。' },
  t3: { tier: '3', model: EP.t3, max_tokens: 700,  temperature: 0.96, top_p: 0.94, thinking: 'disabled',
        continuePrompt: '顺着刚才的话继续，多给我一点只对我的偏爱与在意，自然往下接，保持本档一贯的篇幅与节奏。' },
  t4: { tier: '4', model: EP.t4, max_tokens: 1100, temperature: 0.96, top_p: 0.94, thinking: 'disabled',
        continuePrompt: '顺着刚才的剧情自然往下推进一点，保持本档一贯的篇幅与节奏，别铺陈也别收尾。' },
  t5: { tier: '5', model: EP.t5, max_tokens: 1500, temperature: 0.95, top_p: 0.92, thinking: 'disabled',
        continuePrompt: '顺着刚才的剧情自然往下推进，维持原有的沉浸感即可，篇幅照常、别越写越长。' },
};

/* 灵感档（mini，1 采贝/次）· 采样按手册 v13：temp0.9/top_p0.9/max700（≠5档的0.95/0.92），关思考 */
const ideaModel = { model: EP.idea, max_tokens: 700, temperature: 0.9, top_p: 0.9, thinking: 'disabled' };

/**
 * 前端模型列表（UI 元数据）
 * 字段沿用现有 modelList 约定，新增 en/tagline/soul/tier/keepRounds：
 *   - price：采贝倍率（采贝 = ceil(total_tokens × price / 1000)）
 *   - memory：上下文高水位字数（撞顶才批量截断；这是真预算）
 *   - cardMemory：用畅聊卡时的高水位字数（刻意小于 memory：卡是平价不限量，压上下文控成本）
 *   - keepRounds：低水位"轮数上限"（撞顶后砍回最近 N 轮；若该 N 轮字数仍超高水位——典型如从高档切回低档——
 *       再按字数从最旧端收口到高水位内、至少留 2 轮，见 talk.vue calcTalkData ②）
 *   - isVip/allowUseCard/allowDefault：产品侧可调（见 md/模型升级.md §2.1 备注）
 *   - stream：该档是否走流式（uni-push SSE）。T1/T2 短回复同步更快且不吃个推写量 → false；
 *       T3-T5 长回复流式首段 ~2.7s vs 同步 10s+ → true。前端按 stream !== false 判断
 *       （旧缓存模型数据无此字段时默认流式，不破现状）
 */
const modelList = [
  {
    id: 't1', tier: '1', name: '日常', en: 'DAILY', tagline: '随时都在的那个 Ta', soul: '真人闲聊感',
    desc: '入门首选，像真人一样随时秒回，陪你聊好每一句日常——有人一直在的踏实。',
    tagList: ['真人感', '秒回', '暖心陪伴'],
    price: 1, memory: 5000, cardMemory: 4000, memoryTalk: 0, cardMemoryTalk: 0, keepRounds: 24,
    cdRange: [0, 2], closeValue: 0, isVip: false, allowDefault: true, allowUseCard: true, waitTime: 0, stream: false,
  },
  {
    id: 't2', tier: '2', name: '恋爱', en: 'ROMANCE', tagline: '和 Ta 暧昧拉扯', soul: '恋爱拉扯',
    desc: '恋爱进阶，Ta 会撩你、也等你撩回来，一来一回都是心动暴击。',
    tagList: ['心动暧昧', '会撩', '小鹿乱撞'],
    price: 1.5, memory: 6000, cardMemory: 5000, memoryTalk: 0, cardMemoryTalk: 0, keepRounds: 18,
    cdRange: [0, 4], closeValue: 0, isVip: false, allowDefault: false, allowUseCard: true, waitTime: 0, stream: false,
  },
  {
    id: 't3', tier: '3', name: '梦女', en: 'DARLING', tagline: 'Ta 唯独对你破例', soul: '被偏爱叙事',
    desc: '专属模型，Ta 的世界只为你破例、记得你的每件小事——你是唯一的例外。',
    tagList: ['独宠唯一', '为你破例', '记得你'],
    price: 2, memory: 8000, cardMemory: 6000, memoryTalk: 0, cardMemoryTalk: 0, keepRounds: 12,
    cdRange: [0, 6], closeValue: 0, isVip: true, allowDefault: false, allowUseCard: true, waitTime: 0, stream: true,
  },
  {
    id: 't4', tier: '4', name: '剧情', en: 'STORY', tagline: 'Ta 带你入戏，走着走着就当真', soul: '剧情感最浓',
    desc: '剧情大片，Ta 带你沉进正在发生的故事，每一幕都勾着你遐想接下来，忍不住想一直聊下去。',
    tagList: ['沉浸剧情', '悬念感', '欲罢不能'],
    price: 3, memory: 12000, cardMemory: 8000, memoryTalk: 0, cardMemoryTalk: 0, keepRounds: 10,
    cdRange: [0, 10], closeValue: 0, isVip: true, allowDefault: false, allowUseCard: true, waitTime: 0, stream: true,
  },
  {
    id: 't5', tier: '5', name: '梦境', en: 'DREAM', tagline: '分不清是梦，还是 Ta 真的来了', soul: '沉浸到沉沦',
    desc: '最强模型，极致沉浸，每一幕都写得淋漓尽致，带你陷进一场分不清真假的梦。',
    tagList: ['极致沉浸', '细腻饱满', '越陷越深'],
    price: 4, memory: 16000, cardMemory: 10000, memoryTalk: 0, cardMemoryTalk: 0, keepRounds: 8,
    cdRange: [0, 20], closeValue: 0, isVip: true, allowDefault: false, allowUseCard: true, waitTime: 0, stream: true,
  },
];

module.exports = { modelList, modelConfig, ideaModel };
