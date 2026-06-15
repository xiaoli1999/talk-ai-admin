/**
 * @module period-key 排行榜周期键生成（北京时间，UTC+8）
 *
 *   - hour:  YYYY-MM-DD-HH    e.g. 2026-05-17-14
 *   - day:   YYYY-MM-DD        e.g. 2026-05-17
 *   - week:  YYYY-WNN          e.g. 2026-W20    （ISO 8601 周，周一为首日）
 *   - month: YYYY-MM           e.g. 2026-05
 *
 * Why 北京时间：业务在国内，用户对"今天/本周"的预期就是中国日历。
 * 注意：该工具同时存在于 ranking 和 talk 两个云函数中，保持一致即可（算法稳定）。
 */

const BEIJING_OFFSET_MS = 8 * 3600 * 1000

function toBeijing (date = new Date()) {
	return new Date(date.getTime() + BEIJING_OFFSET_MS)
}

const pad2 = n => String(n).padStart(2, '0')

function getHourKey (date = new Date()) {
	const d = toBeijing(date)
	return `${ d.getUTCFullYear() }-${ pad2(d.getUTCMonth() + 1) }-${ pad2(d.getUTCDate()) }-${ pad2(d.getUTCHours()) }`
}

function getDayKey (date = new Date()) {
	const d = toBeijing(date)
	return `${ d.getUTCFullYear() }-${ pad2(d.getUTCMonth() + 1) }-${ pad2(d.getUTCDate()) }`
}

function getMonthKey (date = new Date()) {
	const d = toBeijing(date)
	return `${ d.getUTCFullYear() }-${ pad2(d.getUTCMonth() + 1) }`
}

/**
 * ISO 8601 周键（周一为一周首日）
 * 算法：取目标日所在周的周四，该周四所在年即 ISO 周年；ISO 周编号 = (周四 - 当年1月1日)/7 向上取整
 */
function getWeekKey (date = new Date()) {
	const d = toBeijing(date)
	const dayOfWeek = d.getUTCDay() || 7
	d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
	const isoYear = d.getUTCFullYear()
	const yearStart = new Date(Date.UTC(isoYear, 0, 1))
	const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
	return `${ isoYear }-W${ pad2(weekNo) }`
}

function getAllKeys (date = new Date()) {
	return {
		hour:  getHourKey(date),
		day:   getDayKey(date),
		week:  getWeekKey(date),
		month: getMonthKey(date)
	}
}

module.exports = { getHourKey, getDayKey, getWeekKey, getMonthKey, getAllKeys }
