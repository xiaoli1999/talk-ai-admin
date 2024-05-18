const unipay = require('./uni-pay')
const path = require('path');
const { appId, mchId, v3Key } = require('./config.js')
const dayjs = require('./utils/dayjs.js')
const { vipList, vipGainList } = require('./utils/vip.js')
const { userField } = require('./utils/field.js')

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
	 * @function paySuccess 支付成功，更新用户信息
	 * @param { Object } event { userId, orderId } 用户id， 订单id
	 * @returns { Object } { errMsg: '', data: '' } 用户信息及错误信息
	 */
	async getGoodsList ({ pay_count } = {}) {
		try{
			let goodsList = JSON.parse(JSON.stringify(vipList))
			if (pay_count) {
				goodsList.shift()
			} else {
				goodsList.pop()
			}

			//返回数据给客户端
			return { data: { goodsList, vipGainList, showIos: false }, errMsg: '获取成功' }
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
			const correctOrder = vipList.find(i => i.price === event.price && i.date === event.day)
			if (!correctOrder) return { errMsg: '该套餐活动已结束，如有疑问请联系客服' }

			const trade_id = dayjs().add(8, 'hour').format('YYYYMMDDHHmmssSSS')

			const orderParams = {
				user_id: event.id,
				total_fee: event.price,
				trade_id,
				recharge_day: event.day,
			}
			/* 创建订单 */
			const orderRes = await dbJQL.collection('orders').add(orderParams)

			console.log('orderRes', orderRes);

			const params = {
				openid: event.openid, //这个是客户端上传的用户的openid
				body: '采黎vip续费',
				outTradeNo: orderRes.id, //给他个随机号让他可以第二次发起支付
				totalFee: event.price, // 金额，单位元,在上传过来的时候就已经*100了
				notifyUrl: 'https://fc-mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.next.bspapp.com/pay/notify', // 支付结果通知地址
				tradeType: 'JSAPI',
				attach: event.attach
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
	 * @function paySuccess 支付成功，更新用户信息
	 * @param { Object } event { userId, orderId } 用户id， 订单id
	 * @returns { Object } { errMsg: '', data: '' } 用户信息及错误信息
	 */
	async paySuccess ({ userId, orderId } = {}) {
		try{
			if (!userId || !orderId) return { errMsg: '参数错误' }

			const { data: userList } = await db.collection('users').doc(userId).get()
		 	const { vip_end_time, talk_count, pay_count, pay_total } = userList[0]

			const { data: orderList } = await db.collection('orders').doc(orderId).get()
			const { total_fee, recharge_day } = orderList[0]

			const userParams = {
				pay_count: pay_count + 1,
				pay_total: pay_total + total_fee
			}

			/* 更新时间 */
			const nowDate = dayjs().valueOf()
			if (vip_end_time > nowDate) {
				userParams.vip_end_time = dayjs(vip_end_time).add(recharge_day, 'day').valueOf()
			} else {
				userParams.vip_start_time = nowDate
				userParams.vip_end_time = dayjs(nowDate).add(recharge_day, 'day').valueOf()
				userParams.talk_count = talk_count + 200
			}

			console.log('\n -----------支付成功要改变的参数----------- \n', userParams);

			/* 更新用户vip信息 */
			await db.collection('users').doc(userId).update(userParams)
			const userInfo = await db.collection('users').doc(userId).field(userField).get()

			console.log('\n -----------订单支付成功用户续费成功----------- \n', userInfo);

			//返回数据给客户端
			return { data: userInfo.data[0], errMsg: '充值成功' }
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
