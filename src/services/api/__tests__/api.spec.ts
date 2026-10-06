/**
 * 批 C 前端联调：三域 API 对新后端 /api/v1 契约的适配回归
 * - ApiResponse 解包（data）
 * - auth：TokenVo.token → access_token；user.displayName(camelCase) → display_name
 * - teas：分页 data.items + TeaVo 真实汤色/干茶色映射（替换硬编码）
 * - records：分页解包 + client_id 必填幂等键（toRecordDto）
 * mock 策略：stub global fetch（跨进程边界），不 mock 内部协作者。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../auth'
import { teasApi } from '../teas'
import { recordsApi, toRecordDto } from '../records'

const OK = { code: 'OK', message: 'ok' }

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    text: async () => JSON.stringify(data),
    json: async () => data,
  } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('authApi（/api/v1/auth 契约适配）', () => {
  it('login：解包 ApiResponse.data，user.displayName 还原为 display_name', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...OK,
        data: {
          token: 'jwt-abc',
          expiresInSeconds: 1440,
          user: { id: 1, username: 'tea_lover', displayName: '茶友', level: 1, xp: 0 },
        },
      }),
    )

    const result = await authApi.login('tea_lover', 'secret123')
    expect(result).toEqual({
      access_token: 'jwt-abc',
      user: { id: 1, username: 'tea_lover', display_name: '茶友', level: 1, xp: 0 },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('register：请求体 displayName（camelCase，RegisterRequest 契约）', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...OK,
        data: {
          token: 'jwt-abc',
          expiresInSeconds: 1440,
          user: { id: 1, username: 'tea_user', displayName: '茶友', level: 1, xp: 0 },
        },
      }),
    )

    await authApi.register('tea_user', 'secret123', '茶友')
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(options.body as string)).toEqual({
      username: 'tea_user',
      password: 'secret123',
      displayName: '茶友',
    })
  })
})

describe('teasApi（/api/v1/teas 契约适配）', () => {
  it('list：分页解包 data.items，真实汤色/干茶色替换硬编码，请求含 category 筛选', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...OK,
        data: {
          items: [
            {
              id: 1,
              name: '西湖龙井',
              category: '绿茶',
              origin: '浙江杭州',
              best_temp: 80,
              best_time: 30,
              infusions: 5,
              flavor: ['豆香'],
              story: 's',
              description: 'd',
              dry_tea_color: '#7a5c3a',
              soup_color_min: '#d8e6a8',
              soup_color_max: '#a8c87a',
              altitude: 300,
              historical_period: '唐代',
              water_requirement: '软水',
            },
          ],
          total: 1,
          page: 1,
          size: 20,
        },
      }),
    )

    const list = await teasApi.list('绿茶')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      apiId: 1,
      name: '西湖龙井',
      type: '绿茶',
      origin: '浙江杭州',
      dryTeaColor: '#7a5c3a',
      soupColorMin: '#d8e6a8',
      soupColorMax: '#a8c87a',
      altitude: '300',
      historicalPeriod: '唐代',
      waterRequirement: '软水',
    })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url.startsWith('/api/v1/teas?')).toBe(true)
    const params = new URL(url, 'http://test.local').searchParams
    expect(params.get('category')).toBe('绿茶')
    expect(params.get('page')).toBe('1')
    expect(params.get('size')).toBe('100')
  })
})

describe('recordsApi（/api/v1/records 契约适配）', () => {
  it('list：分页解包 data.items，client_id 还原本地记录 id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...OK,
        data: {
          items: [
            {
              id: 11,
              client_id: 'rec-local-1',
              tea_id: 3,
              tea_name: '西湖龙井',
              brew_temp: 80,
              brew_time: 30,
              infusions: 5,
              overall_score: 8,
              process_factor: 0.9,
              created_at: '2026-10-06T10:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 20,
        },
      }),
    )

    const list = await recordsApi.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: 'rec-local-1',
      teaId: '3',
      teaApiId: 3,
      teaName: '西湖龙井',
      overallScore: 8,
      processFactor: 0.9,
      syncStatus: 'synced',
    })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('/api/v1/records?page=1&size=100')
  })

  it('create：toRecordDto 必填 client_id（幂等键），缺 id 时兜底生成', () => {
    const dto = toRecordDto({ id: 'rec-1', teaName: '龙井', teaApiId: 3, overallScore: 8 })
    expect(dto.client_id).toBe('rec-1')
    expect(dto.tea_id).toBe(3)
    expect(toRecordDto({ teaName: '未命名' }).client_id).toMatch(/^local-/)
  })

  it('create：响应解包 data（RecordVo）', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...OK,
        data: {
          id: 11,
          client_id: 'rec-local-1',
          tea_id: 3,
          tea_name: '西湖龙井',
          created_at: '2026-10-06T10:00:00Z',
        },
      }),
    )

    const created = await recordsApi.create({ id: 'rec-local-1', teaName: '西湖龙井' })
    expect(created).toMatchObject({ id: 11, client_id: 'rec-local-1', tea_name: '西湖龙井' })
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/records')
    expect(options.method).toBe('POST')
  })

  it('delete：路径含 v1 前缀与 id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...OK, data: { message: '已删除' } }))
    await recordsApi.delete(11)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/records/11')
    expect(options.method).toBe('DELETE')
  })
})
