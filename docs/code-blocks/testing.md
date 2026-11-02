---
last_updated: 2026-11-02
status: active
owner: yanha
---

# Testing 骨架

解决「测试只复刻实现、断言无牙齿」的问题：AAA 结构、只走公共接口、边界与定时器各有用例，组件测试用 `@vue/test-utils`。

测试文件放同目录 `__tests__/`，命名 `<被测文件>.spec.ts`，`vitest.config.ts` 只收 `src/**/*.spec.ts`。

## 1. 单测骨架（AAA）

`Arrange / Act / Assert` 三段用注释隔开。断言落在返回值或副作用上，不断言内部私有函数。

```ts
import { describe, expect, it } from 'vitest'

import { truncate } from '@/utils/string'

describe('truncate', () => {
  it('超出长度时截断并补省略号', () => {
    // Arrange
    const text = '一盏茶，茶禅一味'

    // Act
    const result = truncate(text, 3)

    // Assert
    expect(result).toBe('一盏茶…')
  })

  it('未超出长度时原样返回', () => {
    // Arrange
    const text = '一盏茶'

    // Act
    const result = truncate(text, 10)

    // Assert
    expect(result).toBe(text)
  })
})
```

## 2. 边界与假定时器

边界单独成 `it`：空输入、上限、非法值。定时器用 `vi.useFakeTimers()`，`afterEach` 必须还原。

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { debounce } from '@/utils/debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('窗口内多次调用只执行最后一次', () => {
    // Arrange
    const spy = vi.fn()
    const run = debounce(spy, 300)

    // Act
    run('龙井')
    run('碧螺春')
    vi.advanceTimersByTime(299)

    // Assert
    expect(spy).not.toHaveBeenCalled()

    // Act
    vi.advanceTimersByTime(1)

    // Assert
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenLastCalledWith('碧螺春')
  })

  it('cancel 丢弃待执行调用', () => {
    // Arrange
    const spy = vi.fn()
    const run = debounce(spy, 300)

    // Act
    run('龙井')
    run.cancel()
    vi.advanceTimersByTime(300)

    // Assert
    expect(spy).not.toHaveBeenCalled()
  })
})
```

断言「没被调用」比断言「被调用一次」更能证明窗口合并生效。

## 3. 组件测试（mount）

用 `mount` 挂真组件，不 mock 内部子组件。断言渲染文本、属性、emit 事件。

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BaseSpinner from '@/components/ui/BaseSpinner.vue'

describe('BaseSpinner', () => {
  it('默认渲染加载文案与 role', () => {
    // Arrange & Act
    const wrapper = mount(BaseSpinner)

    // Assert
    expect(wrapper.text()).toContain('加载中')
    expect(wrapper.attributes('role')).toBe('status')
  })

  it('自定义 label 覆盖默认文案', () => {
    // Arrange & Act
    const wrapper = mount(BaseSpinner, { props: { label: '正在煮水' } })

    // Assert
    expect(wrapper.text()).toContain('正在煮水')
    expect(wrapper.text()).not.toContain('加载中')
  })
})
```

需要 Teleport 的组件加 `global: { stubs: { teleport: true } }`，参考 `src/components/__tests__/PwaUpdateToast.spec.ts`。

## 4. 边界用例清单

- 空值：`''` / `[]` / `null` / `undefined`。
- 上下限：0、上限值、上限 +1。
- 非法输入：`NaN`、`Infinity`、非数字字符串。
- 异步失败：mock 拒绝后断言错误状态，不是断言控制台输出。
- 幂等：同一操作连续两次的结果一致。

## 5. 约定

- `import { describe, expect, it, vi } from 'vitest'` 显式导入，不依赖全局。
- 被测模块用 `@/` 别名，且直接指向文件（`@/utils/string`），便于定位。
- 只 mock 跨进程边界（网络、时钟、DB 驱动），不 mock 内部协作者。
- 每个 `it` 一个行为；描述用中文短句，写「做什么」不写「测 XXX 函数」。
- 跑单测 `npm run test`；改 store / service / utils 属 L2，必须带测试。
