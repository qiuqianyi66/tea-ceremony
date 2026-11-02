/**
 * 日期 / 数字格式化：只做字符串拼装，不依赖 Intl，也不假设运行时时区。
 * 所有时间取值走 Date 的本地 getter，测试时用本地构造的 Date 即可确定性断言。
 */

/** 两位补零 */
const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))

/** 小数位收敛到 toFixed 合法区间，非法值退化为 0 */
const clampDecimals = (decimals: number): number =>
  Number.isInteger(decimals) && decimals >= 0 && decimals <= 100 ? decimals : 0

/** 统一转 Date；非法输入返回 null（不抛异常） */
function toDate(input: Date | string | number): Date | null {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

const PATTERN_TOKEN = /YYYY|MM|DD|HH|mm|ss/g

/**
 * 按本地时间格式化日期。
 * @param input Date / 时间戳 / 可被 Date 解析的字符串
 * @param pattern 支持 YYYY MM DD HH mm ss，默认 'YYYY-MM-DD'
 * @returns 非法日期返回空串
 */
export function formatDate(input: Date | string | number, pattern = 'YYYY-MM-DD'): string {
  const date = toDate(input)
  if (date === null) return ''
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  }
  return pattern.replace(PATTERN_TOKEN, (token) => tokens[token] ?? token)
}

/**
 * 短日期：`2026/11/2`（不补零，中文界面惯例）。
 * 取代散落各处的 `new Date(x).toLocaleDateString()`——后者输出随运行时 locale 变，
 * 既不可测也不可控。非法输入返回空串。
 */
export function formatDateShort(input: Date | string | number): string {
  const date = toDate(input)
  if (date === null) return ''
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY

/**
 * 相对时间：1 分钟内为「刚刚」，之后按分钟 / 小时 / 天分层，超过 30 天回落到日期。
 * 未来时间用「后」后缀；未来 1 分钟内同样返回「刚刚」（不做「即将」特例）。
 * @param now 参照时间，默认当前时刻；测试时显式传入以保证确定性
 */
export function formatRelativeTime(
  input: Date | string | number,
  now: Date | number = Date.now(),
): string {
  const date = toDate(input)
  if (date === null) return ''
  const nowMs = now instanceof Date ? now.getTime() : now
  const diff = nowMs - date.getTime()
  const abs = Math.abs(diff)
  const suffix = diff >= 0 ? '前' : '后'
  if (abs < MINUTE) return '刚刚'
  if (abs < HOUR) return `${Math.floor(abs / MINUTE)} 分钟${suffix}`
  if (abs < DAY) return `${Math.floor(abs / HOUR)} 小时${suffix}`
  if (abs < MONTH) return `${Math.floor(abs / DAY)} 天${suffix}`
  return formatDate(date, 'YYYY-MM-DD')
}

/**
 * 千分位数字。NaN / Infinity 返回 '0'，负号独立于分组。
 * @param decimals 小数位（0-100，越界退化为 0）
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0'
  const [intPart = '0', decPart] = Math.abs(value).toFixed(clampDecimals(decimals)).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const sign = value < 0 ? '-' : ''
  return decPart === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${decPart}`
}

/** 去掉小数尾部的 0 与孤立小数点（仅在含小数点时处理） */
const trimZeros = (scaled: string): string =>
  scaled.includes('.') ? scaled.replace(/0+$/, '').replace(/\.$/, '') : scaled

/**
 * 万 / 亿 缩写：12345 → '1.2万'，123456789 → '1.2亿'。
 * 绝对值小于 1 万时回落千分位；负数保留符号。
 */
export function formatCompactNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  const unit =
    abs >= 1e8 ? { size: 1e8, label: '亿' } : abs >= 1e4 ? { size: 1e4, label: '万' } : null
  if (unit === null) return formatNumber(value)
  return `${trimZeros((value / unit.size).toFixed(clampDecimals(decimals)))}${unit.label}`
}
