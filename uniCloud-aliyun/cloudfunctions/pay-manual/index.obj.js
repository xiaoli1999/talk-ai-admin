/**
 * pay-manual · 后台「登录 + 手工到账」云对象
 *
 * 业务背景(2026-09-01 黎令):微信支付被封,用户在小程序点充值仍会生成一条未付款订单(status=0),
 * 然后线下转账给老板;老板在后台登录后,对该单点「手工到账」,按小程序下单时的商品原样发货,并打「手动单」标签。
 *
 * 设计原则:
 *  - 发货逻辑只存在一份:本对象不复制任何发货代码,翻单后直接调线上的 pay-v2.paySuccess(pay-v2 不改、不重传)。
 *  - 独立云对象,线上任何链路都不依赖它;删掉本对象不影响小程序。
 *  - 幂等:先原子翻单(where status:0 → 1),updated===1 才发货;同一单第二次点直接被挡,不会重复到账。
 *  - 发货失败回翻成未付款并留 manual_error,老板可重点。
 *  - 登录:账号密码写在 config.js(ACCOUNTS),login 通过后签 HMAC token(7 天);其余方法在 _before 验 token,
 *    操作人 = token 里的账号,写进订单 operator 留痕。后台其他页面走的是 schema 全开的客户端 JQL,本登录不覆盖它们。
 *
 * 订单上新增的字段(schema 未声明,uniCloud 不限额外字段,项目内已有实测先例):
 *  source:'manual' | operator | manual_time | manual_remark | manual_error;
 *  后台按 source==='manual' 渲染「手动单」,存量单无 source 即「小程序订单」。
 */
const crypto = require('crypto')
const db = uniCloud.database()
const cmd = db.command
const { ACCOUNTS, TOKEN_SECRET, TOKEN_TTL_MS } = require('./config.js')

const BUILD = '0901-2'

/* 登录失败节流:同账号 10 分钟内错 5 次锁 10 分钟(进程内存,重启归零即可) */
const FAILS = new Map()
const FAIL_WINDOW = 10 * 60 * 1000
const FAIL_MAX = 5

const b64url = (s) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const unb64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
const sign = (body) => crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('hex')

/**
 * 签 token:base64url(JSON{u, exp}).hmac
 * @param {string} u 账号
 * @returns {{token:string, expireAt:number}}
 */
function signToken (u) {
	const expireAt = Date.now() + TOKEN_TTL_MS
	const body = b64url(JSON.stringify({ u, exp: expireAt }))
	return { token: body + '.' + sign(body), expireAt }
}

/**
 * 验 token:签名一致且未过期才返回 payload,否则 null
 * @param {string} token
 * @returns {{u:string, exp:number}|null}
 */
function verifyToken (token) {
	try {
		if (!token || typeof token !== 'string') return null
		const [body, sig] = token.split('.')
		if (!body || !sig) return null
		const expect = sign(body)
		if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
		const payload = JSON.parse(unb64url(body))
		if (!payload || !payload.u || !(payload.exp > Date.now())) return null
		if (!Object.prototype.hasOwnProperty.call(ACCOUNTS, payload.u)) return null
		return payload
	} catch (e) {
		return null
	}
}

module.exports = {
	_before () {
		const method = this.getMethodName()
		if (method === 'ping' || method === 'login') return

		const p = (this.getParams() || [])[0] || {}
		const payload = verifyToken(p.token)
		if (!payload) throw new Error('登录已失效，请重新登录')
		this.operator = payload.u
	},

	/** 部署核戳:上传后前端调一次,build 不对说明 cli 假成功 */
	ping () {
		return { errMsg: '', data: { build: BUILD } }
	},

	/**
	 * @function login 后台假登录:账号密码比对 config.ACCOUNTS,通过签 7 天 token
	 * @param {object} p
	 * @param {string} p.account
	 * @param {string} p.password
	 * @returns {{errMsg:string, data?:{token:string, name:string, expireAt:number}}}
	 */
	login ({ account, password } = {}) {
		try {
			const acc = String(account || '').trim()
			const pwd = String(password || '')
			if (!acc || !pwd) return { errMsg: '请输入账号和密码' }

			const now = Date.now()
			const f = FAILS.get(acc)
			if (f && f.n >= FAIL_MAX && now - f.t < FAIL_WINDOW) return { errMsg: '错误次数过多，10 分钟后再试' }

			const ok = Object.prototype.hasOwnProperty.call(ACCOUNTS, acc) && String(ACCOUNTS[acc]) === pwd
			if (!ok) {
				const nf = (f && now - f.t < FAIL_WINDOW) ? { n: f.n + 1, t: f.t } : { n: 1, t: now }
				FAILS.set(acc, nf)
				return { errMsg: '账号或密码错误' }
			}

			FAILS.delete(acc)
			const { token, expireAt } = signToken(acc)
			return { errMsg: '', data: { token, name: acc, expireAt } }
		} catch (e) {
			return { errMsg: (e && e.message) || '登录异常' }
		}
	},

	/**
	 * @function settle 手工到账:翻单 → 调 pay-v2.paySuccess 原样发货
	 * @param {object} p
	 * @param {string} p.token 登录 token(_before 已验)
	 * @param {string} p.orderId 订单 _id(必须是 status=0 的未付款单)
	 * @param {string} [p.remark] 备注(转账方式/流水号),≤100 字
	 * @returns {{errMsg:string, data?:{orderId:string, type:string, total_fee:number, user:object}}}
	 */
	async settle ({ orderId, remark = '' } = {}) {
		try {
			if (!orderId || typeof orderId !== 'string') return { errMsg: '缺少订单号' }

			const now = Date.now()

			/* 原子翻单:只有还是未付款(status:0)的单才翻;updated===1 是「恰好一次」的唯一凭证(与 invite 同范式) */
			const { updated } = await db.collection('orders').where({ _id: orderId, status: 0 }).update({
				status: 1,
				paid_time: now,
				update_time: now,
				transaction_id: 'MANUAL-' + now,
				source: 'manual',
				operator: this.operator,
				manual_time: now,
				manual_remark: String(remark || '').slice(0, 100)
			})
			if (updated !== 1) return { errMsg: '该订单已处理或不存在(未付款单隔天凌晨会被定时清理)' }

			const { data: orderList } = await db.collection('orders').doc(orderId).get()
			const order = orderList && orderList[0]
			if (!order || !order.user_id) {
				await revert(orderId, '订单读取失败')
				return { errMsg: '订单读取失败,已回翻为未付款' }
			}

			/* 发货:唯一的一份发货逻辑在 pay-v2.paySuccess(成功回 {data:用户文档, errMsg:'充值成功'},失败无 data) */
			let res
			try {
				res = await uniCloud.importObject('pay-v2').paySuccess({ userId: order.user_id, orderId })
			} catch (e) {
				res = { errMsg: (e && e.message) || '发货调用异常' }
			}
			if (!res || !res.data) {
				const why = (res && res.errMsg) || '发货失败'
				await revert(orderId, why)
				return { errMsg: '发货失败,已回翻为未付款:' + why }
			}

			const u = res.data || {}
			console.log('[pay-manual] 到账', { orderId, operator: this.operator, type: order.type, total_fee: order.total_fee, userId: order.user_id })

			return {
				errMsg: '',
				data: {
					orderId,
					type: order.type,
					total_fee: order.total_fee,
					user: {
						_id: u._id,
						nickname: u.nickname,
						cb_pay_num: u.cb_pay_num,
						vip_end_time: u.vip_end_time,
						talk_card_end_time: u.talk_card_end_time,
						pay_count: u.pay_count
					}
				}
			}
		} catch (e) {
			console.log('[pay-manual] settle 异常', e && e.message)
			return { errMsg: (e && e.message) || '手工到账异常' }
		}
	}
}

/**
 * 发货失败时把单子回翻成未付款:去掉已付款痕迹,留 manual_error 供老板看原因后重点
 * @param {string} orderId
 * @param {string} why
 */
async function revert (orderId, why) {
	try {
		await db.collection('orders').doc(orderId).update({
			status: 0,
			paid_time: cmd.remove(),
			transaction_id: cmd.remove(),
			source: cmd.remove(),
			manual_time: cmd.remove(),
			manual_error: String(why).slice(0, 200),
			update_time: Date.now()
		})
	} catch (e) {
		console.log('[pay-manual] 回翻失败(需人工核对)', orderId, e && e.message)
	}
}
