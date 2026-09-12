/**
 * tea store 离线闭环测试：src/stores/tea.ts
 * 覆盖：saveRecord 写入 IndexedDB、后端同步成功/失败、防重复、XP 与成就联动。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTeaStore } from '@/stores/tea'
import { useProgressStore } from '@/stores/progress'
import { useTasteStore } from '@/stores/taste'
import { historyStorage, initDB, db } from '@/services/storage'
import { recordsApi } from '@/services/api'
import { teas } from '@/data/teas'

const longjing = teas[0]!

describe('teaStore.saveRecord 离线保存闭环', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    // 确保数据库打开并清空，保证用例隔离。
    await initDB()
    await Promise.all([
      db.tastings.clear(),
      db.achievements.clear(),
      db.userXp.clear(),
      db.settings.clear(),
      db.collectedWare.clear(),
    ])
  })

  it('保存成功：记录写入本地 IndexedDB 且同步状态为 synced', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    store.selectTea(longjing)
    vi.spyOn(recordsApi, 'create').mockResolvedValue({ id: 1 } as never)

    const record = await store.saveRecord('豆香', '很好喝', '晴', '平静')

    expect(record.teaName).toBe(longjing.name)
    expect(record.overallScore).toBeGreaterThanOrEqual(1)
    expect(store.history).toHaveLength(1)
    expect(store.history[0]?.syncStatus).toBe('synced')
    // 首次品鉴获得 XP（基础 10）
    expect(progress.userXp).toBeGreaterThanOrEqual(10)
  })

  it('后端同步失败：记录保留本地、标记 failed，且可重试成功', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    store.selectTea(longjing)
    vi.spyOn(recordsApi, 'create').mockRejectedValue(new Error('network down'))

    await store.saveRecord()
    expect(store.history).toHaveLength(1)
    expect(store.history[0]?.syncStatus).toBe('failed')
    expect(store.history[0]?.syncError).toBeTruthy()

    // 网络恢复后重试
    vi.mocked(recordsApi.create).mockResolvedValue({ id: 1 } as never)
    const result = await historyStorage.syncPending()
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(0)

    await store.loadHistory()
    expect(store.history[0]?.syncStatus).toBe('synced')
  })

  it('同茶同日重复保存不产生重复记录（幂等）', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    store.selectTea(longjing)
    vi.spyOn(recordsApi, 'create').mockResolvedValue({ id: 1 } as never)

    await store.saveRecord()
    await store.saveRecord()

    expect(store.history).toHaveLength(1)
    expect(recordsApi.create).toHaveBeenCalledTimes(1)
  })

  it('记录包含正确的评分、工艺系数与八维评分', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    const taste = useTasteStore()
    store.selectTea(longjing)
    vi.spyOn(recordsApi, 'create').mockResolvedValue({ id: 1 } as never)

    const expectedScore = store.calculateScore()
    const record = await store.saveRecord()

    expect(record.overallScore).toBe(expectedScore)
    expect(record.processFactor).toBe(store.processFactor)
    expect(record.dimensions).toEqual(taste.dimensions)
  })

  it('首次品鉴解锁 first_brew 成就', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    // 真实场景由 App 启动时 loadHistory 初始化成就列表。
    await store.loadHistory()
    store.selectTea(longjing)
    vi.spyOn(recordsApi, 'create').mockResolvedValue({ id: 1 } as never)

    await store.saveRecord()

    const firstBrew = progress.achievements.find(a => a.id === 'first_brew')
    expect(firstBrew?.unlocked).toBe(true)
    expect(progress.newAchievement).toBe('first_brew')
  })

  it('未选茶时保存记录抛出错误', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    await expect(store.saveRecord()).rejects.toThrow('未选择茶叶')
  })
})

describe('teaStore 节气打卡', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    await initDB()
    await db.settings.clear()
  })

  it('首次打卡当前节气成功并写入 IndexedDB', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    await progress.loadSolarCheckins()

    const ok = await progress.checkInSolarTerm('liqiu')

    expect(ok).toBe(true)
    expect(progress.solarCheckins['liqiu']).toBeTruthy()
    // 持久化：重新加载仍能读回
    await progress.loadSolarCheckins()
    expect(progress.solarCheckins['liqiu']).toBeTruthy()
  })

  it('同一节气重复打卡返回 false 且不覆盖原记录', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    await progress.loadSolarCheckins()

    await progress.checkInSolarTerm('liqiu')
    const firstDate = progress.solarCheckins['liqiu']
    const ok = await progress.checkInSolarTerm('liqiu')

    expect(ok).toBe(false)
    expect(progress.solarCheckins['liqiu']).toBe(firstDate)
  })

  it('不同节气可分别打卡，互不影响', async () => {
    const store = useTeaStore()
    const progress = useProgressStore()
    await progress.loadSolarCheckins()

    await progress.checkInSolarTerm('liqiu')
    await progress.checkInSolarTerm('bailu')

    expect(Object.keys(progress.solarCheckins).sort()).toEqual(['bailu', 'liqiu'])
  })
})
