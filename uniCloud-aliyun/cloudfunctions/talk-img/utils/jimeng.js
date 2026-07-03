/**
 * @file jimeng 火山即梦（Seedream）图像 adapter
 * @description 封装火山方舟 OpenAI 兼容图像端点 images/generations（Bearer 鉴权，与 talk-text 同源 Key）。
 *   端点/参数已对照火山官方文档 + 第三方示例核验：
 *     POST /api/v3/images/generations
 *     body: { model, prompt, size, response_format:'url', watermark:false, sequential_image_generation:'disabled' }
 *     resp: data[0].url
 *   单图（阶段1 定为一次 1 张），不传 n；多图走 sequential_image_generation='enabled'（后续阶段）。
 * @copyright 采黎
 */

const { ARK_API_KEY, ARK_IMAGE_URL, IMAGE_SIZE, WATERMARK, RESPONSE_FORMAT } = require('../config.js')

/* 北京时间戳串（Date.now ms + 8h，时区无关；用于 OSS 文件名） */
function beijingStamp () {
	const d = new Date(Date.now() + 8 * 3600 * 1000)
	const p = (n) => String(n).padStart(2, '0')
	return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}`
}

/**
 * @function arkText2img 调火山即梦出图（单张）。传 image 则走图生图(i2i)，否则纯文生图。
 * @param { Object } params { model, prompt, size?, image? } —— image 为源图公网 URL
 * @returns { Object } { url: '', error: null } —— url 为火山返回的临时图地址
 */
async function arkText2img ({ model, prompt, size, image } = {}) {
	try {
		const res = await uniCloud.request({
			url: ARK_IMAGE_URL,
			method: 'POST',
			header: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${ARK_API_KEY}`
			},
			data: {
				model,
				prompt,
				...(image ? { image } : {}), // i2i：传源图URL则走图生图
				size: size || IMAGE_SIZE,
				response_format: RESPONSE_FORMAT,
				watermark: WATERMARK, // false=不加火山水印；预览/下载水印由我方 OSS process 统一处理
				sequential_image_generation: 'disabled'
			},
			timeout: 60000
		})

		const d = res && res.data
		/* 火山错误体：{ error: { code, message } }。原文只进日志，不透传前端 */
		if (d && d.error) return { url: '', error: d.error }

		const url = d && d.data && d.data[0] && d.data[0].url
		return { url: url || '', error: url ? null : { message: '上游未返回图片（疑似违规拦截）' } }
	} catch (e) {
		return { url: '', error: e || { message: '请求失败' } }
	}
}

/**
 * @function transferToOss 把临时图转存到云存储（防第三方链接失效 + 合规留存）
 * @param { String } url 第三方临时图地址
 * @returns { String } fileID（失败返回 ''）
 */
async function transferToOss (url) {
	try {
		const res = await uniCloud.request({ url, method: 'GET', responseType: 'arraybuffer' })
		if (!res || !res.data) return ''

		/* 同秒并发可能撞名 → 追加随机后缀保证唯一（cloudPathAsRealPath 撞名会覆盖） */
		const rand = Math.floor(Math.random() * 1e6).toString(36)
		const cloudPath = `/img/create-role/ai/jimeng/${beijingStamp()}-${rand}.png`
		const { fileID } = await uniCloud.uploadFile({ cloudPath, fileContent: res.data, cloudPathAsRealPath: true })
		return fileID || ''
	} catch (e) {
		console.error('[talk-img] 转存 OSS 失败:', e && (e.message || e))
		return ''
	}
}

module.exports = { arkText2img, transferToOss }
