const unipay = require('./uni-pay')
const path = require('path');
const { wxVirtualPay } = require('./config.js')
const dayjs = require('./utils/dayjs.js')

const dao = require('./dao');

const libs = require('./libs');

const { vipList, cbList, vipQyList, cbDocList, vipDocObj, cardList, cardInfo, giftBagList, giftBagInfo } = require('./utils/vip.js')

/* 数据库 */
const db = uniCloud.database();
/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)

let unipayIns

/**
 * 获取accessToken
 * let uniPayInstance = await service.pay.getAccessToken({ provider, provider_pay_type });
 */
const getAccessToken = async (data = {}) => {
	let cacheKey = {
		appId: data.appId,
		platform: "weixin-mp"
	}
	let cacheInfo = await dao.opendbOpenData.getAccessToken(cacheKey);
	if (cacheInfo) {
		return cacheInfo.access_token;
	} else {
		// 缓存无值
		let getAccessTokenRes = await libs.wxpay.getAccessToken(data);
		let accessToken = getAccessTokenRes.accessToken;
		// 缓存accessToken
		await dao.opendbOpenData.setAccessToken(cacheKey, {
			access_token: getAccessTokenRes.accessToken,
		}, getAccessTokenRes.expiresIn);
		return accessToken;
	}
}
/**
 * 初始化支付
 * let uniPayInstance = await service.pay.getAccessToken({ provider, provider_pay_type });
 */
const initUniPay = async () => {
	wxVirtualPay.accessToken = await getAccessToken(wxVirtualPay);
	unipayIns = unipay.initWeixinVirtualPayment(wxVirtualPay)
}

module.exports = {
	_before: async function () { // 通用预处理器
		// 获取当前调用的方法名
		const methodName = this.getMethodName()

		// 定义需要用到 unipayIns 的方法白名单
		const requirePayMethods = ['getOrderInfo', 'getOrderPayStatus', 'notify']

		// 只有在白名单内的方法，才去执行初始化支付逻辑
		if (requirePayMethods.includes(methodName)) {
			console.log('\n -----------初始化支付----------- \n')
			await initUniPay()
		} else {
			console.log('\n -----------当前方法无需初始化支付，跳过----------- \n')
		}
	},

	/**
	 * @function getVipInfo 获取vip信息
	 * @param { Object } event { pay_count } 用户支付次数
	 * @returns { Object } { errMsg: '', data: '' } 用户信息及错误信息
	 */
	async getVipInfo () {
		try {
			/* 获取首冲采贝福利 */
			const firstCb = cbList[0]

			/* 删除第一项 */
			const newCbList = JSON.parse(JSON.stringify(cbList)).slice(1)

			const data = {
				vipList,
				firstCb,
				cbList: newCbList,
				vipQyList,
				cbDocList,
				vipDocObj,

				/* 畅聊卡 */
				cardList,
				cardInfo,

				/* 节日礼包 */
				giftBagList,
				giftBagInfo
			}

			//返回数据给客户端
			return { data, errMsg: '获取成功' }
		} catch ({ message }) {
			console.log('\n -----------获取vip套餐失败----------- \n', message);
			return { errMsg: message }
		}

	},

	/**
	 * @function getOrderInfo 获取支付的订单信息
	 * @param { Object } event 携带参数
	 * @returns { object } { errMsg: '', data: '' } 错误信息及订单信息
	 */
	async getOrderInfo(event) {
		try{
			const { type, price, attach, productId, code }  = event || {}

			let currentOrder

			if (type === 'vip') {
				currentOrder = vipList.find(i => i.price === price)
			} else if (['cb', 'first-cb'].includes(type)) {
				currentOrder = cbList.find(i => i.price === price)
			} else if (type === 'card') {
				currentOrder = cardList.find(i => i.price === price)
			} else if (type === 'gift-bag') {
				/* 礼包充值 */
				currentOrder = giftBagList.find(i => i.price === price)
			} else {}

			if (!currentOrder) return { errMsg: '该套餐活动已结束，如有疑问请联系客服' }

			const trade_id = dayjs().add(8, 'hour').format('YYYYMMDDHHmmssSSS')
			const clientInfo = this.getClientInfo()

			const orderParams = {
				user_id: event.id,
				total_fee: currentOrder.price,
				trade_id,
				title: attach,
				type,
				recharge_day: currentOrder.day || 0,
				recharge_cb: currentOrder.num ? currentOrder.num + currentOrder.gift : 0,
				recharge_card: currentOrder.minute || 0,
				osName: clientInfo.osName
			}
			/* 创建订单 */
			const orderRes = await dbJQL.collection('orders').add(orderParams)

			console.log('orderRes', orderRes);

			/* 用前端传来的 code 实时换取最新 session_key，彻底避免过期问题 */
			let session_key
			if (code) {
				const { data: wxRes } = await uniCloud.request({
					url: 'https://api.weixin.qq.com/sns/jscode2session',
					method: 'GET',
					data: {
						appid: wxVirtualPay.appId,
						secret: wxVirtualPay.secret,
						js_code: code,
						grant_type: 'authorization_code'
					}
				})
				console.log('-------- 实时换取session_key ---------', wxRes.session_key ? '成功' : '失败', wxRes.errcode || '')
				if (wxRes.session_key) {
					session_key = wxRes.session_key
					/* 顺便更新到数据库，保持数据一致 */
					await db.collection('users').doc(event.id).update({ session_key })
				}
			}

			/* 兜底：code换取失败时从数据库读取 */
			if (!session_key) {
				const { data: userList } = await db.collection('users').doc(event.id).get()
				session_key = userList[0].session_key
				console.log('-------- 兜底从数据库获取session_key ---------', session_key)
			}


			const orderTypeEnums = { vip: '开通会员', cb: '充值采贝', 'first-cb': '采贝首充福利', card: '购买畅聊卡', 'gift-bag': '购买节日礼包' }
			const params = {
				openid: event.openid, //这个是客户端上传的用户的openid
				body: orderTypeEnums[type],
				outTradeNo: orderRes.id, //给他个随机号让他可以第二次发起支付
				totalFee: currentOrder.price, // 金额，单位元,在上传过来的时候就已经*100了
				notifyUrl: 'https://fc-mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.next.bspapp.com/pay/notify', // 支付结果通知地址
				tradeType: 'JSAPI',
				attach: attach,

				/* 微信虚拟支付 */
				sessionKey: session_key,
				mode: 'short_series_goods', // short_series_coin 代币充值; short_series_goods 道具直购
				buyQuantity: 1, /* 数量 */
				productId: productId,
				goodsPrice: currentOrder.price
				// goodsPrice: Number((currentOrder.price / 100).toFixed(2))
			}

			console.log('params------------------', params)

			const orderInfo = await unipayIns.getOrderInfo(params)
			console.log('orderInfo', { ...orderInfo, id: orderRes.id });

			return { data: { ...orderInfo, id: orderRes.id }, errMsg: '获取成功' }
		} catch ({ message }) {
			console.log('\n -----------创建订单失败----------- \n', message);
			return { errMsg: message }
		}
	},
	/**
	 * @function getOrderPayStatus 校验订单支付状态
	 * @param { Object } event { orderId, openid }
	 * @returns { Object } { errMsg: '', data: '' } 支付状态及提示
	 */
	async getOrderPayStatus ({ orderId, openid } = {}) {
		try{
			if (!orderId || !openid) return { errMsg: '参数错误' }

			let data = false
			let errMsg = '订单未支付'

			for (let i = 0; i < 3; i++) {
				let res = await unipayIns.orderQuery({ outTradeNo: orderId, openid });

				if (res.tradeState === 'SUCCESS') {
					data = true;
					errMsg = res.tradeStateDesc || '支付成功';
					console.log(`\n----------第 ${i + 1} 次校验支付状态：成功----------\n`, res);
					break; // 状态成功，直接跳出轮询
				} else {
					errMsg = res.tradeStateDesc || '未支付';
					console.log(`\n----------第 ${i + 1} 次校验支付状态：未成功----------\n`, res);

					// 如果未成功且不是最后一次查询，则等待 3 秒后再继续下一次循环
					if (i < 2) {
						await new Promise(resolve => setTimeout(resolve, 3000))
					}
				}
			}

			//返回数据给客户端
			return { data, errMsg }
		} catch ({ message }) {
			console.log('\n -----------获取支付状态失败----------- \n', message);
			return { errMsg: message }
		}
	},

	/**
	 * @function paySuccess 支付成功，更新用户信息
	 * @param { Object } event { userId, orderId } 用户id， 订单id
	 * @returns { Object } { errMsg: '', data: '' } 用户信息及错误信息
	 */
	async paySuccess ({ userId, orderId } = {}) {
		try{
			if (!userId || !orderId) return { errMsg: '参数错误' }

			const { data: userList } = await db.collection('users').doc(userId).get()
		 	const { vip_end_time, cb_pay_num, cb_pay_count, pay_count, pay_total, talk_card_end_time } = userList[0]

			const { data: orderList } = await db.collection('orders').doc(orderId).get()
			const { total_fee, type, recharge_day, recharge_cb, recharge_card  } = orderList[0]

			const userParams = {
				pay_count: pay_count + 1,
				pay_total: pay_total + total_fee
			}

			const nowDate = dayjs().valueOf()

			/* 更新vip或采贝 */
			if (type === 'vip') {
				if (vip_end_time > nowDate) {
					userParams.vip_end_time = dayjs(vip_end_time).add(recharge_day, 'day').valueOf()
				} else {
					userParams.vip_start_time = nowDate
					userParams.vip_end_time = dayjs(nowDate).add(recharge_day, 'day').valueOf()
				}
			} else if (['cb', 'first-cb'].includes(type)){
				/* 将当前付费向上取整 */
				const cb_pay_num_int = Math.ceil(cb_pay_num || 0)
				if (vip_end_time > nowDate) {
					userParams.cb_pay_num = cb_pay_num_int + parseInt(recharge_cb * 1.1)
				} else {
					userParams.cb_pay_num = cb_pay_num_int + recharge_cb
				}

				userParams.cb_pay_count = (cb_pay_count || 0) + 1
			} else if (type === 'card') {
				/* 计算畅聊卡累加时间 */
				const ms = recharge_card * 60 * 1000
				if (talk_card_end_time > nowDate) {
					userParams.talk_card_end_time = talk_card_end_time + ms
				} else {
					/* 设置畅聊到期时间 */
					userParams.talk_card_end_time = nowDate + ms
				}

			} else if (type === 'gift-bag') {
				/* 充值礼包逻辑 */
				const giftBgInfo = giftBagList.find(i => i.price === total_fee)

				/* 更新会员 */
				if (vip_end_time > nowDate) {
					userParams.vip_end_time = dayjs(vip_end_time).add(giftBgInfo.vip, 'day').valueOf()
				} else {
					userParams.vip_start_time = nowDate
					userParams.vip_end_time = dayjs(nowDate).add(giftBgInfo.vip, 'day').valueOf()
				}

				/* 更新采贝 */
				userParams.cb_pay_num = Math.ceil(cb_pay_num || 0) + giftBgInfo.cb

				/* 更新畅聊卡 */
				const ms = giftBgInfo.card * 60 * 60 * 1000
				if (talk_card_end_time > nowDate) {
					userParams.talk_card_end_time = talk_card_end_time + ms
				} else {
					/* 设置畅聊到期时间 */
					userParams.talk_card_end_time = nowDate + ms
				}
			} else {}

			console.log('\n -----------支付成功要改变的参数----------- \n', userParams);

			/* 更新用户vip信息 */
			const { doc } = await db.collection('users').doc(userId).updateAndReturn(userParams)

			console.log('\n -----------订单支付成功用户续费成功----------- \n', doc);

			//返回数据给客户端
			return { data: doc, errMsg: '充值成功' }
		} catch ({ message }) {
			console.log('\n -----------订单支付成功用户续费失败----------- \n', message);
			return { errMsg: message }
		}

	},

	/**
	 * @function notify 支付状态及微信消息推送回调
	 */
	async notify () {
		try{
			const httpInfo = this.getHttpInfo()

			// 拦截并解析 JSON 字符串，防止 uni-pay 底层解构 Encrypt 失败
			if (typeof httpInfo.body === 'string') {
				try {
					httpInfo.body = JSON.parse(httpInfo.body);
				} catch (e) {
					console.log('---------JSON 解析 body 失败---------', e);
				}
			}

			// ================= 新增：处理 iOS 苹果退款问询 =================
			if (httpInfo.body && httpInfo.body.MsgType === 'event' && httpInfo.body.Event === 'xpay_subscribe_ios_refund_query_notify') {
				console.log('---------收到 iOS 苹果退款问询通知---------', httpInfo.body);

				// 直接响应微信服务器，1 代表拦截/拒绝退款，0 代表同意
				return {
					mpserverlessComposedResponse: true,
					statusCode: 200,
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						result_code: 1,
						reject_reason: "虚拟商品已发货，不支持退款",
						evidence: "虚拟商品已发货，不支持退款"
					})
				};
			}
			// ================= iOS 退款问询处理结束 =================


			// 1. 检查通知类型（区分是 Token 配置校验，还是实际的支付结果通知）
			let notifyType = await unipayIns.checkNotifyType(httpInfo)
			console.log('\n -----------通知类型----------- \n', notifyType);

			// 2. 处理 Token 校验逻辑（微信后台配置 URL 时会触发）
			if (notifyType === "token") {
				let verifyResult = await unipayIns.verifyTokenNotify(httpInfo);
				console.log('\n -----------Token校验结果----------- \n', verifyResult);
				if (!verifyResult) {
					console.log('---------!Token签名验证未通过!---------');
					return;
				}
				// 必须直接原样返回 echostr 字符串给微信服务器
				return verifyResult.echostr;
			}

			// 3. 过滤掉非支付类的其他通知（例如退款等，若无处理需求直接返回成功避免微信重复推送）
			if (notifyType !== "payment") {
				console.log(`---------!非支付通知!---------`);
				return {
					mpserverlessComposedResponse: true,
					statusCode: 200,
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({ code: 'SUCCESS', message: '成功' })
				};
			}

			// 4. 处理正式的支付结果异步通知
			let res = await unipayIns.verifyPaymentNotify(httpInfo)
			console.log('\n -----------订单支付状态信息----------- \n', res);

			if (!res) {
				console.log('\n -----------支付回调签名验证未通过----------- \n');
				return { errMsg: '签名验证未通过' }
			}

			// 验证支付确实成功（兼容虚拟支付 tradeState 及普通支付 returnCode/resultCode）
			if (res.returnCode === "SUCCESS" || res.resultCode === "SUCCESS" || res.tradeState === "SUCCESS") {
				const orderParams = {
					transaction_id: res.transactionId,
					total_fee: res.totalFee,
					status: res.tradeState === 'SUCCESS' ? 1 : 0,
					update_time: dayjs().valueOf(),
					paid_time: dayjs(res.successTime).valueOf(),
				}

				/* 您的业务逻辑：更新订单状态 */
				await db.collection('orders').doc(res.outTradeNo).update(orderParams)
				console.log('\n -----------订单支付信息更新成功----------- \n', orderParams);

				// 【建议】：为了安全起见，发放 VIP/采贝 的逻辑（即 paySuccess 函数中的逻辑）
				// 最好能合并到这里执行（以 res.outTradeNo 查出 userId 并发货），
				// 如果前端调用 paySuccess 发货，存在被篡改参数非法刷单的风险。
			} else {
				console.log('\n -----------未检测到支付成功状态----------- \n', res);
			}

			// 5. 返回指定格式的数据给微信客户端，告知处理成功，终止微信重试
			return {
				mpserverlessComposedResponse: true,
				statusCode: 200,
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					code: 'SUCCESS',
					message: '成功'
				})
			}
		} catch (error) {
			console.log('\n -----------订单通知更改订单状态失败----------- \n', error.message);
			return { errMsg: error.message }
		}
	}
}
