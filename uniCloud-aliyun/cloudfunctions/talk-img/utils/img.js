/**
 * @file img 图片风格卡（封面卡 + 展示元数据）
 * @description 创建采崽「选择风格」封面卡列表，供 talk-img.getAiImgStyleList 返回给前端渲染。
 *   单一配置源：风格的 id / 短名 name / 英文副标 en / 角标 badge('rec'荐|'new'新) / 封面 url / 置顶 top，
 *   全部在这里配（前端只缓存、不硬编码）。风格 → 画风基调词见 talk-img/utils/styles.js（id 一一对应），
 *   点击填入的预设见 talk-img/utils/img-presets.js（键=id）。
 *   ⚠️ url 为【临时占位】(旧 LibLib 封面)，画风与火山出图不一致；联调通过后改为火山按各卡画风词生成的干净封面。
 * @copyright 采黎
 */

const COVER = 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles' // 临时封面底库（旧LibLib图）

const imgList = [
	/* 经典动漫(日系乙女立绘)。⚠️ url 暂借现有占位封面，待生成专属封面替换 */
	{ id: 'jd-dm',      name: '经典动漫', en: 'JD ANIME',  badge: 'rec', url: `${COVER}/liblib/dm.png` },

	/* 推荐档（置顶+高亮，cg-houtu 为默认选中） */
	{ id: 'cg-houtu',   name: '日系厚涂', en: 'JP PAINT', badge: 'rec', url: `${COVER}/liblib/dsyq.png`, top: true },
	{ id: 'nan-houtu',  name: '梦幻厚涂', en: 'DREAM',    badge: 'rec', url: `${COVER}/liblib/gfnz.png` },

	/* 其它人像 */
	{ id: 'gf-xianxia', name: '古风仙侠', en: 'XIANXIA',  badge: 'rec', url: `${COVER}/liblib/gfmh.png`, top: true },
	{ id: 'gf-xieshi',  name: '国风仙气', en: 'GUOFENG', badge: 'new', url: `${COVER}/liblib/qcnz.png` },

	{ id: 'weimei-dm',  name: '唯美动漫', en: 'WM ANIME',  badge: 'new',  url: `${COVER}/liblib/dm.png` },
	{ id: 'retro-mh',   name: '复古漫画', en: 'RETRO', badge: 'new',   url: `${COVER}/liblib/ecy.png` },
	{ id: 'game-cg',    name: '游戏CG',   en: 'GAME CG',  badge: 'new', url: `${COVER}/c-sbpk.png` }, // ⚠️封面暂借占位，待阶段4替换


	/* 特色题材 */
	{ id: 'jijia',      name: '机甲风',   en: 'MECHA', badge: 'new',   url: `${COVER}/c-jjwl.png` },
	{ id: 'cyber',      name: '赛博朋克', en: 'CYBER', badge: 'new',  url: `${COVER}/c-sbpk.png` },

	{ id: 'mengchong',  name: '萌宠',     en: 'PET',  badge: 'new',    url: `${COVER}/c-mc.png` },

	/* 场景(纯背景·剧情用)。⚠️ url 暂借现有占位封面，待生成专属封面替换 */
	{ id: 'scene',      name: '场景',     en: 'SCENE', badge: 'new',   url: `${COVER}/liblib/qcnz.png` }
]

module.exports = {
	imgList
}
