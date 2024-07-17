const unipay = require('./uni-pay')
const path = require('path');
const { appId, mchId, v3Key } = require('./config.js')
const dayjs = require('./utils/dayjs.js')
const { vipList, cbList, vipQyList, cbDocList, vipDocObj } = require('./utils/vip.js')

/* 数据库 */
const db = uniCloud.database();
/* JQL数据库集合 */
const dbJQL = uniCloud.databaseForJQL(db)

const unipayIns = unipay.initWeixinV3({
  appId,
  mchId,
  v3Key,
  appCertPath: path.resolve(__dirname, './cert/api_cert.pem'),
  appPrivateKeyPath: path.resolve(__dirname, './cert/api_key.pem')
})

module.exports = {
	_before: function () { // 通用预处理器

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

			//返回数据给客户端
			return { data: { vipList, firstCb, cbList: newCbList, vipQyList, cbDocList, vipDocObj, showIos: true }, errMsg: '获取成功' }
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
			const { type, price, attach }  = event || {}

			let currentOrder

			if (type === 'vip') {
				currentOrder = vipList.find(i => i.price === price)
			} else {
				console.log(cbList)
				currentOrder = cbList.find(i => i.price === price)
			}

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
				osName: clientInfo.osName
			}
			/* 创建订单 */
			const orderRes = await dbJQL.collection('orders').add(orderParams)

			console.log('orderRes', orderRes);

			const params = {
				openid: event.openid, //这个是客户端上传的用户的openid
				body: '采黎vip续费',
				outTradeNo: orderRes.id, //给他个随机号让他可以第二次发起支付
				totalFee: currentOrder.price, // 金额，单位元,在上传过来的时候就已经*100了
				notifyUrl: 'https://fc-mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.next.bspapp.com/pay/notify', // 支付结果通知地址
				tradeType: 'JSAPI',
				attach: attach
			}

			const orderInfo = await unipayIns.getOrderInfo(params)
			console.log('orderInfo', { ...orderInfo, id: orderRes.id });

			return { data: { ...orderInfo, id: orderRes.id }, errMsg: '获取成功' }
		} catch ({ message }) {
			console.log('\n -----------创建订单失败----------- \n', message);
			return { errMsg: message }
		}
	},
	/**
	 * @function getOrderPayStatus 获取vip列表
	 * @param { Object } event { orderId } 订单id
	 * @returns { Object } { errMsg: '', data: '' } 用户信息及错误信息
	 */
	async getOrderPayStatus ({ orderId } = {}) {
		try{
			if (!orderId) return { errMsg: '参数错误' }

			const res = await unipayIns.orderQuery({ outTradeNo: orderId })

			let data = false
			if (res.tradeState === 'SUCCESS') {
				data = true
			} else {
				console.log(`\n----------校验支付状态（状态）----------\n`, res);
			}

			//返回数据给客户端
			return { data, errMsg: res.tradeStateDesc }
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
		 	const { vip_end_time, pay_count, cb_pay_num, cb_pay_count, pay_total } = userList[0]

			const { data: orderList } = await db.collection('orders').doc(orderId).get()
			const { total_fee, type, recharge_day, recharge_cb  } = orderList[0]

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

				userParams.pay_count = (pay_count || 0) + 1
			} else {
				if (vip_end_time > nowDate) {
					userParams.cb_pay_num = (cb_pay_num || 0) + parseInt(recharge_cb * 1.1)
				} else {
					userParams.cb_pay_num = (cb_pay_num || 0) + recharge_cb
				}

				userParams.cb_pay_count = (cb_pay_count || 0) + 1
			}

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
	 * @function notify 支付状态
	 * @param { Object } event
	 */
	async notify () {
		try{
			const httpInfo = this.getHttpInfo()

			let res = await unipayIns.verifyPaymentNotify(httpInfo)

			console.log('\n -----------订单支付状态信息----------- \n', res);
			if (!res) return

			const orderParams = {
				transaction_id: res.transactionId,
				total_fee: res.totalFee,
				status: res.tradeState === 'SUCCESS' ? 1 : 0,
				update_time: dayjs().valueOf(),
				paid_time: dayjs(res.successTime).valueOf(),
			}

			/* 更新订单状态 */
			await db.collection('orders').doc(res.outTradeNo).update(orderParams)

			console.log('\n -----------订单支付信息更新成功----------- \n', orderParams);

			//返回数据给客户端
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
		} catch ({ message }) {
			console.log('\n -----------订单通知更改订单状态失败----------- \n', message);
			return { errMsg: message }
		}
	}
}
