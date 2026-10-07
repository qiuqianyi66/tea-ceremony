---
last_updated: 2026-10-07
status: active
owner: yanha
---

# 一盏茶 前端企业级工程规范（含重点代码样例）

> 与 
>
> `.harness/rules/编码规范.md`
>
>  前端域（§17-26 红线）配套的
>
> **参考实现手册**
>
> ：红线管 "禁止什么"，本文档管 "企业级怎么写"。覆盖安全性 / 维护性 / 迭代性 / 扩展性四性，每性给规范条目 + 可运行代码样例（均基于项目现有模式，非空想范式）。
> 适用：所有前端新代码 / 重构 / 评审。日期：2026-10-07。版本：V1.0。



***

## 一、安全性（Security）

### 规范



1. 🔴 0 处 `v-html`/`innerHTML`（XSS 面）；富文本一律用受控渲染组件。

2. 🔴 密钥 / Token 禁入日志、禁提交 `.env*`；JWT 禁 localStorage 明文（存 authStorage 内存态）。

3. 🔴 AI 请求只走后端代理 `/api/v1/*`，禁浏览器直连第三方。

4. 🟢 输入在前端也校验（maxlength / 类型），但**权限以后端为准**（前端防呆非安全边界）。

5. 🟢 依赖安全：`npm audit`（本地加 `--registry=https://registry.npmjs.org`）纳入 CI。

### 样例 1.1 安全请求封装（http.ts 模式 + 401 处理）



```
// src/services/http.ts —— 统一解包 ApiResponse + 401 跳登录 + 降级约定
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

interface ApiResponse<T> { code: string; message: string; data: T }

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()), ...init?.headers },
  })
  if (res.status === 401 && !path.startsWith('/v1/auth/')) {
    clearAuth()          // 清 token
    location.href = '/login'  // 跳登录（SPA 内 router.push 更优，按上下文选）
    throw new AuthExpiredError()
  }
  const body = (await res.json()) as ApiResponse<T>
  if (!res.ok || body.code !== 'OK') throw new ApiError(body.code, body.message)
  return body.data
}
```

### 样例 1.2 AI 降级承重墙（teaAI.ts 模式，禁改逻辑只改路径 / 解包）



```
// src/services/teaAI.ts —— !res.ok → null → 规则引擎降级（红线：零削弱）
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
    })
    if (!res.ok) return null          // 承重墙：任何非 200 都降级
    const data = await res.json()
    return data.data?.content ?? null
  } catch {
    return null                        // 网络异常同样降级，绝不抛出
  }
}
```

### 样例 1.3 类型守卫防 XSS / 脏数据（渲染层白名单）



```
// src/utils/guard.ts —— 服务端数据进 UI 前的形状守卫（防脏数据注入）
export function isSafeText(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 4000 && !/<script/i.test(v)
}
// 模板里只用 v-text/插值（自动转义），禁 v-html
```



***

## 二、维护性（Maintainability）

### 规范



1. 🔴 Composition API + `<script setup lang="ts">`，禁 Options API；组件 ≤200 行（超了拆为子组件 /composable）。

2. 🔴 Props/Emits 必须带类型；副作用在 onMounted/onUnmounted 管理。

3. 🟢 分层单向：`views → stores → services`；`types/` 共享类型；禁组件直接 fetch。

4. 🟢 命名：组件 PascalCase、composable `useXxx`、store `useXxxStore`、文件 kebab-case。

5. 🟢 测试：公共接口行为测试，不 mock 内部协作者；E2E 路径相对 baseURL（禁前导斜杠）。

### 样例 2.1 企业级组件（类型化 Props/Emits + 五态）



```
<!-- src/components/TeaCard.vue —— 类型化 + 状态五态 + 设计令牌 -->
<script setup lang="ts">
import type { Tea } from '@/types/tea'

interface Props { tea: Tea; loading?: boolean; error?: string }
interface Emits { (e: 'select', id: number): void }

const props = withDefaults(defineProps<Props>(), { loading: false, error: '' })
const emit = defineEmits<Emits>()
</script>

<template>
  <button class="glass-panel p-4 text-left" :disabled="loading" @click="emit('select', props.tea.id)">
    <span v-if="loading" class="animate-pulse text-[var(--color-wood)]">加载中…</span>
    <span v-else-if="error" class="text-[#A33B2E]">{{ error }}</span>
    <template v-else>
      <h3 class="font-serif text-lg text-[var(--color-ink)]">{{ tea.name }}</h3>
      <p class="text-sm text-[var(--color-wood)]">{{ tea.category }}</p>
    </template>
  </button>
</template>

<style scoped>
/* 禁裸值：色值/圆角/阴影一律走 DESIGN_SPEC 令牌（CSS 变量）
   错误态 #A33B2E 暂借朱砂（cinnabar）警示；企业级建议 DESIGN_SPEC 增补 --color-error 令牌后统一替换 */
</style>
```

### 样例 2.2 可测试的 composable（副作用集中管理）



```
// src/composables/useCountdown.ts —— 定时器副作用在卸载时清理（防内存泄漏）
export function useCountdown(seconds: number) {
  const remaining = ref(seconds)
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => { remaining.value = Math.max(0, remaining.value - 1) }, 1000)
  })
  onUnmounted(() => clearInterval(timer))
  return { remaining }
}
```

### 样例 2.3 行为测试（单测：只走公共接口）



```
// src/services/__tests__/teaAI.spec.ts 模式 —— 网络边界 mock，内部逻辑不 mock
it('askTeaMaster：代理返回 502 时返回兜底回复', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
  const { askTeaMaster } = await freshTeaAI()
  const reply = await askTeaMaster('茶道是什么？')
  expect(reply).toContain('茶')   // 规则引擎兜底，非空
})
```



***

## 三、迭代性（Iterability）

### 规范



1. 🟢 契约演进走**解包层**（api.ts 集中解包 ApiResponse），字段变化只改映射函数，组件零改动。

2. 🟢 功能演进按 PRD 版本化（frontend-product-prd.md V2 → V3），F - 编号引用，禁口头需求。

3. 🟢 破坏性变更先 expand-contract（新旧并存 → 迁移 → 删旧），CI 全程绿。

4. 🟢 新页面 / 组件先过设计门禁 6 步 + 四维甄别（自由 / 用户 / 竞品 / 伪需求）。

### 样例 3.1 契约解包层（字段演进隔离）



```
// src/services/api/teas.ts —— 后端字段变化只改这里，组件零感知
export async function fetchTeaList(category?: string): Promise<Tea[]> {
  const data = await request<{ items: TeaVo[] }>(`/v1/teas?category=${encodeURIComponent(category ?? '')}`)
  return data.items.map(toLocalTea)   // toLocalTea: TeaVo → 本地 Tea（字段映射集中在此）
}
// 后端加字段 → 只改 toLocalTea；后端删字段 → 只改 TeaVo 类型，组件不动
```

### 样例 3.2 版本化分享载荷（防旧版数据解析错误）



```
// src/services/share.ts —— 数据带版本字段，未知版本拒绝（迭代安全）
export function encodeShare(record: TastingRecord): string {
  return base64url(JSON.stringify({ v: 2, data: record }))
}
export function decodeShare(token: string): TastingRecord | null {
  const obj = JSON.parse(base64urlDecode(token))
  if (obj?.v !== 2) return null          // 未知版本拒绝，禁静默兼容
  return obj.data
}
```



***

## 四、扩展性（Extensibility）

### 规范



1. 🟢 状态模块化：每业务域一个 Pinia store，新增域 = 新增 store + service，不侵入现有。

2. 🟢 路由注册式：新增页面 = router 数组加一项（懒加载），导航组件读路由表。

3. 🟢 设计令牌驱动：新组件只从 DESIGN\_SPEC 令牌取色 / 距 / 圆角，不发明裸值。

4. 🟢 **AI 专家扩展点（M5）**：前端只传意图 /agent 参数，专家增删由后端 Orchestrator 决定，前端零改动。

5. 🟢 可插拔渲染：流式 / 引用卡片组件以插槽 / 独立组件形式预留。

### 样例 4.1 注册式路由（新增页面零侵入）



```
// src/router/index.ts —— 新增页面 = 加一项；懒加载自动分包
const routes: RouteRecordRaw[] = [
  { path: '/ai', component: () => import('../views/AIAsk.vue'), meta: { title: '茶灵' } },
  // 新增：{ path: '/review', component: () => import('../views/ReviewView.vue') }
]
```

### 样例 4.2 多智能体扩展点（teaAI.ts 预留 agent 参数）



```
// src/services/teaAI.ts —— M5：前端只传意图，专家由后端路由
export interface AiChatOptions { agent?: 'advisor' | 'taster' | 'librarian' | 'brewer' | 'mentor' }

export async function askTeaMaster(question: string, history: ChatMessage[] = [], opts: AiChatOptions = {}) {
  // 现有降级链不变；M5 增加：
  const body = { messages: [...], ...(opts.agent ? { agent: opts.agent } : {}) }
  // 后端 Orchestrator 按 agent 路由专家；前端零改动适配新增专家
}
```

### 样例 4.3 模块化 store（新增域不侵入）



```
// src/stores/ai.ts —— 新增 AI 域 store；auth/tasting 等域各自独立，互不耦合
export const useAiStore = defineStore('ai', () => {
  const lastAgent = ref<'advisor' | 'librarian' | null>(null)
  const setAgent = (a: typeof lastAgent.value) => { lastAgent.value = a }
  return { lastAgent, setAgent }
})
// 扩展：新增域 → 新建 stores/xxx.ts + services/api/xxx.ts，不动既有 store
```



***

## 五、样例使用规则



1. 样例是**参考范式**，不是复制模板：按实际场景裁剪，遵守编码规范.md 红线。

2. 评审时对照：红线（编码规范.md）→ 范式（本文档）→ 设计（DESIGN\_SPEC）。

3. 新增企业级模式 → 先评审并入本文档，禁散落各处口头传承。