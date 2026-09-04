/**
 * 品鉴卡分享链接的编码 / 解码 / URL 构建单测。
 *
 * 覆盖：
 * - 从完整记录提取分享快照（剔除内部 id / 同步字段）
 * - base64url 编解码往返（含中文、可选字段、纯数字边界）
 * - 非法 / 恶意输入返回 null（防御性）
 * - 分享 URL 构建（含 BASE_URL 前缀）
 */
import { describe, it, expect } from 'vitest'
import type { TastingRecord } from '@/types/tasting'
import {
  toShareData,
  encodeShareData,
  decodeShareData,
  buildShareUrl,
  parseShareQuery,
  type TastingCardShareData,
} from '@/services/share'

function makeRecord(overrides: Partial<TastingRecord> = {}): TastingRecord {
  return {
    id: 'record_abc123',
    teaId: 'longjing',
    teaName: '西湖龙井',
    date: '2026-09-03',
    brewTemp: 80,
    brewTime: 45,
    infusions: 1,
    dimensions: { bitterness: 2, sweetness: 4, aftertaste: 5, body: 3, aroma: 5, rhyme: 4, shape: 3, mind: 5 },
    overallScore: 8.6,
    processFactor: 0.92,
    syncStatus: 'synced',
    ...overrides,
  }
}

describe('toShareData', () => {
  it('提取展示字段并剔除内部 id / 同步字段', () => {
    const share = toShareData(makeRecord())
    expect(share.teaName).toBe('西湖龙井')
    expect(share.overallScore).toBe(8.6)
    expect(share.processFactor).toBe(0.92)
    expect(share.dimensions.aftertaste).toBe(5)
    // 内部字段不应出现在快照里
    expect('id' in share).toBe(false)
    expect('teaId' in share).toBe(false)
    expect('syncStatus' in share).toBe(false)
  })

  it('保留可选字段（香气 / 笔记 / 天气 / 心情）', () => {
    const share = toShareData(makeRecord({
      aromaType: '花香',
      notes: '豆香清雅，回甘悠长。',
      weather: '晴',
      mood: '安静',
    }))
    expect(share.aromaType).toBe('花香')
    expect(share.notes).toBe('豆香清雅，回甘悠长。')
    expect(share.weather).toBe('晴')
    expect(share.mood).toBe('安静')
  })
})

describe('encodeShareData / decodeShareData 往返', () => {
  it('完整字段往返一致（含中文与可选字段）', () => {
    const share: TastingCardShareData = toShareData(makeRecord({
      aromaType: '兰香',
      notes: '入口清冽，喉韵绵长。',
      weather: '多云',
      mood: '专注',
    }))
    const encoded = encodeShareData(share)
    const decoded = decodeShareData(encoded)
    expect(decoded).toEqual(share)
  })

  it('无可选字段时往返一致', () => {
    const share: TastingCardShareData = toShareData(makeRecord())
    const decoded = decodeShareData(encodeShareData(share))
    expect(decoded).toEqual(share)
  })

  it('编码结果使用 base64url 字符集且可放入 URL', () => {
    const encoded = encodeShareData(toShareData(makeRecord()))
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/)
    expect(encoded.length).toBeGreaterThan(0)
  })

  it('纯数字 / 边界维度值往返不失真', () => {
    const share: TastingCardShareData = toShareData(makeRecord({
      overallScore: 10,
      processFactor: 1,
      brewTemp: 100,
      brewTime: 0,
      infusions: 3,
      dimensions: { bitterness: 1, sweetness: 1, aftertaste: 1, body: 1, aroma: 1, rhyme: 1, shape: 1, mind: 1 },
    }))
    expect(decodeShareData(encodeShareData(share))).toEqual(share)
  })
})

describe('decodeShareData 防御非法输入', () => {
  it('非法 base64 字符返回 null', () => {
    expect(decodeShareData('!!!not-base64!!!')).toBeNull()
  })

  it('合法 base64 但非 JSON 返回 null', () => {
    const bogus = encodeShareData({ teaName: 'x' } as unknown as TastingCardShareData)
    // 构造一段"合法 base64 但不是 JSON"：base64url 编码纯文本
    const textB64 = btoa('plain text not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeShareData(textB64)).toBeNull()
    void bogus
  })

  it('JSON 但缺少必需字段返回 null', () => {
    // 用 TextEncoder 构造（btoa 无法编码中文）
    const bytes = new TextEncoder().encode(JSON.stringify({ teaName: '龙井' }))
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    const partial = btoa(binary)
    expect(decodeShareData(partial)).toBeNull()
  })

  it('字段类型错误返回 null', () => {
    const wrongType = btoa(JSON.stringify({
      teaName: 123,
      date: '2026-01-01',
      brewTemp: 80,
      brewTime: 45,
      infusions: 1,
      dimensions: { bitterness: 2, sweetness: 4, aftertaste: 5, body: 3, aroma: 5, rhyme: 4, shape: 3, mind: 5 },
      overallScore: 8.6,
      processFactor: 0.9,
    })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeShareData(wrongType)).toBeNull()
  })
})

describe('buildShareUrl / parseShareQuery', () => {
  it('基于 BASE_URL 前缀构建绝对分享 URL', () => {
    const encoded = encodeShareData(toShareData(makeRecord()))
    const url = buildShareUrl(encoded, 'https://example.com/tea-ceremony/')
    expect(url).toMatch(/^https:\/\/example\.com\/tea-ceremony\/share\?r=/)
    const param = new URL(url).searchParams.get('r')
    expect(param).toBe(encoded)
  })

  it('base 无结尾斜杠时也能正确拼接', () => {
    const encoded = encodeShareData(toShareData(makeRecord()))
    const url = buildShareUrl(encoded, 'https://example.com/tea-ceremony')
    expect(url).toMatch(/^https:\/\/example\.com\/tea-ceremony\/share\?r=/)
  })

  it('parseShareQuery 从查询参数解码记录', () => {
    const share = toShareData(makeRecord({ weather: '晴', mood: '安静' }))
    const encoded = encodeShareData(share)
    expect(parseShareQuery(encoded)).toEqual(share)
  })

  it('parseShareQuery 对空 / 缺失参数返回 null', () => {
    expect(parseShareQuery(undefined)).toBeNull()
    expect(parseShareQuery(null)).toBeNull()
    expect(parseShareQuery('')).toBeNull()
    expect(parseShareQuery('broken-input')).toBeNull()
  })
})
