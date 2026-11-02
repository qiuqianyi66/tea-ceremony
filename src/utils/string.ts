/**
 * 字符串工具：按码点处理（中文 / emoji 均按 1 个字符计），全部为纯函数。
 */

/** 按码点拆字符，避免代理对被截断成半个字符 */
const chars = (text: string): string[] => Array.from(text)

/**
 * 截断并追加省略号。max 为保留的正文字符数（不含省略号）。
 * @param max <= 0 时返回空串；文本长度不超过 max 时原样返回
 */
export function truncate(text: string, max: number, ellipsis = '…'): string {
  if (max <= 0) return ''
  const list = chars(text)
  if (list.length <= max) return text
  return `${list.slice(0, max).join('')}${ellipsis}`
}

/** 首字符大写，其余原样保留 */
export function capitalize(text: string): string {
  const [first = '', ...rest] = chars(text)
  return `${first.toUpperCase()}${rest.join('')}`
}

/** 拆词：非字母数字视为分隔符，并在「小写/数字 → 大写」处断开 */
function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word !== '')
}

/** hello world / hello-world / HelloWorld → helloWorld */
export function camelCase(input: string): string {
  return words(input)
    .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word.toLowerCase())))
    .join('')
}

/** helloWorld / Hello World → hello-world */
export function kebabCase(input: string): string {
  return words(input)
    .map((word) => word.toLowerCase())
    .join('-')
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** HTML 转义：正则一次扫描，& 先于其他字符替换，不会二次转义 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}
