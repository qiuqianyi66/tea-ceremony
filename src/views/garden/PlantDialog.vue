<script setup lang="ts">
/**
 * 种茶弹窗：选茶种 → 确认种下
 */
import { ref, watch } from 'vue'
import type { Tea } from '@/types/tea'

const props = defineProps<{
  open: boolean
  regionName: string
  teas: Tea[]
}>()
const emit = defineEmits<{ confirm: [teaId: string]; close: [] }>()

const selectedId = ref('')
watch(() => props.open, (open) => {
  if (open) selectedId.value = props.teas[0]?.id ?? ''
})
</script>

<template>
  <div v-if="open" class="dialog-mask" @click.self="emit('close')">
    <div class="dialog">
      <h3 class="dialog-title font-serif">种下一棵茶</h3>
      <p class="dialog-sub">{{ regionName }} · 可种茶种</p>
      <div class="tea-select-list">
        <div v-for="tea in teas" :key="tea.id"
          class="tea-select-item"
          :class="{ selected: selectedId === tea.id }"
          @click="selectedId = tea.id">
          <div class="tea-color" :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }"></div>
          <div class="tea-select-info">
            <p class="tea-select-name">{{ tea.name }}</p>
            <p class="tea-select-type">{{ tea.type }} · {{ tea.origin }}</p>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="dialog-btn cancel" @click="emit('close')">取消</button>
        <button class="dialog-btn confirm" @click="emit('confirm', selectedId)" :disabled="!selectedId">种下</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.dialog {
  background: #1a2420; border: 1px solid rgba(201,169,110,0.2);
  border-radius: 16px; padding: 1.5rem; max-width: 420px; width: 100%;
  color: #f5f1e6; max-height: 85vh; overflow-y: auto;
}
.dialog-title { font-size: 1.2rem; font-weight: 500; margin: 0 0 0.3rem; }
.dialog-sub { font-size: 0.78rem; color: rgba(245,241,230,0.5); margin: 0 0 1rem; }
.tea-select-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.tea-select-item {
  display: flex; align-items: center; gap: 0.8rem;
  padding: 0.7rem; border-radius: 10px;
  border: 1px solid rgba(245,241,230,0.1); cursor: pointer; transition: all 0.2s;
}
.tea-select-item:hover { border-color: rgba(201,169,110,0.4); }
.tea-select-item.selected { border-color: rgba(201,169,110,0.8); background: rgba(201,169,110,0.1); }
.tea-color { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; }
.tea-select-name { font-size: 0.9rem; font-weight: 500; margin: 0; }
.tea-select-type { font-size: 0.72rem; color: rgba(245,241,230,0.5); margin: 0.15rem 0 0; }
.dialog-actions { display: flex; gap: 0.6rem; justify-content: flex-end; flex-wrap: wrap; }
.dialog-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
  padding: 0.55rem 1.3rem; min-height: 44px; border-radius: 999px;
  font-size: 0.85rem; cursor: pointer; border: none;
  transition: all 0.2s; font-family: inherit;
}
.dialog-btn.confirm { background: rgba(201,169,110,0.9); color: #1a2420; font-weight: 500; }
.dialog-btn.confirm:hover { background: #c9a96e; }
.dialog-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.dialog-btn.cancel { background: transparent; border: 1px solid rgba(245,241,230,0.2); color: rgba(245,241,230,0.7); }
.dialog-btn.cancel:hover { border-color: rgba(245,241,230,0.4); }
</style>
