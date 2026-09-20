<script setup lang="ts">
/**
 * PWA 新版本更新提示（P0-3）
 * prompt 模式：检测到新 SW 就绪时不自动强刷（避免丢失品鉴打分/笔记等未保存表单），
 * 由用户点「立即更新」才发 SKIP_WAITING 让新 SW 激活（下次导航/刷新生效，页面不强制刷新）；
 * 「稍后」可延后，下次会话再提示。
 */

import { registerSW } from 'virtual:pwa-register'
import { ref } from 'vue'

const needRefresh = ref(false)

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    needRefresh.value = true
  },
})

function dismiss() {
  needRefresh.value = false
}

function applyUpdate() {
  // 用户已确认：立即隐藏提示，并让新 SW 跳过等待接管（下次导航生效）
  needRefresh.value = false
  void updateSW(true)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pwa-update">
      <div
        v-if="needRefresh"
        class="fixed bottom-4 right-4 z-[110] flex max-w-[92vw] items-center gap-3 rounded-xl border border-[var(--color-tea-gold)]/40 bg-[#1a120a]/95 px-4 py-3 text-sm leading-snug text-[#f5f1e6] shadow-lg backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <span>新版本已就绪，更新后体验最新内容</span>
        <button
          type="button"
          class="shrink-0 rounded-lg bg-[var(--color-tea-gold)] px-3 py-1.5 font-medium text-[#1a120a]"
          @click="applyUpdate"
        >
          立即更新
        </button>
        <button
          type="button"
          class="shrink-0 rounded-lg px-2 py-1.5 text-[#c9b99a] hover:text-[#f5f1e6]"
          @click="dismiss"
        >
          稍后
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pwa-update-enter-active,
.pwa-update-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.pwa-update-enter-from,
.pwa-update-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
