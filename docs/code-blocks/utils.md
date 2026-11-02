---
last_updated: 2026-11-02
status: active
owner: yanha
---

# Utils 骨架

解决「小函数随手塞进组件、没有 JSDoc、没人知道该放哪」的问题：`src/utils/` 只放无副作用的纯函数，一个文件一类关注点，统一从 `@/utils` 桶导出。

## 1. JSDoc 规范

每个导出函数写清「做什么 / 参数 / 返回值 / 例子」。无副作用：不改入参、不读 `window`、不发请求、不打日志。

```ts
/**
 * 把摄氏温度渲染成展示文本。
 * @param celsius 摄氏度数值，允许一位小数
 * @param unit 温度单位，默认 ℃
 * @returns 形如「85℃」的文本；非法数值返回「--」
 * @example
 * formatTemp(85) // '85℃'
 * formatTemp(85.5) // '85.5℃'
 * formatTemp(Number.NaN) // '--'
 */
export function formatTemp(celsius: number, unit = '℃'): string {
  if (!Number.isFinite(celsius)) return '--'
  const rounded = Math.round(celsius * 10) / 10
  return `${rounded}${unit}`
}
```

私有辅助函数同样带一行注释，但不必写 `@param`。`src/utils/format.ts` 的实际写法：

```ts
/** 两位补零 */
const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))

/** 小数位收敛到 toFixed 合法区间，非法值退化为 0 */
const clampDecimals = (decimals: number): number =>
  Number.isInteger(decimals) && decimals >= 0 && decimals <= 100 ? decimals : 0
```

## 2. 带闭包状态的写法

`debounce` / `throttle` 需要闭包状态，仍不碰外部环境。返回值上挂 `cancel` / `flush`，便于组件卸载时清理。

```ts
import { debounce } from '@/utils'

const search = debounce((keyword: string): void => {
  console.log('检索', keyword)
}, 300)

search('龙井')
search('龙井茶') // 前一次被丢弃
search.cancel() // 组件卸载时调用，清掉未执行的定时器
```

`debounce(fn, wait, { leading: true })` 首次立即执行，窗口内后续调用丢弃。`flush()` 立即执行待执行的调用并返回结果。

## 3. 文件划分

| 文件 | 导出 |
|------|------|
| `format.ts` | `formatDate` / `formatRelativeTime` / `formatNumber` / `formatCompactNumber` |
| `debounce.ts` | `debounce`（返回 `DebouncedFunction`，带 `cancel` / `flush`，支持 `leading`） |
| `throttle.ts` | `throttle`（返回 `ThrottledFunction`，带 `cancel`） |
| `type-guards.ts` | `isNumber` / `isBoolean` / `isString` / `isArray` / `isDefined` / `isPlainObject` / `isObject` |
| `url.ts` | `parseQuery` / `buildQuery` / `appendQuery`，类型 `QueryParams` / `QueryInput` |
| `storage.ts` | `readJson` / `writeJson` / `removeKey`（try/catch 降级，不抛异常） |
| `array.ts` | `unique` / `uniqueBy` / `groupBy` / `chunk` / `sortBy` |
| `string.ts` | `truncate` / `capitalize` / `camelCase` / `kebabCase` / `escapeHtml` |
| `index.ts` | 桶导出，业务侧统一 `import { ... } from '@/utils'` |

## 4. 用法示例

```ts
import { appendQuery, formatDate, formatNumber, groupBy, isPlainObject, readJson } from '@/utils'

formatDate(new Date(2026, 10, 2), 'YYYY年MM月DD日') // '2026年11月02日'
formatNumber(3.14159, 2) // '3.14'
appendQuery('/tea/list', { page: 2, tag: ['green', 'oolong'] })
groupBy([{ type: 'green' }, { type: 'black' }], (item) => item.type)
isPlainObject(JSON.parse('{}')) // true
readJson('tea-settings', { theme: 'light' }) // 缺失或损坏时返回兜底值
```

## 5. 约定

- 不引第三方库解决单文件能写清的问题（`debounce` 70 余行）。
- 不写 `any`；外部输入先用 `unknown` 收进来，再用 `type-guards.ts` 收窄。
- 不在这里读 store、不 import 组件；需要业务上下文就放 `src/services/`。
- 新增函数同步补 `src/utils/__tests__/<name>.spec.ts`，写法见 [testing.md](testing.md)。
- 评分、冲泡参数等业务计算留在 `src/services/`，不进 utils。
