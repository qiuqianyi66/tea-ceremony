---
name: vue-component
description: 为一盏茶项目生成符合规范的 Vue 3 组件。当用户要求新建页面、组件、或修改 Vue 组件时触发。
---

# Vue 3 组件生成规范

为一盏茶项目生成或修改 Vue 组件时，严格遵循以下流程。

## 1. 生成前检查

1. 确认组件类型：页面级（`src/views/`）还是可复用组件（`src/components/`）
2. 检查是否已有类似组件，避免重复
3. 确认所需 props、emits、依赖的 store/service
4. 检查 `src/types/` 中是否已有相关类型

## 2. 组件模板

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
// 1. 类型导入
import type { Tea } from '@/types/tea'
// 2. store / service 导入
import { useTeaStore } from '@/stores/tea'

// 3. Props（必须有类型）
const props = defineProps<{
  tea: Tea
  compact?: boolean
}>()

// 4. Emits（必须声明）
const emit = defineEmits<{
  select: [tea: Tea]
  close: []
}>()

// 5. 局部状态
const isLoading = ref(false)

// 6. 计算属性
const displayName = computed(() => props.tea.name)

// 7. 方法
function handleSelect() {
  emit('select', props.tea)
}

// 8. 生命周期
onMounted(() => {
  // 初始化逻辑
})
</script>

<template>
  <div class="组件根元素" @click="handleSelect">
    <!-- 模板内容 -->
  </div>
</template>
```

## 3. 硬性规则

- **必须**用 `<script setup lang="ts">`，禁止 Options API
- **必须**定义 props 和 emits 的 TypeScript 类型
- **禁止**使用 `any`，类型从 `src/types/` 导入
- **禁止**直接操作 DOM，用 ref 和响应式数据
- **禁止**在组件内直接 fetch，API 调用走 `src/services/api.ts`
- **禁止**在组件内直接操作 IndexedDB，走 `src/services/db.ts`
- 样式用 Tailwind 类，不写 `<style>` 块（除非必要的 scoped 样式）
- 组件不超过 200 行，超过则拆分

## 4. 生成后验证

1. 组件已注册到路由（如果是页面级）
2. `npm run type-check` 通过
3. 手动验证组件渲染无控制台报错
4. 如涉及交互，验证事件触发正确

## 5. 项目特有注意

- 冲泡流程组件要考虑路由守卫（`src/router/`）
- 涉及品鉴记录的组件要处理离线状态（`sync_status`）
- 茶文化展示组件优先用 `src/data/` 中的静态数据
- 动画用 tsparticles（已安装），不引入新的动画库
