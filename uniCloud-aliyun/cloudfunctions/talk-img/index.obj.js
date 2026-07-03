/**
 * 云对象 talk-img · AI 出图（资产化）
 * 职责：模型路由（火山即梦免费额度→降级→GPT image2 兜底[后置]）+ 转存 OSS + 全量落库资产 + 采贝计费。
 * 隔离：新逻辑独立云对象，不动 talk/talk-text；只新增自己的表 users_ai_imgs / ai_img_quota。
 * 计费：写 users.cb_num/cb_pay_num（沿用既有出图扣费行为，非新增跨表写）。
 * 见 md/AI出图/AI出图资产化方案.md。
 */

const { IMG_PRICE, IMG_PRICE_NORMAL, IMG_PRICE_PROMO, PROMO_ON, PROMO_LABEL, PROMO_PERIOD, PROMO_END, SIMULATE_FAIL_RATE, ARK_API_KEY, ARK_CHAT_URL, IMG_PROMPT_PERF_MODEL, STYLE_MODEL } = require('./config.js')
const { buildPrompt } = require('./utils/styles.js')
const { arkText2img, transferToOss } = require('./utils/jimeng.js')
const { pickTiers, incUsed } = require('./utils/quota.js')
const { imgList } = require('./utils/img.js')
const imgPresets = require('./utils/img-presets.js')

/* 风格卡+预设是静态数据(仅随部署变)，算一个内容版本号(djb2哈希,冷启动算一次)。
   getImgPrice 搭车下发 styleVer，前端缓存的版本一致就跳过 ~115KB 的 getAiImgStyleList 重复请求。 */
const STYLE_DATA_VER = (() => {
	const s = JSON.stringify(imgList) + JSON.stringify(imgPresets)
	let h = 5381
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
	return h.toString(36)
})()

const db = uniCloud.database()

/* 上游/内部错误 → 用户可见安全文案；原始错误（含火山 Request ID）只进云端日志，用追踪码定位（同 talk-text 护栏） */
function safeErrMsg (error, where) {
	const raw = (error && (error.message || error.errMsg)) || String(error || '')
	const trace = 'I' + Date.now().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 36).toString(36).toUpperCase()
	console.error(`[talk-img][${where}][${trace}] 上游错误（已对用户隐藏）:`, raw)
	return `生成失败，请重新生成（${trace}）`
}

function genBatchId () {
	return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/**
 * @function orderTiersForStyle 按风格首选模型给「仍有免费额度的档位」排序
 *   规则（用户 2026-06-18 定）：首选档(STYLE_MODEL[styleId])仍有额度→排第一优先用；
 *   其余档随机排在后面（首选被降级/无额度时的随机兜底）。首选档没额度时即纯随机。
 * @param { Array } tiers pickTiers() 结果（已过滤掉额度用尽的档）
 * @param { String } styleId
 * @returns { Array } 排序后的档位
 */
function orderTiersForStyle (tiers, styleId) {
	const arr = tiers.slice()
	for (let i = arr.length - 1; i > 0; i--) { // Fisher-Yates 洗牌 → 兜底随机
		const j = Math.floor(Math.random() * (i + 1))
		;[arr[i], arr[j]] = [arr[j], arr[i]]
	}
	const pref = STYLE_MODEL && STYLE_MODEL[styleId]
	const idx = pref ? arr.findIndex((t) => t.tier === pref) : -1
	if (idx > 0) { const [p] = arr.splice(idx, 1); arr.unshift(p) } // 首选档(若仍有额度)提到最前
	return arr
}

/**
 * @function DeductUserCbCount 扣除用户采贝（先扣免费 cb_num，再扣付费 cb_pay_num）
 *   与 talk/index.obj.js 同逻辑，保持计费行为一致。
 * @param { String } id 用户id
 * @param { Number } useCbNum 扣减采贝数
 * @returns { Object } { data, errMsg }
 */
async function DeductUserCbCount (id, useCbNum) {
	useCbNum = Number(useCbNum)

	/* 先扣免费 cb_num，再扣付费 cb_pay_num；不足扣到 0（前端已 enough(N) 预校验，正常不会到此分支） */
	function calc (cb_num, cb_pay_num) {
		cb_num = Number(cb_num || 0); cb_pay_num = Number(cb_pay_num || 0)
		const params = { cb_num, cb_pay_num }
		if ((cb_num + cb_pay_num) > useCbNum) {
			if (cb_num >= useCbNum) params.cb_num = parseInt((cb_num - useCbNum) * 100) / 100
			else { params.cb_pay_num = parseInt((cb_pay_num - (useCbNum - cb_num)) * 100) / 100; params.cb_num = 0 }
		} else { params.cb_num = 0; params.cb_pay_num = 0 }
		return params
	}

	/* 优先事务（原子，防并发出多张时丢失更新漏扣）。⚠️ 整段在 try 内：空间不支持事务 / 事务任何环节抛错，
	   都【不能】把异常抛到 generateImage，否则会让"已出好的图"返回失败、用户看不到图。
	   ⚠️ 关键：一次批量(最多4张)并发扣【同一用户】时，aliyun 同文档并发事务会写冲突。直接回退普通读改写会
	   丢失更新→少扣，故这里【写冲突先重试事务】(重试会读到上一笔已提交的余额、正确串行扣)，重试都失败才回退。 */
	for (let attempt = 0; attempt < 3; attempt++) {
		let transaction = null
		try {
			transaction = await db.startTransaction()
			const { data } = await transaction.collection('users').doc(id).get()
			const u = (Array.isArray(data) ? data[0] : data) || {}
			const params = calc(u.cb_num, u.cb_pay_num)
			await transaction.collection('users').doc(id).update(params)
			await transaction.commit()
			return { data: params, errMsg: '采贝扣减成功' }
		} catch (e) {
			if (transaction) { try { await transaction.rollback() } catch (_) {} }
			if (attempt === 2) console.warn('[talk-img] 事务扣费多次失败，回退普通扣费:', e && (e.message || e))
		}
	}

	/* 回退：普通读改写（与上线前一致，保证出图与扣费始终可用） */
	try {
		const { data: userList } = await db.collection('users').doc(id).get()
		const u = (userList && userList[0]) || {}
		const params = calc(u.cb_num, u.cb_pay_num)
		const { doc } = await db.collection('users').doc(id).updateAndReturn(params)
		return { data: doc, errMsg: '采贝扣减成功' }
	} catch (e) {
		return { errMsg: (e && e.message) || '扣减失败' }
	}
}

module.exports = {
	_before: function () {},

	/**
	 * @function _timing 定时器（package.json 每日 04:00 触发）：删除 3 天前未收藏的出图记录。
	 *   收藏(is_favorite=true)的永久保留；未收藏的只留 3 天。仅动本对象自有表 users_ai_imgs。
	 */
	_timing: async function () {
		try {
			const cutoff = Date.now() - 3 * 24 * 3600 * 1000
			const res = await db.collection('users_ai_imgs')
				.where({ is_favorite: false, create_time: db.command.lt(cutoff) })
				.remove()
			console.log('[talk-img][_timing] 清理3天前未收藏记录', JSON.stringify(res))

			// 顺手清理 7 天前的「额度日」计数行（每天每档一行，避免无限增长；当前/近几日的保留）
			const cutoffPeriod = new Date(Date.now() - 3 * 3600 * 1000 - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
			await db.collection('ai_img_quota').where({ period: db.command.lt(cutoffPeriod) }).remove().catch(() => {})
			return res
		} catch (e) {
			console.error('[talk-img][_timing] 清理异常', e && e.message)
		}
	},

	/** 当前出图单价（前端展示用） */
	getImgPrice () {
		// price=实际扣减(限时价或常规价)；normal=常规价；promo=是否在搞限时活动(限时价<常规价才 true，相等/缺省 → 前端只显常规价)
		// styleVer=风格/预设内容版本号，前端据此决定是否要重新拉 getAiImgStyleList（搭车不额外加请求）
		return { data: { price: IMG_PRICE, normal: IMG_PRICE_NORMAL, promo: PROMO_ON, promoLabel: PROMO_LABEL, promoPeriod: PROMO_PERIOD, promoEnd: PROMO_END, styleVer: STYLE_DATA_VER } }
	},

	/**
	 * @function getAiImgStyleList 获取 AI 出图风格列表（每张风格卡附带它的预设池）
	 * @returns { Object } { data: [{ id, name, en, badge, url, top, presets }], errMsg }
	 */
	async getAiImgStyleList () {
		try {
			const data = imgList.map(c => ({ ...c, presets: imgPresets[c.id] || [] }))
			return { data, ver: STYLE_DATA_VER, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function getAiImgTextPerf 文生图提示词优化（用户随手写一句 → 扩成画面短语）
	 * @param { Object } params { prompt, roleContext? } 提示词 + 可选角色资料
	 * @returns { Object } { data: '优化后的提示词', errMsg }
	 */
	async getAiImgTextPerf ({ prompt, roleContext } = {}) {
		try {
			/* 角色资料(设定/简介/标签)可选，用来补全人物气质身份，但不照搬大段文字 */
			const ctxLines = []
			if (roleContext) {
				if (roleContext.setting) ctxLines.push(`设定：${String(roleContext.setting).slice(0, 300)}`)
				if (roleContext.desc) ctxLines.push(`简介：${String(roleContext.desc).slice(0, 300)}`)
				const tags = [].concat(roleContext.tags || []).filter(Boolean)
				if (tags.length) ctxLines.push(`标签：${tags.join('、')}`)
			}
			const ctxBlock = ctxLines.length ? `\n【角色资料】（可参考其气质/身份/外形线索来补全画面，不要照搬大段文字）：\n${ctxLines.join('\n')}\n` : ''

			const content = `你是文生图提示词优化助手。请基于【用户输入】优化出一段简洁、生动的"角色画面描述"，供文生图模型生成。

【用户输入】（最高优先，必须尊重其意图）：
${prompt || ''}
${ctxBlock}
优化要求：
1. 以用户输入为主；若有角色资料，结合它补全合理的外貌/气质/身份/服装/场景，让画面更具体可画。
2. 用简洁的短词短语（逗号分隔），避免长句和堆砌——给模型留发散空间，别把画面写死。
3. 只写主体相关（身份/外貌/发型发色/表情神态/服装/姿态/场景氛围），不要写画风，也不要写画质或镜头术语。
4. 用户写了什么就尊重什么；用户没指定的（如性别、构图、视角）不要强行添加或限制。
5. 健康得体：若输入含低俗、色情或性暗示，优化成有氛围、有魅力但不低俗不色情的表达（保留那种感觉、去掉露骨低俗）。

直接输出优化后的提示词（一段简洁短语，不要解释、不要加标题或引号）。`

			const { model, max_tokens, temperature, top_p } = IMG_PROMPT_PERF_MODEL
			const requestBody = { model, max_tokens, temperature, top_p, messages: [{ role: 'system', content }] }

			const params = {
				url: ARK_CHAT_URL,
				method: 'POST',
				header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ARK_API_KEY}` },
				data: requestBody
			}

			const { data: { choices } } = await uniCloud.request(params)
			const data = choices && choices.length ? choices[0].message.content : ''
			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	},

	/**
	 * @function generateImage 文生图（火山即梦，单张）→ 转存 → 落库 → 扣采贝
	 * @param { Object } params { userId, styleId, prompt, source? }
	 * @returns { Object } { data: { url, userData, price }, errMsg }
	 */
	async generateImage ({ userId, styleId, prompt, source = 'create-role', sourceImage } = {}) {
		try {
			if (!userId) return { errMsg: '账号登录异常，请退出重新登录' }
			if (!prompt || prompt.trim().length < 2) return { errMsg: '形象描述不能为空' }

			/* 余额校验（服务端兜底，前端已先校验） */
			const { data: uList } = await db.collection('users').doc(userId).get()
			if (!uList || !uList.length) return { errMsg: '账号异常，请重新登录' }
			const balance = Number(uList[0].cb_num || 0) + Number(uList[0].cb_pay_num || 0)
			if (balance < IMG_PRICE) return { errMsg: '采贝不足', code: 'NO_CB' }

			/* 测试钩子：按概率模拟出图失败。在扣费/调模型【之前】返回 → 不扣采贝、不耗额度，纯测前端失败→重试。
			   SIMULATE_FAIL_RATE 在 config.js，【上线前必须改回 0】 */
			if (SIMULATE_FAIL_RATE > 0 && Math.random() < SIMULATE_FAIL_RATE) {
				return { errMsg: '生成失败，请点击重试（测试模拟）', code: 'SIM_FAIL' }
			}

			// i2i 微调走宽松后缀（景别/构图交给微调指令）；初次出图走强主体后缀（角色近景全身占八成）
			const fullPrompt = buildPrompt(styleId, prompt, { i2i: !!sourceImage })

			/* i2i 微调：传了源图则解析成 https 公网地址传给火山做图生图 */
			let refImage = ''
			if (sourceImage) {
				refImage = sourceImage
				if (/^cloud:\/\//.test(sourceImage)) {
					try {
						const { fileList } = await uniCloud.getTempFileURL({ fileList: [sourceImage] })
						refImage = (fileList && fileList[0] && fileList[0].tempFileURL) || sourceImage
					} catch (e) { /* 解析失败则原样尝试 */ }
				}
			}

			/* 路由：按「风格首选模型」排序仍有额度的档位（首选优先、其余随机兜底），逐档尝试，成功即停；某档失败（额度尽/拦截）降级下一档 */
			const tiers = orderTiersForStyle(await pickTiers(), styleId)
			if (!tiers.length) {
				// 火山三档免费额度全部用完 → GPT image2 兜底（后置，未接）
				return { errMsg: '出图额度紧张，稍后再试', code: 'QUOTA_EXHAUSTED' }
			}

			let fileID = ''
			let usedTier = null
			let lastErr = null

			for (const tier of tiers) {
				const { url, error } = await arkText2img({ model: tier.model, prompt: fullPrompt, size: tier.size, image: refImage || undefined })
				if (!url) { lastErr = error; continue }

				const oss = await transferToOss(url)
				if (!oss) { lastErr = { message: '转存失败' }; continue }

				fileID = oss
				usedTier = tier
				break
			}

			if (!fileID || !usedTier) {
				return { errMsg: safeErrMsg(lastErr, 'generateImage') }
			}

			/* 配额 +1（不阻断主流程） */
			await incUsed(usedTier)

			/* 落库资产（每张都存，is_favorite 默认 false） */
			const batchId = genBatchId()
			let imgId = ''
			try {
				const { id } = await db.collection('users_ai_imgs').add({
					user_id: userId,
					url: fileID,
					prompt: fullPrompt,
					user_prompt: (prompt || '').trim(), // 用户原始输入(预设/手写)，与完整 prompt 分开存，便于分析
					provider: 'volcano-jimeng',
					model: usedTier.tier,
					cost: 0, // 免费额度内成本 0
					cb_cost: IMG_PRICE,
					source,
					style_id: styleId || '',
					batch_id: batchId,
					is_favorite: false,
					status: 'private',
					audit_state: 0,
					create_time: Date.now() // 相册按创建时间倒序；schema 的 forceDefaultValue 仅 JQL 生效，云端 SDK 落库需显式写
				})
				imgId = id
			} catch (e) {
				console.error('[talk-img] 落库失败（不阻断出图）:', e && (e.message || e))
			}

			/* 扣采贝，返回用户实时余额 */
			const { data: userDoc } = await DeductUserCbCount(userId, IMG_PRICE)
			const userData = userDoc ? { cb_num: userDoc.cb_num, cb_pay_num: userDoc.cb_pay_num } : null

			return { data: { url: fileID, imgId, userData, price: IMG_PRICE }, errMsg: '获取成功' }
		} catch (e) {
			return { errMsg: safeErrMsg(e, 'generateImage') }
		}
	},

	/**
	 * @function getMyImgs 我的出图资产分页（创作中心相册 / 从收藏选）
	 * @param { Object } params { userId, page?, pageSize?, favoriteOnly? }
	 */
	async getMyImgs ({ userId, page = 1, pageSize = 20, favoriteOnly = false } = {}) {
		try {
			if (!userId) return { errMsg: '账号异常', data: [] }
			const where = { user_id: userId }
			if (favoriteOnly) where.is_favorite = true

			/* 画廊(收藏)按【收藏时间】倒序——最近收藏在前(favorite_time 缺省的老收藏用 create_time 兜底)；
			   记录(全部)按【生成时间】倒序——最近生成在前 */
			let coll = db.collection('users_ai_imgs').where(where)
			coll = favoriteOnly
				? coll.orderBy('favorite_time', 'desc').orderBy('create_time', 'desc')
				: coll.orderBy('create_time', 'desc')

			const { data } = await coll
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get()

			return { data: data || [], errMsg: '获取成功' }
		} catch ({ message }) {
			return { errMsg: message, data: [] }
		}
	},

	/**
	 * @function toggleFavorite 收藏 / 取消收藏（校验归属）
	 * @param { Object } params { userId, imgId, favorite }
	 */
	async toggleFavorite ({ userId, imgId, favorite } = {}) {
		try {
			if (!userId || !imgId) return { errMsg: '参数缺失' }
			// favorite_time：收藏时记当前时间(画廊按它倒序，最近收藏在前)；取消收藏置 0
			const { updated } = await db.collection('users_ai_imgs')
				.where({ _id: imgId, user_id: userId })
				.update({ is_favorite: !!favorite, favorite_time: favorite ? Date.now() : 0 })
			if (!updated) return { errMsg: '操作失败' }
			return { data: { imgId, favorite: !!favorite }, errMsg: '操作成功' }
		} catch ({ message }) {
			return { errMsg: message }
		}
	}
}
