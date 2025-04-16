/**
 * @file model 模型配置
 * @description 模型列表、配置、key等
 * @copyright 采黎
 * @author 小黎
 */

const modelList = [
	{
		id: 'new-love',
		name: '探索-纯爱',
		desc: '纯爱模型，适用于聊天场景。',
		memory: 1000,
		cardMemory: 1000,
		tagList: ['极速', '默认记忆', '低自由', '低指令', '短回复'],
		// tagList: ['极速', '中自由', '羞涩', '细腻'],
		price: 1,
		cdRange: [0, 2],
		closeValue: 0,
		isVip: false,
		allowDefault: true,
		allowUseCard: false
	},
	// {
	// 	id: 'original',
	// 	name: '原创',
	// 	desc: '怀旧模型，旧版本主力模型，适用于聊天场景。',
	// 	memory: 1500,
	// 	cardMemory: 1500,
	// 	tagList: ['极速', '默认记忆', '低自由', '低指令', '短回复'],
	// 	// tagList: ['极速', '低自由', '真人感', '怀旧版'],
	// 	price: 1,
	// 	cdRange: [0, 2],
	// 	closeValue: 0,
	// 	isVip: false,
	// 	allowDefault: true,
	// 	allowUseCard: false
	// },
	{
		id: 'new-shy',
		name: '探索-羞涩',
		desc: '羞涩模型，相较于纯爱模型聊天效果、记忆力都有所提升，适用于聊天场景。',
		memory: 3000,
		cardMemory: 3000,
		tagList: ['快速', '3倍记忆', '中自由', '低指令', '短回复'],
		// tagList: ['极速', '中自由', '羞涩', '细腻'],
		price: 1.5,
		cdRange: [0, 6],
		closeValue: 0,
		isVip: false,
		allowDefault: true,
		allowUseCard: true
	},
	{
		id: 'original-max',
		name: '原创-升级',
		desc: '相较于原创模型，在聊天、记忆力、自由度等方面皆有所提升，适用于聊天场景。',
		memory: 5000,
		cardMemory: 5000,
		tagList: ['极速', '5倍记忆', '中自由', '低指令', '短回复'],
		// tagList: ['3倍记忆', '中自由', '真人感', '智能'],
		price: 1.5,
		cdRange: [0, 6],
		closeValue: 0,
		isVip: true,
		allowDefault: false,
		allowUseCard: false
	},
	{
		id: 'original-dream',
		name: '原创-梦境',
		desc: '最强模型！在记忆力、自由度、指令、环境氛围、肢体动作、心理细节等方面大幅度提升，适用于聊天、剧情场景。',
		memory: 10000,
		cardMemory: 5000,
		tagList: ['标准', '10倍记忆', '高自由', '高指令', '长回复'],
		// tagList: ['3倍记忆', '中自由', '真人感', '智能'],
		price: 3,
		cdRange: [0, 24],
		closeValue: 0,
		isVip: true,
		allowDefault: false,
		allowUseCard: true
	},
	{
		id: 'new-pro',
		name: '探索-沉浸',
		desc: '沉浸模型，在记忆力、自由度、指令等方面优于探索-羞涩模型，适用于聊天、剧情场景。',
		memory: 8000,
		cardMemory: 8000,
		tagList: ['标准', '8倍记忆', '中自由', '中指令', '中回复'],
		// tagList: ['5倍记忆', '中自由', '中指令', '中回复'],
		price: 2,
		cdRange: [0, 10],
		closeValue: 0, // 50
		isVip: true,
		allowDefault: false,
		allowUseCard: false
	},
	{
		id: 'new-max',
		name: '探索-剧情',
		desc: '探索系列最强模型！在记忆力、自由度、指令、心理细节等方面大幅度提升，适用于聊天、剧情场景。',
		memory: 10000,
		cardMemory: 5000,
		tagList: ['较慢', '10倍记忆', '高自由', '高指令', '长回复'],
		// tagList: ['10倍记忆', '高自由', '高指令', '长回复'],
		price: 2.5,
		cdRange: [0, 30],
		closeValue: 50, // 100
		isVip: true,
		allowDefault: false,
		allowUseCard: true
	},
]

const modelConfig = {
	'original': {
		model: 'abab6.5t-chat', //
		apiKey: '',
		max_tokens: 512,
		temperature: 0.88,
		top_p: 0.92,
	},
	'original-max': {
		model: 'abab5.5s-chat', //
		apiKey: '',
		max_tokens: 512,
		temperature: 0.9,
		top_p: 0.96,
	},
	'original-dream': {
		model: 'MiniMax-Text-01', //
		apiKey: '',
		max_tokens: 512,
		temperature: 0.92,
		top_p: 0.96,
	},

	'new-love': {
		model: 'ep-20250114102128-fdw5x', // 当前为 采黎AI
		apiKey: 'a220cb08-0bf6-439a-a38b-67f10641bdb8',
		max_tokens: 256,
		temperature: 0.8,
		top_p: 0.9,
	},
	'new-shy': {
		model: 'ep-20250123181436-tcqnr', // 当前为采黎AI
		apiKey: 'a220cb08-0bf6-439a-a38b-67f10641bdb8',
		max_tokens: 256,
		temperature: 0.88,
		top_p: 0.96,
	},
	'new-pro': {
		model: 'ep-20250114102204-8xbzl', // 当前为采黎AI
		apiKey: 'a220cb08-0bf6-439a-a38b-67f10641bdb8',
		max_tokens: 512,
		temperature: 0.88,
		top_p: 0.9,
	},
	'new-max': {
		model: 'ep-20250114102243-8cjpx', // 当前为采黎AI
		apiKey: 'a220cb08-0bf6-439a-a38b-67f10641bdb8',
		max_tokens: 1024,
		temperature: 0.98,
		top_p: 0.98,
	}
}

const apiData = [
	/**
	 * love（Doubao-lite-4k | character-240828）
	 * shy（Doubao-pro-32k | character-240828）
	 * pro（Doubao-lite-32k | 240828）
	 * max（Doubao-lite-32k | 240628）
	 *
	 * 畅聊卡专属模型
	 * shy
	 */
	{
		name: '采黎AI-小黎',
		apiKey: '626fdfe7-b667-4602-9275-7708934101b9',
		// love: 'ep-20250107110258-gwmsv', 已使用完
		// shy: 'ep-20250123180751-tlb2h', 已使用完
		pro: 'ep-20241211171421-kq97x',
		max: 'ep-20241211171734-gq6nj'
	},
	{
		name: '采黎AI-瑶1',
		apiKey: '92b98ba9-f0e2-42c2-b684-581002d0053a',
		// love: 'ep-20250114100931-qhntg', 已使用完
		shy: 'ep-20250123181033-csxm5',
		pro: 'ep-20250114101032-r824b',
		max: 'ep-20250114101147-slcns'
	},
	{
		name: '采黎AI-瑶2',
		// apiKey: 'e16af412-e0c1-4061-b545-fda4ea2e21ea', 已经用完
		love: 'ep-20250114101609-xtktl',
		shy: 'ep-20250123181309-rl9lc',
		pro: 'ep-20250114101702-djvjp',
		max: 'ep-20250114101736-kmxk2'
	},
	{
		name: '采黎AI',
		apiKey: 'a220cb08-0bf6-439a-a38b-67f10641bdb8',
		love: 'ep-20250114102128-fdw5x',
		shy: 'ep-20250123181436-tcqnr',
		pro: 'ep-20250114102204-8xbzl',
		max: 'ep-20250114102243-8cjpx'
	}
]

module.exports = {
	modelList,
	modelConfig
}
