/**
 * @file common.ts 公共方法
 * @description 公共方法、函数等
 * @author 小黎
 * @copyright 采黎科技
 * @createDate 2023-12-03 11:40
 */
import dayjs from 'dayjs'

/**
 * @function debounce 函数防抖
 * @param { Object } func 函数
 * @param { Number } delay 延迟时间
 */
export function debounce(func, delay = 500) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * @function throttle 函数节流
 * @param { Object } func 函数
 * @param { Number } delay 节流时间
 */
export function throttle(func, delay = 500) {
  let lastExecTime = 0;
  return function (...args) {
    const currentTime = Date.now();
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    }
  };
}


/**
 * @function createUUID 生成uuid
 * @description 默认创建5位uuid
 * @param { Number } size 默认为5
 * @returns { String } uuid 返回uuid
 */
export const createUUID = (size = 5) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let uuid = '';
  for (let i = 0; i < size; i++) {
    uuid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return uuid;
}

/**
 * @function createAvatarKey 生成头像链接key
 * @description 当前时间+uuid，生成key
 * @returns { String } key 返回key
 */
export const createAvatarKey = () => {
  const date = dayjs().format('YYYY-MM-DD-HH-mm-ss')

  return date + '-' + createUUID()
}

/**
 * @function listToTree 列表树形化
 * @description 将扁平列表转化为tree结构形
 * @returns { Array } result 树形话后的列表
 */
export const listToTree = (list, fatherId="category_id") => {
	let result = []
	const map = {}

	list = list.sort((a, b) => a.sort - b.sort)

	list.forEach(item => {
		item.children = []
		map[item._id] = item
	})

	for (const i of list) {
		if (!i[fatherId] || i[fatherId] === 'null') {
			result.push(i)
		} else {
			if (map[i[fatherId]]) {
				map[i[fatherId]].children.push(i)
			}
		}

	}

	return result
}

/**
 * @function formatKNumber 数字格式化为单位千
 * @description 小于1000则不格式化，大于1000进行格式化
 * @returns { Number } result 树形话后的列表
 */
export const formatKNumber = (num) => {
	if (!num) return 0

	return num > 1000 ? (num / 1000).toFixed(1) + 'k' : num
}

/**
 * @function montageImgUrl 拼接图片url
 * @param { String } url 原始图片地址
 * @param { Number } w 图片宽
 * @return  { String } url 拼接后的图片地址
 */
export const montageImgUrl = (url = '', w = 100) => {
	if (!url) return url

	let resizeUrl = 'x-oss-process=image/format,webp/resize,'
	url += url.includes('?') ? '&' : '?'
	resizeUrl += `w_${w}`

	return `${url}${resizeUrl}`
}

/**
 * @function copyText 复制文本
 * @description
 * @param { String } text 要复制的文本
 * @return
 */
export const copyText = (text = '') => {
	return new Promise((resolve, reject) => {
		try {
			const input = document.createElement('input')
			input.value = text
			input.style.position = 'absolute'
			input.style.left = '-99999px'
			document.body.appendChild(input)
			input.select()
			document.execCommand('Copy')
			document.body.removeChild(input)
			return resolve(true)
		} catch (e) {
			return reject(false)
		}
	})
}
