/**
 * @file config 火山方舟（OpenAI 兼容图像端点）密钥/档位/计费
 * @description AI 出图配置。火山即梦免费额度优先 → 用完 → GPT image2 兜底（后置未接）。
 * @copyright 采黎
 *
 * ⚠️ 接入说明：
 *   ① model 字段传【接入点 ID ep-xxx】而非通用 model id —— 三个接入点是「协作奖励计划」专属免费额度
 *      （名字带 -150/-300），传 ep-id 才消耗免费额度；传通用 model id 会走按量付费、不吃免费额度。
 *      接入点清单见文件末尾参考。
 *   ② ARK_API_KEY 为「采黎AI」账号 Key（与 talk-text 同源），三个接入点同属该账号 → 直接可用。
 *   ③ IMAGE_SIZE 若火山拒绝自定义 9:16，改用关键字 '2K'（比例由模型自定）。
 */

// 火山方舟 ARK API Key（复用现有「采黎AI」账号 Key，与 talk-text/config.js 同源）
const ARK_API_KEY = 'a220cb08-0bf6-439a-a38b-67f10641bdb8';

// 图像生成端点（OpenAI 兼容 images/generations，非即梦 visual 签名服务）
const ARK_IMAGE_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

// 文本对话端点（OpenAI 兼容 chat/completions）— 出图提示词润色用
const ARK_CHAT_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 出图提示词润色模型（用户随手写一句 → 扩成画面描述；复用同一 ARK Key）
const IMG_PROMPT_PERF_MODEL = {
	model: 'ep-20250611181537-qnlg2',
	max_tokens: 512,
	temperature: 1,
	top_p: 0.9
};

/**
 * 火山即梦免费额度档位。按数组顺序消耗降级：用完一档自动跳下一档；三档全满 → 交兜底（GPT image2，后置）。
 * - cap：各档一次性免费张数（5.0-lite 150 / 4.5 300 / 4.0 300）。
 * - model：传【接入点 ID ep-xxx】（消耗协作奖励计划免费额度，见文件末尾参考）。
 * - ⚠️ 烧录顺序 = 开放项，当前按"5.0-lite→4.5→4.0"；实测画质后可调整顺序定主画风（画风一致性见 md 方案 §8）。
 */
const VOLCANO_TIERS = [
	// size：各档独立分辨率。实测同参下 4.5/4.0 细节重、单图体积是 5.0-lite 的 2.6~3.5 倍（见 md/AI出图 评测），
	//   故 4.5/4.0 降到 2304x4096（仍 9:16，约 56% 像素）控存储/带宽成本；5.0-lite 本就最轻，保 3040x5504。
	{ tier: '5.0-lite', model: 'ep-20260615232519-psd28', cap: 150, size: '3040x5504' }, // Doubao-Seedream-5.0-lite (260128)
	{ tier: '4.5',      model: 'ep-20260615232414-mk7ph', cap: 300, size: '2304x4096' }, // Doubao-Seedream-4.5 (251128)
	{ tier: '4.0',      model: 'ep-20260615232312-bwx2s', cap: 300, size: '2304x4096' }  // Doubao-Seedream-4.0 (250828)
]

/**
 * 各风格首选出图模型（用户 2026-06-18 对比封面/风格卡后定）。值为 VOLCANO_TIERS 的 tier 名（"5.0"即 5.0-lite）。
 * 路由规则（见 index.obj.js orderTiersForStyle）：首选档**仍有免费额度**就用它；首选档额度用尽或被降级 → 在其余仍有额度的档里**随机**。
 * 未列出的风格 = 无偏好，纯随机。改这里即可调风格↔模型映射，无需动代码。
 */
const STYLE_MODEL = {
	'cg-houtu': '4.5',    // 日系厚涂
	'gf-xianxia': '5.0-lite', // 古风仙侠
	'nan-houtu': '5.0-lite',  // 梦幻厚涂
	'weimei-dm': '4.0',   // 唯美动漫
	'game-cg': '5.0-lite',    // 游戏CG
	'gf-xieshi': '5.0-lite',  // 国风仙气
	'retro-mh': '4.0',    // 复古漫画
	'jijia': '5.0-lite',  // 机甲风
	'cyber': '5.0-lite',  // 赛博朋克
	'mengchong': '4.5',   // 萌宠
	'jd-dm': '4.5',       // 经典动漫
	'scene': '4.5'        // 场景
}

/* ── 出图请求参数（火山即梦 images/generations，取值依官方文档 82379/1541523） ── */

// size：自定义"宽x高"锁定 9:16。火山约束：边长 ∈ [1024,4096]、宽高比 ∈ [1/16,16]、默认 2048x2048。
//   1600x2848 ≈ 9:16 竖版立绘（约 4.6MP，高于 2K，对齐 roles_my.avatar_long）。
//   若某档模型拒收自定义尺寸，改用关键字 '2K'（比例由模型按 prompt 自定，非严格 9:16）。
// const IMAGE_SIZE = '1600x2848'
const IMAGE_SIZE = '3040x5504'

// watermark：是否加火山「AI生成」水印。false=不加（预览/下载水印由我方 OSS process 统一处理）。
const WATERMARK = false

// response_format：'url'（返回临时图地址，我方再转存 OSS）| 'b64_json'
const RESPONSE_FORMAT = 'url'

// 计费（采贝/次，1 次 = 1 张）。两个价格都可配置，改完上传 talk-img 即生效。
const IMG_PRICE_NORMAL = 6      // 常规价格（采贝/张）—— 可配置
const IMG_PRICE_PROMO = 4       // 限时价格（采贝/张）—— 可配置；设为 = 常规价 或 0/null 即「无限时活动」，前端只显示常规价
// 是否处于限时促销：限时价有效且【低于】常规价才算（相等/缺省 → 无促销，只展示常规价）
const PROMO_ON = IMG_PRICE_PROMO != null && IMG_PRICE_PROMO > 0 && IMG_PRICE_PROMO < IMG_PRICE_NORMAL
const IMG_PRICE = PROMO_ON ? IMG_PRICE_PROMO : IMG_PRICE_NORMAL // 实际扣减采贝
// 促销角标文案（前端展示，getImgPrice 下发，仅 PROMO_ON 时显示）—— 均可配置
const PROMO_LABEL = '限时特价'  // 促销主文案
const PROMO_PERIOD = '今日'     // 静态时效文案（PROMO_END=0 或已过期时回退展示）
const PROMO_END = 1782835199000 // 促销截止时间戳(ms)，默认本月底(2026-06-30 23:59:59)；> 当前则前端按 天/时/分 倒计时；0/已过 → 用 PROMO_PERIOD
// 测试用：模拟出图失败概率（0=关闭；调成 0.5 可测「失败→重试」UI）。默认关闭。
const SIMULATE_FAIL_RATE = 0

module.exports = {
	ARK_API_KEY,
	ARK_IMAGE_URL,
	ARK_CHAT_URL,
	IMG_PROMPT_PERF_MODEL,
	VOLCANO_TIERS,
	STYLE_MODEL,
	IMAGE_SIZE,
	WATERMARK,
	RESPONSE_FORMAT,
	IMG_PRICE_NORMAL,
	IMG_PRICE_PROMO,
	PROMO_ON,
	IMG_PRICE,
	PROMO_LABEL,
	PROMO_PERIOD,
	PROMO_END,
	SIMULATE_FAIL_RATE
}

/**
 * ── 火山方舟接入点参考（采黎AI 账号 · 协作奖励计划免费额度 · 火山方舟-模型广场 · 2026-06-15 创建） ──
 *  档位      接入点 ID                  底层模型                    免费张数
 *  5.0-lite  ep-20260615232519-psd28   Doubao-Seedream-5.0-lite    150
 *  4.5       ep-20260615232414-mk7ph   Doubao-Seedream-4.5         300
 *  4.0       ep-20260615232312-bwx2s   Doubao-Seedream-4.0         300
 *  计费：按 Token 付费（免费额度用尽后转按量计费 → 由 utils/quota.js 在 cap 处拦截，避免超额烧钱）。
 */
