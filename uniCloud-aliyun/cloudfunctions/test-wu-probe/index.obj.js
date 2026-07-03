/**
 * 云对象 test-wu-probe ·【临时·测完即删】
 *
 * 目的：用一手实测定死阿里云 uniCloud 数据库「写操作 WU / 读操作 RU」的计费口径，
 *      尤其是 push 到数组/桶时按【增量(A)】还是【整文档(B)】计费——这决定聊天记录分桶的桶大小。
 *
 * 用法（关键）：本云对象只负责「制造可控的、已知次数与体积的数据库操作」，
 *      它【无法读自己的计费】。WU/RU 的真实增量需到「阿里云 uniCloud 费用中心 > 用量统计 > 数据库读/写操作」看，
 *      有小时级/次日聚合延迟。所以正确姿势：
 *        ① 一次只跑【一个】方法（让那一类操作独占一个计费窗口，便于归因）；
 *        ② 记下方法返回里的 window 起止时间；
 *        ③ 隔 1 小时（或次日）读费用中心该窗口的 WU/RU 增量；
 *        ④ 把「实测 WU」对照返回里的 expect_WU_若A / expect_WU_若B 判读。
 *
 * 安全：① 只写自己的新表 test_wu_probe（permission 全 false，遵守「禁跨表写」）；
 *      ② 每个方法有 100s 软上限（防 120s 超时），返回 n_done=实际完成次数（WU 归因以它为准）；
 *      ③ 测试本身会产生少量费用（最坏 B 口径下 pushGrowing 约 ¥1~5），可忽略；
 *      ④ 测完务必调 cleanup() 清表。
 *
 * 详见 md/聊天记录上云/04-计费实测手册.md
 */

const db = uniCloud.database()
const dbCmd = db.command
const COL = 'test_wu_probe'

/** 造一个恰好 kb KB 的纯 ASCII 字符串（1 char = 1 byte，便于精确算体积） */
const mkStr = (kb) => 'x'.repeat(Math.max(1, Math.round(kb * 1024)))
const SAFE_MS = 100000 // 100s 软上限，留余量给 120s 超时
const win = (t0, t1) => ({ startISO: new Date(t0).toISOString(), endISO: new Date(t1).toISOString(), wallMs: t1 - t0 })

module.exports = {

	/**
	 * 【T1·决定性】往同一个不断变大的文档 push n 个等大元素（模拟分桶里不停 append 消息）。
	 * - 若 A(增量)：每次只计本次 push 的 sizeKB → 总 WU ≈ n*sizeKB（线性、与桶已有多大无关）
	 * - 若 B(整文档)：每次计当时整个文档大小 → 总 WU ≈ sizeKB*(1+2+...+n) ≈ sizeKB*n²/2（暴涨）
	 * 这两个值差几十~几百倍，实测 WU 一眼能判 A/B。
	 */
	async pushGrowing({ n = 500, sizeKB = 2 } = {}) {
		const t0 = Date.now()
		const { id } = await db.collection(COL).add({ tag: 'pushGrowing', arr: [], ts: Date.now() })
		const elem = mkStr(sizeKB)
		let done = 0
		for (let i = 0; i < n; i++) {
			if (Date.now() - t0 > SAFE_MS) break
			await db.collection(COL).doc(id).update({ arr: dbCmd.push(elem) })
			done++
		}
		const t1 = Date.now()
		const logicalKB = done * sizeKB
		const expectB = Math.round(sizeKB * done * (done + 1) / 2)
		return {
			method: 'pushGrowing', id, n_requested: n, n_done: done, sizeKB,
			docFinalKB: logicalKB,
			expect_WU_若A增量: logicalKB,
			expect_WU_若B整文档: expectB,
			倍率_B比A: Math.round(expectB / Math.max(1, logicalKB)),
			window: win(t0, t1),
			判读: '只跑这一个 → 读费用中心「数据库写操作WU」该窗口增量；≈expect_A→增量计费(A,大桶安全)；≈expect_B→整文档计费(B,大桶贵)'
		}
	},

	/**
	 * 【T2·写基线】add n 个独立小文档（模拟「单条存」一消息一文档）。
	 * A/B 口径下都 ≈ n*sizeKB（每个文档都小、各算各的）。作为 T1 的对照基准。
	 */
	async addSingles({ n = 500, sizeKB = 2 } = {}) {
		const t0 = Date.now()
		const blob = mkStr(sizeKB)
		let done = 0
		for (let i = 0; i < n; i++) {
			if (Date.now() - t0 > SAFE_MS) break
			await db.collection(COL).add({ tag: 'addSingles', blob, ts: Date.now() })
			done++
		}
		const t1 = Date.now()
		return {
			method: 'addSingles', n_requested: n, n_done: done, sizeKB,
			expect_WU: done * sizeKB,
			window: win(t0, t1),
			判读: '基线：单条存的写费。实测应 ≈ expect_WU；与 T1 对比看大桶 push 是否更贵'
		}
	},

	/**
	 * 【T3·最直接的 B 探测】先造一个 bigKB 的大文档，再往它的数组里 push n 个【极小】元素('y')。
	 * - 若 A：每次只计极小增量 → 总 WU ≈ n（每次约 1WU）
	 * - 若 B：每次计整个大文档 → 总 WU ≈ n*bigKB（暴涨）
	 * 比 T1 更干净：增量恒定极小，差异全来自「是否为整文档买单」。
	 */
	async pushIntoBig({ n = 200, bigKB = 100 } = {}) {
		const t0 = Date.now()
		const { id } = await db.collection(COL).add({ tag: 'pushIntoBig', arr: [mkStr(bigKB)], ts: Date.now() })
		let done = 0
		for (let i = 0; i < n; i++) {
			if (Date.now() - t0 > SAFE_MS) break
			await db.collection(COL).doc(id).update({ arr: dbCmd.push('y') })
			done++
		}
		const t1 = Date.now()
		return {
			method: 'pushIntoBig', id, n_requested: n, n_done: done, bigKB,
			expect_WU_若A增量: done,            // 每次 ~1WU
			expect_WU_若B整文档: done * bigKB,   // 每次 ~bigKB WU
			window: win(t0, t1),
			判读: '往大桶 push 小消息的真实代价。实测 ≈ done → A；≈ done*bigKB → B（大桶是雷）'
		}
	},

	/**
	 * 【T4·标量更新 in 大文档】造一个 bigKB 大文档，反复 set 一个【小标量字段】flag n 次。
	 * 测「在大文档里改一个小字段」按字段(A)还是整文档(B)计——对应「亲密度若塞进大文档」「桶内改某条状态」的代价。
	 * - 若 A：≈ n（只算改的小字段）  - 若 B：≈ n*bigKB
	 */
	async setScalarInBig({ n = 200, bigKB = 100 } = {}) {
		const t0 = Date.now()
		const { id } = await db.collection(COL).add({ tag: 'setScalarInBig', blob: mkStr(bigKB), flag: 0, ts: Date.now() })
		let done = 0
		for (let i = 0; i < n; i++) {
			if (Date.now() - t0 > SAFE_MS) break
			await db.collection(COL).doc(id).update({ flag: i })
			done++
		}
		const t1 = Date.now()
		return {
			method: 'setScalarInBig', id, n_requested: n, n_done: done, bigKB,
			expect_WU_若A增量: done,
			expect_WU_若B整文档: done * bigKB,
			window: win(t0, t1),
			判读: '大文档里改小字段。≈done→A(亲密度/状态可安心放)；≈done*bigKB→B(别把高频小字段塞进大文档)'
		}
	},

	/**
	 * 【T5·inc 标量·小文档】对一个极小文档反复 inc 计数 n 次（模拟亲密度 inc）。
	 * 文档极小，A/B 都应 ≈ n（每次约 1WU）。验证「亲密度 inc」是最便宜的写。
	 */
	async incScalar({ n = 1000 } = {}) {
		const t0 = Date.now()
		const { id } = await db.collection(COL).add({ tag: 'incScalar', cnt: 0, ts: Date.now() })
		let done = 0
		for (let i = 0; i < n; i++) {
			if (Date.now() - t0 > SAFE_MS) break
			await db.collection(COL).doc(id).update({ cnt: dbCmd.inc(1) })
			done++
		}
		const t1 = Date.now()
		return {
			method: 'incScalar', id, n_requested: n, n_done: done,
			expect_WU: done,
			window: win(t0, t1),
			判读: '亲密度 inc 基线：应 ≈ done（最便宜）。若远大于 done 说明 inc 也按整文档计（需警惕）'
		}
	},

	/**
	 * 【T6·读全量】读一个 bigKB 大文档 n 次（不投影）。
	 * 读 RU=ceil(查询KB/4)。若按返回量：≈ n*ceil(bigKB/4)。作为读基线 + 与 T7 对比。
	 */
	async readBig({ n = 500, bigKB = 100 } = {}) {
		const { id } = await db.collection(COL).add({ tag: 'readBig', blob: mkStr(bigKB), ts: Date.now() })
		const t0 = Date.now()
		let done = 0
		for (let i = 0; i < n; i++) {
			if (Date.now() - t0 > SAFE_MS) break
			await db.collection(COL).doc(id).get()
			done++
		}
		const t1 = Date.now()
		return {
			method: 'readBig', id, n_requested: n, n_done: done, bigKB,
			expect_RU: done * Math.ceil(bigKB / 4),
			window: win(t0, t1),
			判读: '读全量大文档基线 RU。与 T7(投影) 对比：若 T7 远小 → 投影/字段过滤能降 RU（按返回量计）'
		}
	},

	/**
	 * 【T7·投影读】同样大文档读 n 次，但 .field() 只取极小字段(ts)，不取 blob/arr。
	 * 若 RU 远小于 T6 → RU 按【返回量】计、投影有效（我们读上下文用 field/$slice 只取最近N条就能省 RU）；
	 * 若与 T6 相当 → RU 按【扫描量】计、投影无用（读大桶必然贵，倾向小桶/单条）。
	 */
	async readProjected({ n = 500, bigKB = 100 } = {}) {
		const { id } = await db.collection(COL).add({ tag: 'readProjected', blob: mkStr(bigKB), ts: Date.now() })
		const t0 = Date.now()
		let done = 0
		let sampleKeys = []
		for (let i = 0; i < n; i++) {
			if (Date.now() - t0 > SAFE_MS) break
			const r = await db.collection(COL).doc(id).field({ ts: true }).get()
			if (i === 0 && r && r.data && r.data[0]) sampleKeys = Object.keys(r.data[0])
			done++
		}
		const t1 = Date.now()
		return {
			method: 'readProjected', id, n_requested: n, n_done: done, bigKB,
			sampleReturnedKeys: sampleKeys,
			window: win(t0, t1),
			判读: '投影只取 ts。读费用中心 RU 增量，与 T6 比：远小→投影降 RU(按返回量)；相当→按扫描量(投影无用)'
		}
	},

	/**
	 * 【一键·跑一次就走·建议用「上传运行/云端运行」】按序跑完所有探针。
	 * ⚠️ 平台硬上限：云对象单次调用最长 120s，故内置 110s 软闸安全返回；到点按实际 n_done 算期望，结论不变。
	 * ⚠️ 本地运行每个 DB 操作要往返公网(~286ms)，95s 只跑 300 多次→用「上传运行」(云端内部~10ms)才跑得满。
	 * 顺序：先跑读操作 + 轻量写（上次没轮到的），把已确认的 pushGrowing(B放大器) 垫到最后——万一到点被截，牺牲的是已知项。
	 * 次数已调大，让读 RU 盖过产线 ~2-3万 基线、写信号更清晰。
	 */
	async runAll() {
		const t0 = Date.now()
		const DEADLINE = t0 + 110000
		const left = () => Date.now() < DEADLINE
		const exps = []
		const readBigKB = 100; let readBigDone = 0, readProjDone = 0, projKeys = []

		// ===== 写实验先跑（本地运行也能在110s内跑完前两个最关键的大文档写）=====
		// 1) pushIntoBig：往 100KB 大桶 push 小元素（"往满桶追加消息"贵不贵）。A=n / B=n*100
		{
			const bigKB = 100, target = 150
			const { id } = await db.collection(COL).add({ tag: 'runAll_pushIntoBig', arr: [mkStr(bigKB)], ts: Date.now() })
			let done = 0
			while (done < target && left()) { await db.collection(COL).doc(id).update({ arr: dbCmd.push('y') }); done++ }
			exps.push({ exp: 'pushIntoBig', n_done: done, a: done, b: done * bigKB })
		}
		// 2) setScalarInBig：大文档里改小字段（"改桶内某条/soundUrl回填/亲密度塞大文档"贵不贵）。A=n / B=n*100
		{
			const bigKB = 100, target = 150
			const { id } = await db.collection(COL).add({ tag: 'runAll_setScalarInBig', blob: mkStr(bigKB), flag: 0, ts: Date.now() })
			let done = 0
			while (done < target && left()) { await db.collection(COL).doc(id).update({ flag: done }); done++ }
			exps.push({ exp: 'setScalarInBig', n_done: done, a: done, b: done * bigKB })
		}
		// 3) addSingles：单条存写基线（A/B 同价）
		{
			const sizeKB = 2, target = 300
			const blob = mkStr(sizeKB); let done = 0
			while (done < target && left()) { await db.collection(COL).add({ tag: 'runAll_addSingles', blob, ts: Date.now() }); done++ }
			exps.push({ exp: 'addSingles', n_done: done, a: done * sizeKB, b: done * sizeKB })
		}
		// 4) incScalar：亲密度 inc 基线（小文档，A/B 同价）
		{
			const target = 300
			const { id } = await db.collection(COL).add({ tag: 'runAll_incScalar', cnt: 0, ts: Date.now() })
			let done = 0
			while (done < target && left()) { await db.collection(COL).doc(id).update({ cnt: dbCmd.inc(1) }); done++ }
			exps.push({ exp: 'incScalar', n_done: done, a: done, b: done })
		}
		// 5) pushGrowing：B 信号放大器（再确认一次 array push）
		{
			const sizeKB = 4, target = 200
			const { id } = await db.collection(COL).add({ tag: 'runAll_pushGrowing', arr: [], ts: Date.now() })
			const elem = mkStr(sizeKB); let done = 0
			while (done < target && left()) { await db.collection(COL).doc(id).update({ arr: dbCmd.push(elem) }); done++ }
			exps.push({ exp: 'pushGrowing', n_done: done, a: done * sizeKB, b: Math.round(sizeKB * done * (done + 1) / 2) })
		}
		// ===== 读实验垫底（大文档读慢、只有云端运行跑得满；本地到点被截无妨，反正本地优先架构下读≈0）=====
		// 6) readBig：读全量大文档（读 RU 基线，调大到盖过产线基线）
		{
			const target = 1500
			const { id } = await db.collection(COL).add({ tag: 'runAll_readBig', blob: mkStr(readBigKB), ts: Date.now() })
			while (readBigDone < target && left()) { await db.collection(COL).doc(id).get(); readBigDone++ }
		}
		// 7) readProjected：投影只取小字段（与 readBig 比，判投影是否降 RU）
		{
			const target = 2500
			const { id } = await db.collection(COL).add({ tag: 'runAll_readProjected', blob: mkStr(readBigKB), ts: Date.now() })
			while (readProjDone < target && left()) {
				const r = await db.collection(COL).doc(id).field({ ts: true }).get()
				if (readProjDone === 0 && r && r.data && r.data[0]) projKeys = Object.keys(r.data[0])
				readProjDone++
			}
		}

		const t1 = Date.now()
		const writeA = exps.reduce((s, r) => s + r.a, 0)
		const writeB = exps.reduce((s, r) => s + r.b, 0)
		const ruWorks = readBigDone * Math.ceil(readBigKB / 4) + readProjDone * 1
		const ruFails = readBigDone * Math.ceil(readBigKB / 4) + readProjDone * Math.ceil(readBigKB / 4)
		return {
			method: 'runAll',
			完成情况: Date.now() < DEADLINE ? '全部跑完' : '触发110s上限·部分完成（已按实际 n_done 算期望，结论不受影响）',
			window: win(t0, t1),
			各写实验: exps,
			读实验: { readBig_n: readBigDone, readProjected_n: readProjDone, 投影返回字段: projKeys, readBig_期望RU: readBigDone * Math.ceil(readBigKB / 4) },
			总写WU_若A增量: writeA,
			总写WU_若B整文档: writeB,
			总读RU_若投影有效: ruWorks,
			总读RU_若投影无效: ruFails,
			判读: `把 window 起止换算成北京时间，去【费用中心>用量统计】读这一小时的「数据库写操作WU / 读操作RU」增量：
			· 写WU ≈ ${writeA}（无明显尖峰）→ A增量计费 → 大桶安全，桶可上100；≈ ${writeB} 量级暴涨 → B整文档计费 → 桶取60；
			· 读RU 增量 ≈ ${ruWorks} → 投影有效（按返回量，readProjected 几乎不耗）→ 读大桶不亏；≈ ${ruFails} → 投影无效（按扫描量）→ 倾向小桶；
			· 各写实验 a=若A的WU / b=若B的WU，对照看 set大文档/push进大桶 在 B 下是否暴涨。`
		}
	},

	/** 【清理】删除本表所有测试数据。测完务必调用。 */
	async cleanup() {
		const res = await db.collection(COL).where({ _id: dbCmd.exists(true) }).remove()
		return { method: 'cleanup', result: res }
	}
}
