// survey/index.obj.js —— 调研问卷云对象（多版本 + 时效 + 防重领）
const { meta, questionsMap } = require('./config.js')
const db = uniCloud.database();

/* 北京时间今天 YYYY-MM-DD（时区无关：UTC 毫秒 +8h 再取日期，避免服务器时区差异，见 memory time-convert） */
function beijingToday() {
	return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/* 是否在时效窗口内（北京日期字符串比较，含起止当天） */
function isWithinWindow(m) {
	if (!m || !m.startDate || !m.endDate) return false
	const today = beijingToday()
	return today >= m.startDate && today <= m.endDate
}

module.exports = {
	_before: function () {
		// 可以在这里做 token 校验等前置拦截
	},

	/**
	 * 获取当前激活版本的问卷配置
	 * - 按 meta.version 下发对应题库
	 * - isOpen：是否在时效窗口内（服务端权威）
	 * - isCompleted：该用户是否已填「当前版本」（按 user_id + version；历史无 version 记录视作 v1，不影响 v2 判定）
	 * - 未开放 / 已填 → 不下发题目
	 */
	async getConfig({ userId } = {}) {
		const version = meta.version
		const questions = questionsMap[version] || []
		const isOpen = isWithinWindow(meta)

		let isCompleted = false
		if (userId) {
			const { data } = await db.collection('surveys')
				.where({ user_id: userId, version })
				.limit(1)
				.get()
			isCompleted = !!(data && data.length)
		}

		return {
			isOpen,
			version,
			reward: meta.reward,
			title: meta.title,
			progressTip: meta.progressTip,
			letter: meta.letter,
			sections: meta.sections,
			startDate: meta.startDate,
			endDate: meta.endDate,
			isCompleted,
			questions: (isOpen && !isCompleted) ? questions : []
		}
	},

	/**
	 * 提交问卷
	 * 失败统一返回 { data: null, errMsg }（前端按 { data, errMsg } 解构，!data 即弹 errMsg）
	 */
	async submit(data) {
		const { answers, duration, userId, source } = data;
		const version = meta.version;

		if (!userId) return { data: null, errMsg: '请先登录后再填写哦~' };

		// 时效校验（服务端权威，防客户端伪造过期问卷）
		if (!isWithinWindow(meta)) return { data: null, errMsg: '本期问卷已结束，感谢你的关注~' };

		// 防刷：最少 60s（与前端双校验）；顺手把时长规整为非负整数，避免脏值入库（surveys.duration 为 int）
		const safeDuration = Math.max(0, Math.floor(Number(duration) || 0));
		if (safeDuration < 60) return { data: null, errMsg: '填写速度太快啦，请仔细阅读题目哦~' };

		try {
			// 防重领：同一用户同一版本只发一次（补原先仅前端 UI 拦截的漏洞）
			const { data: exist } = await db.collection('surveys')
				.where({ user_id: userId, version })
				.limit(1)
				.get();
			if (exist && exist.length) {
				return { data: null, errMsg: '你已经填过本期问卷啦，感谢支持！' };
			}

			// 取当前用户：既校验账号存在，又拿到当前采贝余额（用于 null 安全发奖，见下）
			const { data: uArr } = await db.collection('users').doc(userId).get();
			const user = uArr && uArr[0];
			if (!user) return { data: null, errMsg: '账号信息异常，请重新登录后再试~' };

			// 1. 数据入库（带 version）—— 这条记录即「已填本版本」的防重凭据
			const addRes = await db.collection('surveys').add({
				answers,
				duration: safeDuration,
				user_id: userId,
				source,
				version
			});

			// 2. 发放采贝奖励（额度走 meta.reward，可配）：cb_num 余额 + receive_cb_total 累计 一起涨
			//    （与签到/邀请/看视频/补偿口径一致，否则福利中心「累计获得采贝」不更新）。
			//    ⚠️ 这里刻意用「读改写 + || 0」而非 db.command.inc：历史/沉睡账号的 cb_num / receive_cb_total
			//       可能为 null 或缺失，对 null 执行 $inc 会抛 "Cannot apply $inc to a value of non-numeric type"，
			//       用户侧表现为点「领取」后转圈→无反应/弹一串英文。本接口一次性发放且已防重，无并发竞态顾虑，
			//       与 user 云对象 claimAddMpReward / claimCompensation 的一次性发奖口径保持一致。
			const reward = Number(meta.reward) || 50;
			let doc;
			try {
				const ret = await db.collection('users').doc(userId).updateAndReturn({
					cb_num: (Number(user.cb_num) || 0) + reward,
					receive_cb_total: (Number(user.receive_cb_total) || 0) + reward
				});
				doc = ret.doc;
			} catch (rewardErr) {
				// 入库成功但发奖失败：必须回滚刚写入的问卷记录。否则「记录在、采贝没发」会被上面的防重逻辑
				//   永久卡死——用户白填还领不到、也无法重试。回滚后用户可干净重试；remove 再失败也只是退回原状，不会多发错发。
				if (addRes && addRes.id) {
					await db.collection('surveys').doc(addRes.id).remove().catch(() => {});
				}
				console.error('[survey.submit] 发奖失败已回滚问卷记录 userId=' + userId + ' version=' + version, rewardErr);
				return { data: null, errMsg: '提交失败了，请稍后再试一次~' };
			}

			return { data: doc, errMsg: `提交成功，${reward}采贝已发放到账！` };
		} catch (e) {
			const msg = (e && e.message) || '';
			// 唯一索引冲突(E11000)：该用户该版本已有记录。正常已被上面的 where 防重拦截，这里是并发/重复点击的二次保险。
			// ⚠️ 历史遗留坑：surveys 早期存在一条「仅 user_id」的唯一索引(控制台手建，名「用户ID」)，会误伤填过 v1 的
			//    老用户提交 v2（add 直接抛 E11000）。必须在 uniCloud 控制台删除它，改用 (user_id, version) 复合唯一索引
			//    （见 database/surveys.index.json）。否则这里只能把英文报错转成友好文案，老用户仍无法提交 v2。
			if (/E11000|duplicate key/i.test(msg)) {
				console.warn('[survey.submit] 唯一索引冲突 userId=' + userId + ' version=' + version + '，请确认 surveys 已删除仅 user_id 的旧唯一索引、改为 (user_id, version) 复合唯一索引');
				return { data: null, errMsg: '你已经填过本期问卷啦，感谢支持！' };
			}
			// 其他异常：绝不把原始(英文)数据库异常透传给用户；记录完整上下文便于云端日志排查
			console.error('[survey.submit] 提交失败 userId=' + userId + ' version=' + version, e);
			return { data: null, errMsg: '提交失败了，请稍后再试一次~' };
		}
	}
}
