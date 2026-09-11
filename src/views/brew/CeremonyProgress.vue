<script setup lang="ts">
/**
 * 工夫茶仪式进度条：备器→煮水→温杯→醒茶→浸泡→出汤
 */
defineProps<{
  steps: readonly { readonly phase: string; readonly label: string }[]
  currentIndex: number
}>()
</script>

<template>
  <div class="ceremony-progress" aria-label="冲泡流程进度">
    <div v-for="(step, index) in steps" :key="step.phase" class="ceremony-step">
      <div class="ceremony-dot" :class="{ active: index === currentIndex, done: index < currentIndex }">
        <IconCheck v-if="index < currentIndex" class="w-3.5 h-3.5" />
        <span v-else>{{ index + 1 }}</span>
      </div>
      <span :class="index <= currentIndex ? 'text-[var(--color-wood)]' : 'text-[var(--color-wood-light)]/50'">{{ step.label }}</span>
      <div v-if="index < steps.length - 1" class="ceremony-line" :class="{ filled: index < currentIndex }"></div>
    </div>
  </div>
</template>

<style scoped>
.ceremony-progress {
  display: flex; align-items: flex-start; gap: 0;
  margin-bottom: 1.5rem; max-width: 500px; width: 100%;
}
.ceremony-step {
  display: flex; flex-direction: column; align-items: center;
  flex: 1; position: relative;
}
.ceremony-dot {
  width: 1.75rem; height: 1.75rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 600;
  background: rgba(42, 31, 21, 0.9);
  border: 2px solid rgba(201, 169, 110, 0.4);
  color: #b8a080; z-index: 1; transition: all 0.3s;
}
.ceremony-dot.active {
  background: linear-gradient(135deg, #c9a96e, #8b6b3a);
  border-color: #e8c87a; color: #1a120a;
  box-shadow: 0 0 16px rgba(201, 169, 110, 0.5);
}
.ceremony-dot.done {
  background: rgba(201, 169, 110, 0.3);
  border-color: rgba(201, 169, 110, 0.6);
  color: #c9a96e;
}
.ceremony-step > span {
  margin-top: 0.4rem; font-size: 0.72rem; letter-spacing: 0.05em;
  white-space: nowrap;
}
.ceremony-line {
  position: absolute; top: 0.875rem; left: calc(50% + 1.25rem);
  width: calc(100% - 2.5rem); height: 2px;
  background: rgba(201, 169, 110, 0.15);
}
.ceremony-line.filled {
  background: linear-gradient(90deg, #c9a96e, rgba(201, 169, 110, 0.3));
}
</style>
