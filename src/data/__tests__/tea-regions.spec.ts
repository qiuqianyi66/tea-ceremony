/**
 * T4.4 产区→茶映射：名茶按名称精确匹配茶库，未收录的不编造映射
 */
import { describe, it, expect } from 'vitest'
import { teaRegions, findTeaByName } from '../tea-regions'
import { teas } from '../teas'

describe('findTeaByName（T4.4 产区名茶 → 茶详情）', () => {
  it('按名称精确匹配茶库，返回唯一茶款', () => {
    const t = findTeaByName('铁观音')
    expect(t?.name).toBe('铁观音')
    expect(t?.id).toBeTruthy()
  })

  it('未收录茶名返回 undefined（不编造映射）', () => {
    expect(findTeaByName('普洱茶')).toBeUndefined()
    expect(findTeaByName('不存在的茶')).toBeUndefined()
  })

  it('全部产区名茶中能被匹配的，在茶库中名称唯一（跳转目标无歧义）', () => {
    const names = teas.map((t) => t.name)
    for (const region of teaRegions) {
      for (const f of region.famousTeas) {
        if (findTeaByName(f.name)) {
          expect(names.filter((n) => n === f.name).length).toBe(1)
        }
      }
    }
  })

  it('产区名茶至少存在一部分可跳转（防数据漂移导致链路全断）', () => {
    const matched = teaRegions.flatMap((r) => r.famousTeas).filter((f) => findTeaByName(f.name))
    expect(matched.length).toBeGreaterThan(0)
  })
})
