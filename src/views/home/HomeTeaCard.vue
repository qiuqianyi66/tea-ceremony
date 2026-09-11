<script setup lang="ts">
/**
 * 首页"今日宜饮"茶卡片
 */
import { reactive } from 'vue'
import type { Tea } from '@/types/tea'

defineProps<{ tea: Tea }>()
const emit = defineEmits<{
  open: [tea: Tea]
  share: [tea: Tea]
}>()

const imgFailed = reactive<Record<string, boolean>>({})
function markImgFailed(id: string) { imgFailed[id] = true }
</script>

<template>
  <div class="tea-card" role="button" tabindex="0"
    @click="emit('open', tea)" @keydown.enter="emit('open', tea)">
    <img v-if="tea.image && !imgFailed[tea.id]" :src="tea.image" loading="lazy"
      @error="markImgFailed(tea.id)" class="w-full h-28 object-cover rounded-lg mb-2" :alt="tea.name" />
    <div v-else class="w-full h-28 rounded-lg mb-2"
      :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }"></div>
    <div class="tea-card-top">
      <span class="tea-type">{{ tea.type }}</span>
      <span class="tea-share" role="button" tabindex="0"
        @click.stop="emit('share', tea)" @keydown.enter.stop="emit('share', tea)">↗ 分享</span>
    </div>
    <p class="tea-name">{{ tea.name }}</p>
    <p class="tea-desc">{{ tea.description }}</p>
    <div class="tea-flavors">
      <span v-for="f in tea.flavor" :key="f" class="flavor-pill">{{ f }}</span>
    </div>
  </div>
</template>

<style scoped>
.tea-card {
  display: flex; flex-direction: column; gap: 0.4rem;
  text-align: left; padding: 1rem 1.05rem;
  border-radius: 0.9rem;
  background: rgba(245, 241, 230, 0.06);
  border: 1px solid rgba(245, 241, 230, 0.1);
  color: #f3efe4; font-family: inherit; cursor: pointer;
  transition: all 0.28s ease;
}
.tea-card:hover {
  background: rgba(201, 169, 110, 0.14);
  border-color: rgba(201, 169, 110, 0.45);
  transform: translateY(-2px);
}
.tea-card-top { display: flex; align-items: center; justify-content: space-between; }
.tea-type {
  font-size: 0.7rem; letter-spacing: 0.12em;
  color: rgba(201, 169, 110, 0.95);
  border: 1px solid rgba(201, 169, 110, 0.4);
  padding: 0.12rem 0.5rem; border-radius: 999px;
}
.tea-share {
  display: inline-flex; align-items: center; min-height: 2.75rem;
  font-size: 0.7rem; letter-spacing: 0.06em;
  color: rgba(201, 169, 110, 0.95);
  border: 1px solid rgba(201, 169, 110, 0.4);
  padding: 0.12rem 0.55rem; border-radius: 999px;
  cursor: pointer; transition: all 0.25s ease;
}
.tea-share:hover { background: rgba(201, 169, 110, 0.25); border-color: rgba(201, 169, 110, 0.8); }
.tea-name { font-size: 1.1rem; font-weight: 600; margin: 0.1rem 0 0; }
.tea-desc {
  font-size: 0.76rem; line-height: 1.6;
  color: rgba(245, 241, 230, 0.58); margin: 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tea-flavors { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.2rem; }
.flavor-pill {
  font-size: 0.68rem; color: rgba(245, 241, 230, 0.78);
  background: rgba(245, 241, 230, 0.08);
  padding: 0.1rem 0.5rem; border-radius: 999px;
}
</style>
