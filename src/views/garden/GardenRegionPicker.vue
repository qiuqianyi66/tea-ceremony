<script setup lang="ts">
/**
 * 茶园地区选择视图（无 regionId 时）
 */
import { useRouter } from 'vue-router'
import { gardenRegions } from '@/data/gardenRegions'

const router = useRouter()
</script>

<template>
  <div class="garden-home">
    <div class="garden-header">
      <h1 class="garden-title font-serif">我的茶园</h1>
      <p class="garden-sub">选一片茶山，种下属于你的茶</p>
    </div>
    <div class="region-grid">
      <div v-for="region in gardenRegions" :key="region.id"
        class="region-card"
        :style="{ '--region-accent': region.accentColor }"
        @click="router.push(`/garden/${region.id}`)">
        <div class="region-bg" :style="{ backgroundImage: `url(${region.backgroundImage})` }"></div>
        <div class="region-overlay"></div>
        <div class="region-info">
          <p class="region-tea-area">{{ region.teaArea }}</p>
          <h2 class="region-name font-serif">{{ region.name }}</h2>
          <p class="region-desc">{{ region.description }}</p>
          <p class="region-climate">{{ region.climate }}</p>
        </div>
        <span class="region-marker" aria-hidden="true">入山</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.garden-home {
  min-height: 100vh;
  background: linear-gradient(160deg, #0f1a14 0%, #1a2420 100%);
  color: #f5f1e6;
  padding: 2rem 1rem;
}
.garden-header { text-align: center; margin-bottom: 2rem; }
.garden-title { font-size: 2rem; font-weight: 300; letter-spacing: 0.2em; margin: 0 0 0.5rem; }
.garden-sub { font-size: 0.85rem; color: rgba(245,241,230,0.5); letter-spacing: 0.15em; margin: 0; }
.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}
.region-card {
  position: relative; height: 320px; border-radius: 6px; overflow: hidden;
  cursor: pointer; transition: transform 0.3s, box-shadow 0.3s;
}
.region-card::after {
  content: ''; position: absolute; inset: 0;
  border: 1px solid var(--region-accent, rgba(201,169,110,0.35));
  border-radius: 6px; opacity: 0.45; pointer-events: none; transition: opacity 0.3s;
}
.region-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
.region-card:hover::after { opacity: 1; }
.region-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.region-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(13,20,16,0.92) 0%, rgba(13,20,16,0.3) 60%, transparent 100%);
}
.region-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 1.5rem; }
.region-tea-area { font-size: 0.7rem; letter-spacing: 0.3em; color: rgba(201,169,110,0.8); margin: 0 0 0.3rem; }
.region-name { font-size: 1.3rem; font-weight: 500; margin: 0 0 0.5rem; }
.region-desc {
  font-size: 0.78rem; line-height: 1.6; color: rgba(245,241,230,0.65); margin: 0 0 0.4rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.region-climate { font-size: 0.7rem; color: rgba(245,241,230,0.4); margin: 0; }
.region-marker {
  position: absolute; top: 1rem; right: 1rem;
  font-size: 0.7rem; letter-spacing: 0.3em; color: rgba(245,241,230,0.85);
  border: 1px solid rgba(245,241,230,0.35); padding: 0.35rem 0.7rem; border-radius: 2px;
  opacity: 0; transform: translateY(-4px); transition: opacity 0.3s, transform 0.3s;
}
.region-card:hover .region-marker { opacity: 1; transform: translateY(0); }
</style>
