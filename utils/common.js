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
export const listToTree = (list, id="fatherId") => {
	let result = []
	const map = {}

	const childrenList = JSON.parse(JSON.stringify(list)).filter(i => i.category_id)

	list = list.sort((a, b) => a.id - b.id)

	list.forEach(item => {
	    item.children = []
		map[item.id] = item
	})

	for (const i of list) {
	    if (!i[id]) {
	        result.push(i)
	    } else {
	        if (map[i[id]]) {
	            map[i[id]].children.push(i)
	        }
	    }

	}

	result.unshift({
		id: 2222222,
		title: '最新',
		children: [...childrenList].sort((a, b) => b.id - a.id)
	})

	result.unshift({
		id: 11111111,
		title: '全部',
		children: [...childrenList].sort((a, b) => b.hot_count - a.hot_count)
	})

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
