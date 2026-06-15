/**
 * @module period-key 邀新页周期键生成（北京时间，UTC+8）
 *
 *   - day:   YYYY-MM-DD     e.g. 2026-06-03
 *   - week:  YYYY-WNN       e.g. 2026-W23   （ISO 8601 周，周一为首日）
 *
 * ⚠️ 时区无关实现（不依赖运行时时区）。北京时间 = UTC + 8h，全程用 UTC 毫秒做纯算术：
 *   「+8h 偏移 → 取整/读 getUTC* 字段 → 再 -8h 还原真实 UTC 毫秒」。
 *   这样无论跑在 UTC 服务器（线上阿里云）还是 UTC+8 本地（HBuilderX 本地云函数调试）都正确。
 *
 * 【为什么不用 dayjs().add(8,'hour').startOf('day').subtract(8,'hour')】
 *   旧写法假设「运行环境是 UTC」，靠 dayjs 在 UTC 下 startOf('day') 取北京日界。一旦运行环境是
 *   UTC+8（本地调试机），dayjs 的 startOf 用的是本机 UTC+8 时区，导致 +8h 被「双重偏移」，
 *   算出的「今日 00:00」会早 8 小时 → 昨晚的记录被错算进「今日邀请」。改为纯 UTC 毫秒算术即根治。
 */

const DAY = 24 * 3600 * 1000
const OFF = 8 * 3600 * 1000          // 北京相对 UTC 的偏移（+8h）
const pad2 = n => String(n).padStart(2, '0')

/* 把时间戳偏到「北京视角」的 Date：其 getUTC* 字段即北京的年/月/日/时/分/秒。
 * date 不传 = 当前时间；支持 Date / 毫秒数 / 字符串。 */
function bjDate (date) {
	const ms = date === undefined ? Date.now() : (+new Date(date))
	return new Date(ms + OFF)
}

function getDayKey (date) {
	const b = bjDate(date)
	return `${ b.getUTCFullYear() }-${ pad2(b.getUTCMonth() + 1) }-${ pad2(b.getUTCDate()) }`
}

/**
 * ISO 8601 周键（周一为一周首日）。
 * 取该周「周四」所在年作为 ISO 周年；周号 = 周四距该年 1/1 的天数 / 7 向下取整 + 1。
 * 全程用「北京偏移后的毫秒」运算（getUTCDay/getUTCFullYear 读出的即北京日历字段）。
 */
function getWeekKey (date) {
	const ms = date === undefined ? Date.now() : (+new Date(date))
	const dayStart = Math.floor((ms + OFF) / DAY) * DAY    // 北京当日 00:00（偏移毫秒）
	const dow = new Date(dayStart).getUTCDay() || 7         // dayjs 同口径：周日记为 7
	const thu = dayStart + (4 - dow) * DAY                  // 本周周四（偏移毫秒）
	const isoYear = new Date(thu).getUTCFullYear()
	const weekNo = Math.floor((thu - Date.UTC(isoYear, 0, 1)) / DAY / 7) + 1
	return `${ isoYear }-W${ pad2(weekNo) }`
}

/**
 * 北京自然日 00:00 对应的真实 UTC 时间戳（ms）。
 * 用于「今日邀请」按 invite_time >= 该值过滤，避免另存日期字段。
 */
function getBeijingDayStart (date) {
	const ms = date === undefined ? Date.now() : (+new Date(date))
	return Math.floor((ms + OFF) / DAY) * DAY - OFF
}

/**
 * 北京自然年 1 月 1 日 00:00 对应的真实 UTC 时间戳（ms）。
 * 用于「历史邀请只看今年」按 invite_time >= 该值过滤。
 */
function getBeijingYearStart (date) {
	const b = bjDate(date)
	return Date.UTC(b.getUTCFullYear(), 0, 1) - OFF
}

module.exports = { getDayKey, getWeekKey, getBeijingDayStart, getBeijingYearStart }
