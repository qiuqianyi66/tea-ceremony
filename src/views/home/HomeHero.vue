<script setup lang="ts">
/**
 * 首页 Hero 区：固定背景（视频/图/雾/光晕/暗角/颗粒）+ 节气标题 + CTA
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentSolarTerm, getSeasonName } from '@/data/solarTerms'
import heroImg from '@/assets/tea-mountain-hero.jpg'

const heroVideoUrl = 'https://videos.pexels.com/video-files/38238683/16236719_1280_720_60fps.mp4'
const prefersReducedMotion = ref(false)
const router = useRouter()
const term = getCurrentSolarTerm()

const entered = ref(false)
const pointerX = ref(0)
const pointerY = ref(0)

const parallaxStyle = computed(() => ({
  transform: `translate3d(${pointerX.value * -18}px, ${pointerY.value * -12}px, 0) scale(1.06)`,
}))

const timeOfDay = computed(() => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'night'
})

const quotes = [
  '山静无人，水自流。',
  '茶者，南方之嘉木也。',
  '一席茶，一方天地，一念清心。',
  '且将新火试新茶，诗酒趁年华。',
  '坐酌泠泠水，看煎瑟瑟尘。',
]
const teaQuote = ref(quotes[Math.floor(Math.random() * quotes.length)]!)

function onPointerMove(event: PointerEvent) {
  pointerX.value = event.clientX / window.innerWidth - 0.5
  pointerY.value = event.clientY / window.innerHeight - 0.5
}

function startBreak() {
  router.push('/break')
}
function enter() {
  router.push('/select')
}

onMounted(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true }))
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.addEventListener('pointermove', onPointerMove, { passive: true })
})
onUnmounted(() => window.removeEventListener('pointermove', onPointerMove))
</script>

<template>
  <div class="home-hero" :class="[`time-${timeOfDay}`, { 'is-entered': entered }]">
    <div class="hero-parallax" :style="parallaxStyle">
      <img :src="heroImg" alt="晨雾中的茶山茶园" class="hero-img hero-img-fallback" draggable="false" />
      <video v-if="!prefersReducedMotion"
        class="hero-video" autoplay muted loop playsinline
        :poster="heroImg" preload="metadata" aria-hidden="true">
        <source :src="heroVideoUrl" type="video/mp4" />
      </video>
    </div>
    <div class="mist mist-a" aria-hidden="true"></div>
    <div class="mist mist-b" aria-hidden="true"></div>
    <div class="hero-haze" aria-hidden="true"></div>
    <div class="hero-scrim" aria-hidden="true"></div>
    <div class="hero-grain" aria-hidden="true"></div>

    <section class="hero-main">
      <div class="hero-content" :class="{ 'content-in': entered }">
        <p class="term-tag">
          今日{{ term.name }} · {{ getSeasonName(term.season) }}季 · 宜{{ term.teaTypes.slice(0, 2).join('、') }}
        </p>
        <h1 class="hero-title font-serif">一盏茶</h1>
        <p class="hero-sub">给忙碌的一天，留五分钟茶歇</p>
        <p class="hero-quote">{{ teaQuote }}</p>
        <div class="hero-cta">
          <button class="enter-btn break-btn" @click="startBreak">
            <span><IconCupSoda class="inline-block -mt-1" /> 茶歇 5 分钟</span>
            <span class="enter-arrow">→</span>
          </button>
          <button class="enter-link" @click="enter">入席 · 完整泡茶体验 →</button>
        </div>
      </div>
      <div class="scroll-hint">向下探索 · 茶之世界</div>
    </section>
  </div>
</template>

<style scoped>
.home-hero { position: relative; }
.hero-parallax {
  position: fixed; inset: -4%; z-index: 0;
  will-change: transform;
  transition: transform 1.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero-img {
  width: 100%; height: 100%; object-fit: cover; object-position: center 52%;
  filter: saturate(0.78) brightness(1.05) contrast(0.96);
  animation: kenburns 26s ease-in-out infinite alternate;
}
@keyframes kenburns { from { transform: scale(1); } to { transform: scale(1.1) translate(-1.2%, -1%); } }
.hero-video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: center 52%;
  filter: saturate(0.78) brightness(1.05) contrast(0.96);
}
.mist { position: fixed; border-radius: 50%; filter: blur(60px); pointer-events: none; z-index: 1; }
.mist-a {
  top: 6%; left: -12%; width: 86vw; height: 44vh;
  background: radial-gradient(ellipse, rgba(238, 244, 241, 0.72), transparent 70%);
  animation: mistDrift 24s ease-in-out infinite alternate;
}
.mist-b {
  top: 22%; right: -14%; width: 78vw; height: 38vh;
  background: radial-gradient(ellipse, rgba(226, 237, 231, 0.62), transparent 72%);
  animation: mistDrift 30s ease-in-out infinite alternate-reverse;
}
@keyframes mistDrift { from { transform: translateX(-3%) translateY(0); } to { transform: translateX(8%) translateY(2%); } }
.hero-haze {
  position: fixed; inset: 0; z-index: 2; pointer-events: none; mix-blend-mode: screen;
  background:
    linear-gradient(180deg, rgba(228, 238, 233, 0.82) 0%, rgba(228, 238, 233, 0.4) 32%, rgba(228, 238, 233, 0.14) 56%, rgba(228, 238, 233, 0.03) 76%, rgba(228, 238, 233, 0) 100%),
    radial-gradient(130% 85% at 50% 10%, rgba(236, 243, 239, 0.55), transparent 56%);
}
.hero-scrim {
  position: fixed; inset: 0; z-index: 3; pointer-events: none;
  background:
    linear-gradient(to bottom, rgba(12, 22, 18, 0.4) 0%, rgba(12, 22, 18, 0.06) 22%, transparent 42%),
    linear-gradient(to top, rgba(10, 18, 15, 0.66) 0%, rgba(10, 18, 15, 0.3) 36%, transparent 64%);
}
.time-dusk .hero-scrim {
  background:
    linear-gradient(to bottom, rgba(34, 24, 14, 0.4) 0%, rgba(34, 24, 14, 0.08) 22%, transparent 42%),
    linear-gradient(to top, rgba(20, 14, 9, 0.78) 0%, rgba(20, 14, 9, 0.4) 34%, transparent 62%);
}
.time-night .hero-scrim {
  background:
    linear-gradient(to bottom, rgba(6, 12, 16, 0.6) 0%, rgba(6, 12, 16, 0.2) 24%, transparent 46%),
    linear-gradient(to top, rgba(5, 10, 13, 0.86) 0%, rgba(5, 10, 13, 0.5) 36%, transparent 64%);
}
.time-night .hero-img, .time-night .hero-video { filter: saturate(0.7) brightness(0.62) hue-rotate(-8deg); }
/* 颗粒感从 5% 提到 9%，胶片质感更强 */
.hero-grain {
  position: fixed; inset: 0; z-index: 4; pointer-events: none;
  opacity: 0.09; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.hero-main {
  position: relative; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  min-height: 54vh; padding: 6rem 1.5rem 3rem; text-align: center;
}
.hero-content {
  opacity: 0; transform: translateY(28px);
  transition: opacity 1.1s ease 0.2s, transform 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.2s;
}
.hero-content.content-in { opacity: 1; transform: translateY(0); }
.term-tag {
  display: inline-block; font-size: 0.78rem; letter-spacing: 0.14em;
  color: rgba(245, 241, 230, 0.86); padding: 0.35rem 0.95rem; margin-bottom: 1.1rem;
  border-radius: 999px; border: 1px solid rgba(245, 241, 230, 0.28);
  background: rgba(14, 24, 20, 0.26); backdrop-filter: blur(6px);
}
.hero-title {
  font-size: clamp(2.6rem, 7vw, 4.2rem); font-weight: 700; letter-spacing: 0.32em;
  margin: 0 0 0.7rem; padding-left: 0.32em;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.55), 0 1px 4px rgba(0, 0, 0, 0.4);
}
.hero-sub {
  font-size: clamp(0.95rem, 2.2vw, 1.15rem); letter-spacing: 0.22em;
  color: rgba(245, 241, 230, 0.94); margin: 0 0 0.6rem;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}
.hero-quote {
  font-size: 0.88rem; letter-spacing: 0.12em; color: rgba(201, 169, 110, 0.95);
  margin: 0 0 1.6rem; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
}
.hero-cta { display: flex; flex-direction: column; align-items: center; gap: 0.9rem; }
.enter-btn {
  display: inline-flex; align-items: center; gap: 0.7rem;
  padding: 0.85rem 2.6rem 0.85rem 3rem;
  font-family: inherit; font-size: 1.05rem; letter-spacing: 0.4em;
  color: #f5f1e6; border-radius: 999px; border: 1px solid rgba(245, 241, 230, 0.5);
  background: rgba(201, 169, 110, 0.16); backdrop-filter: blur(12px);
  cursor: pointer; transition: all 0.4s ease;
}
.enter-btn:hover {
  background: rgba(201, 169, 110, 0.92); border-color: rgba(201, 169, 110, 0.92);
  color: #2a2114; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
.enter-btn:active { transform: translateY(0) scale(0.98); }
.enter-arrow { transition: transform 0.3s; letter-spacing: 0; }
.enter-btn:hover .enter-arrow { transform: translateX(4px); }
.break-btn {
  background: rgba(201, 169, 110, 0.88); border-color: rgba(201, 169, 110, 0.88);
  color: #2a2114; font-weight: 500; box-shadow: 0 6px 24px rgba(201, 169, 110, 0.35);
}
.break-btn:hover { background: #c9a96e; border-color: #c9a96e; color: #1a1408; box-shadow: 0 10px 32px rgba(201, 169, 110, 0.5); }
.enter-link {
  display: inline-flex; align-items: center; min-height: 2.75rem;
  background: none; border: none; color: rgba(245, 241, 230, 0.55);
  font-size: 0.82rem; letter-spacing: 0.15em; cursor: pointer; padding: 0.3rem 0.6rem;
  transition: color 0.25s; font-family: inherit;
}
.enter-link:hover { color: rgba(245, 241, 230, 0.9); }
.scroll-hint {
  margin-top: 2.2rem; font-size: 0.72rem; letter-spacing: 0.3em;
  color: rgba(245, 241, 230, 0.55); text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  opacity: 0; transition: opacity 1.2s ease 1s;
}
.is-entered .scroll-hint { opacity: 1; }
@media (max-width: 640px) {
  .hero-main { min-height: 58vh; padding-top: 5rem; }
  .mist-a { width: 110vw; }
  .mist-b { width: 100vw; }
}
@media (prefers-reduced-motion: reduce) {
  .hero-img, .mist-a, .mist-b { animation: none; }
  .hero-parallax { transition: none; }
  .hero-video { display: none; }
  .hero-content, .scroll-hint { transition: opacity 0.4s ease; transform: none; }
}
</style>
