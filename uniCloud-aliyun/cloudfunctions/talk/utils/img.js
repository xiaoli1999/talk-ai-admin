/**
 * @file img 图片画风
 * @description 图片预设风格列表
 * @copyright 采黎
 * @author 小黎
 */

/* todo 携带风格参数 */
const list = [
	{
		id: 'c-dm',
		type: 'coze',
		name: '动漫',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-dm.png',
		new: false,
		cb: 6,
		style: 'anime style.'
	},
	{
		id: 'c-gf',
		type: 'coze',
		name: '国风',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-gf.png',
		new: false,
		cb: 6,
		style: 'anime,ancient Chinese.'
	},
	{
		id: 'c-sm',
		type: 'coze',
		name: '水墨',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-sm.png',
		new: false,
		cb: 6,
		style: '2d anime,Chinese ink brush.'
	},
	{
		id: 'm-mh',
		type: 'minimax',
		name: '漫画',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/m-mh.png',
		new: false,
		cb: 6,
		style: '漫画'
	},
	{
		id: 'c-mc',
		type: 'coze',
		name: '萌宠',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-mc.png',
		new: false,
		cb: 6,
		style: 'anime,pet animal.'
	},
	{
		id: 'c-tyrx',
		type: 'coze',
		name: '通用人像',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-tyrx.png',
		new: false,
		cb: 6,
		style: ''
	},
	{
		id: 'c-sbpk',
		type: 'coze',
		name: '赛博朋克',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-sbpk.png',
		new: false,
		cb: 6,
		style: 'cyberpunk style,anime.'
	},
	{
		id: 'c-zqpk',
		type: 'coze',
		name: '蒸汽朋克',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-zqpk.png',
		new: false,
		cb: 6,
		style: 'steampunk,anime.'
	},
	{
		id: 'c-jjwl',
		type: 'coze',
		name: '机甲未来',
		url: 'https://mp-544657ac-b0d5-44ca-838d-e1ba5e17094f.cdn.bspapp.com/assets/create/styles/c-jjwl.png',
		new: false,
		cb: 6,
		style: 'Cyberpunk,Mecha, Future,anime.'
	},

]

const imgList = JSON.parse(JSON.stringify(list)).map(item => {
	delete item.type
	delete item.style

	return item
})

// 将list数组转换为对象，id为数组的key,写在前面
const imgData = list.reduce((obj, current) => ({ ...obj, [current.id]: current }), {})

module.exports = {
	imgList,
	imgData
}
