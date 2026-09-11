<script setup lang="ts">
/**
 * 茶树详情弹窗：种植信息 + 浇水/采摘/修剪操作
 */
import { computed } from 'vue'
import type { PlantedTea } from '@/types/garden'
import type { Tea } from '@/types/tea'
import {
  getGrowthStage, getGrowthStageInfo, getCurrentWaterLevel,
  getPlantDays, isGrowthPaused,
} from '@/services/garden'

const props = defineProps<{
  plant: PlantedTea | null
  tea?: Tea
}>()
const emit = defineEmits<{
  water: []
  harvest: []
  prune: []
  close: []
}>()

const stage = computed(() => props.plant ? getGrowthStage(props.plant) : '')
const stageInfo = computed(() => props.plant ? getGrowthStageInfo(props.plant) : null)
const waterLevel = computed(() => props.plant ? getCurrentWaterLevel(props.plant) : 0)
const days = computed(() => props.plant ? getPlantDays(props.plant) : 0)
const paused = computed(() => props.plant ? isGrowthPaused(props.plant) : false)
</script>

<template>
  <div v-if="plant" class="dialog-mask" @click.self="emit('close')">
    <div class="dialog plant-detail">
      <div class="detail-header">
        <h3 class="dialog-title font-serif">{{ tea?.name }}</h3>
        <span class="detail-stage" :class="stage">{{ stageInfo?.label }}</span>
      </div>
      <div class="detail-body">
        <div class="detail-row">
          <span class="detail-label">种植天数</span>
          <span class="detail-value">{{ days.toFixed(1) }} 天</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">土壤湿度</span>
          <span class="detail-value" :class="{ low: waterLevel < 30 }">{{ Math.round(waterLevel) }}%</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">生长状态</span>
          <span class="detail-value">
            {{ plant.status === 'dead' ? '已枯萎' : paused ? '缺水暂停生长' : '正常生长' }}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">定型修剪</span>
          <span class="detail-value">{{ plant.pruned ? '已修剪' : '未修剪' }}</span>
        </div>
        <p class="detail-desc">{{ stageInfo?.description }}</p>
      </div>
      <div class="dialog-actions">
        <button v-if="stage === 'seedling' && !plant.pruned"
          class="dialog-btn secondary" @click="emit('prune')"><IconScissors :size="14" /> 定型修剪</button>
        <button v-if="stage === 'mature' && plant.status === 'growing'"
          class="dialog-btn harvest" @click="emit('harvest')"><IconLeaf :size="14" /> 采摘</button>
        <button v-if="stage === 'recovery'"
          class="dialog-btn recovery-hint" disabled><IconSprout :size="14" /> 恢复期（休养生息）</button>
        <button class="dialog-btn confirm" @click="emit('water')" :disabled="plant.status === 'dead'">
          <IconDroplet :size="14" /> 浇水
        </button>
        <button class="dialog-btn cancel" @click="emit('close')">关闭</button>
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
.plant-detail { max-width: 380px; }
.dialog-title { font-size: 1.2rem; font-weight: 500; margin: 0 0 0.3rem; }
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.detail-stage {
  font-size: 0.72rem; padding: 0.25rem 0.7rem; border-radius: 999px;
  background: rgba(201,169,110,0.15); color: #c9a96e;
}
.detail-stage.mature { background: rgba(107,142,35,0.2); color: #aed581; }
.detail-stage.dead { background: rgba(139,69,19,0.2); color: #b8860b; }
.detail-body { margin-bottom: 1rem; }
.detail-row {
  display: flex; justify-content: space-between;
  padding: 0.5rem 0; border-bottom: 1px solid rgba(245,241,230,0.08);
  font-size: 0.85rem;
}
.detail-label { color: rgba(245,241,230,0.5); }
.detail-value { color: #f5f1e6; font-weight: 500; }
.detail-value.low { color: #e57373; }
.detail-desc {
  font-size: 0.78rem; color: rgba(245,241,230,0.5);
  line-height: 1.6; margin: 0.8rem 0 0; font-style: italic;
}
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
.dialog-btn.secondary { background: rgba(107,142,35,0.2); border: 1px solid rgba(107,142,35,0.4); color: #aed581; }
.dialog-btn.secondary:hover { background: rgba(107,142,35,0.3); }
.dialog-btn.harvest { background: rgba(244,167,66,0.85); color: #1a2420; font-weight: 500; }
.dialog-btn.harvest:hover { background: #f4a742; }
.dialog-btn.recovery-hint { background: transparent; border: 1px dashed rgba(174,213,129,0.4); color: #aed581; cursor: default; }
</style>
