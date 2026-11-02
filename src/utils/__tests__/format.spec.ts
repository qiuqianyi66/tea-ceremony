/**
 * 日期 / 数字格式化单测。时间断言一律用本地构造的 Date，避免时区耦合。
 */
import { describe, expect, it } from 'vitest'
import { formatCompactNumber, formatDate, formatNumber, formatRelativeTime } from '@/utils/format'

describe('formatDate', () => {
  const sample = new Date(2024, 0, 5, 8, 9, 7)

  it('默认输出 YYYY-MM-DD', () => {
    expect(formatDate(sample)).toBe('2024-01-05')
  })

  it('按 pattern 输出并补零', () => {
    expect(formatDate(sample, 'YYYY/MM/DD HH:mm:ss')).toBe('2024/01/05 08:09:07')
    expect(formatDate(sample, 'HH:mm')).toBe('08:09')
  })

  it('接受时间戳与字符串', () => {
    expect(formatDate(sample.getTime(), 'YYYY-MM-DD')).toBe('2024-01-05')
    expect(formatDate('2024-01-05T08:09:07', 'HH:mm:ss')).toBe('08:09:07')
  })

  it('未知 token 原样保留', () => {
    expect(formatDate(sample, 'YYYY Q')).toBe('2024 Q')
  })

  it('非法日期返回空串而不抛异常', () => {
    expect(formatDate('not-a-date')).toBe('')
    expect(formatDate(new Date(Number.NaN))).toBe('')
  })
})

describe('formatRelativeTime', () => {
  const base = new Date(2024, 5, 1, 12, 0, 0)

  it('一分钟内为刚刚（含未来方向）', () => {
    expect(formatRelativeTime(base, base)).toBe('刚刚')
    expect(formatRelativeTime(base.getTime() - 59_000, base)).toBe('刚刚')
    expect(formatRelativeTime(base.getTime() + 59_000, base)).toBe('刚刚')
  })

  it('分钟 / 小时 / 天分层', () => {
    expect(formatRelativeTime(base.getTime() - 60_000, base)).toBe('1 分钟前')
    expect(formatRelativeTime(base.getTime() - 5 * 60_000, base)).toBe('5 分钟前')
    expect(formatRelativeTime(base.getTime() - 3 * 3_600_000, base)).toBe('3 小时前')
    expect(formatRelativeTime(base.getTime() - 2 * 86_400_000, base)).toBe('2 天前')
  })

  it('未来时间用「后」后缀', () => {
    expect(formatRelativeTime(base.getTime() + 10 * 60_000, base)).toBe('10 分钟后')
  })

  it('超过 30 天回落到日期，非法输入返回空串', () => {
    expect(formatRelativeTime(base.getTime() - 40 * 86_400_000, base)).toBe('2024-04-22')
    expect(formatRelativeTime('bad-date', base)).toBe('')
  })
})

describe('formatNumber', () => {
  it('千分位与小数位', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(-1234.5, 2)).toBe('-1,234.50')
  })

  it('非法数字与越界小数位降级', () => {
    expect(formatNumber(Number.NaN)).toBe('0')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('0')
    expect(formatNumber(1.5, -1)).toBe('2')
  })
})

describe('formatCompactNumber', () => {
  it('万 / 亿缩写并去掉多余小数零', () => {
    expect(formatCompactNumber(9999)).toBe('9,999')
    expect(formatCompactNumber(10000)).toBe('1万')
    expect(formatCompactNumber(12345)).toBe('1.2万')
    expect(formatCompactNumber(123456789)).toBe('1.2亿')
    expect(formatCompactNumber(150000000, 2)).toBe('1.5亿')
  })

  it('负数保留符号，0 与非法值走边界', () => {
    expect(formatCompactNumber(-12345)).toBe('-1.2万')
    expect(formatCompactNumber(0)).toBe('0')
    expect(formatCompactNumber(Number.NaN)).toBe('0')
  })
})
