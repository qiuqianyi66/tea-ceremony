---
last_updated: 2026-11-02
status: active
owner: yanha
---

# Services 骨架

解决「业务计算散落在组件里、错误处理各写一套」的问题：service 只放纯函数与 IO 收口，显式返回类型，统一用 `@/` 别名导入。

## 1. 纯函数 + 显式返回类型

service 里不碰 DOM、不读全局状态。输入输出全靠参数与返回值，这样单测不需要挂载组件。

```ts
import type { TastingRecord } from '@/types/tasting'

/**
 * 冲泡小结：统计总泡数与本轮最高分茶名。
 * @param records 同一次茶席的品鉴记录
 * @returns 总泡数与最高分记录对应的茶名（无记录时为空串）
 */
export function summarizeSession(records: readonly TastingRecord[]): {
  total: number
  bestTea: string
} {
  if (records.length === 0) {
    return { total: 0, bestTea: '' }
  }

  let best = records[0]
  for (const record of records) {
    if (record.overallScore > best.overallScore) best = record
  }

  return { total: records.length, bestTea: best.teaName }
}
```

返回类型写成对象字面量或具名 `interface`，不用推断。参数用 `readonly T[]` 表明不修改入参。

## 2. 错误处理：两种收口

**存储类**（localStorage / IndexedDB）：失败即降级，返回 `null`，不打断主流程。参考 `src/services/authStorage.ts`。

```ts
const KEY = 'tea-brew-draft'

export interface BrewDraft {
  teaName: string
  brewTemp: number
}

/** 读取冲泡草稿；损坏或不可用时返回 null。 */
export function loadBrewDraft(): BrewDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (typeof data === 'object' && data !== null && 'teaName' in data) {
      return data as BrewDraft
    }
    return null
  } catch {
    return null
  }
}

/** 保存冲泡草稿；隐私模式或存储满时静默失败。 */
export function saveBrewDraft(draft: BrewDraft): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}
```

**契约类**（调用方必须知道参数错了）：抛 `Error`，消息带字段名与非法值。

```ts
/** 校验并归一化水温：允许 60-100℃，越界抛错。 */
export function normalizeBrewTemp(temp: number): number {
  if (!Number.isFinite(temp)) {
    throw new Error(`水温必须是有限数值，收到 ${String(temp)}`)
  }
  if (temp < 60 || temp > 100) {
    throw new Error(`水温需在 60-100℃ 之间，收到 ${temp}℃`)
  }
  return Math.round(temp)
}
```

调用方在 store 的 action 里 `try/catch` 收口成 UI 文案，service 本身不产 UI 文案。

## 3. 别名与类型声明

- 一律 `@/` 别名：`import type { TastingRecord } from '@/types/tasting'`。
- 类型导入用 `import type`，避免运行时残留。
- 不写 `any`；外部数据先用 `unknown` 收进来，再收窄。

```ts
import { calculateOverallScore } from '@/services/scoring'
import type { TasteDimensions } from '@/types/tasting'

/** 把外部 JSON 收窄成八维评分，非法维度按 1 兜底。 */
export function parseDimensions(raw: unknown): TasteDimensions {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const pick = (key: string): number => {
    const value = source[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : 1
  }

  return {
    bitterness: pick('bitterness'),
    sweetness: pick('sweetness'),
    aftertaste: pick('aftertaste'),
    body: pick('body'),
    aroma: pick('aroma'),
    rhyme: pick('rhyme'),
    shape: pick('shape'),
    mind: pick('mind'),
  }
}

/** 复用已有评分函数，不重复实现评分模型。 */
export function scoreFromRaw(raw: unknown, processFactor: number): number {
  return calculateOverallScore(parseDimensions(raw), processFactor)
}
```

`calculateOverallScore` 来自 `src/services/scoring.ts`，评分模型（八维 × 工艺系数）只在那里实现一次。

## 4. 约定

- 一个 service 一个关注点；文件放 `src/services/`，函数具名导出，不用 default。
- 分层方向单向：`views → stores → services`，service 不 import store。
- 网络请求统一走 `src/services/http.ts` 的 `request`，不裸写 `fetch`。
- 已有服务：`http` / `authStorage` / `scoring` / `share` / `growth` / `garden` / `tasteProfile` / `teaAI` / `teaRecommend` / `tracking` / `vitals` / `errorBuffer` / `aiSession` / `apiBase`。
- 新增 service 同步补 `*.spec.ts`，见 [testing.md](testing.md)。
