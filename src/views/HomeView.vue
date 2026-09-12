<script setup lang="ts">
/**
 * 首页：编排层（Hero + 内容流 + 抽屉）
 * 视觉层下沉到 views/home/ 子组件，业务逻辑保留在此。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTeaStore } from '@/stores/tea'
import { useProgressStore } from '@/stores/progress'
import { getCurrentSolarTerm } from '@/data/solarTerms'
import { teas } from '@/data/teas'
import { TEA_POEMS, type TeaPoem } from '@/data/teaPoems'
import { TEA_MASTERS, type TeaMaster } from '@/data/teaMasters'
import type { Tea } from '@/types/tea'
import { encodeTeaShare, buildTeaShareUrl } from '@/services/share'
import HomeHero from './home/HomeHero.vue'
import HomeDrawer from './home/HomeDrawer.vue'
import HomeTeaCard from './home/HomeTeaCard.vue'

const router = useRouter()
const auth = useAuthStore()
const teaStore = useTeaStore()
const progress = useProgressStore()
const term = getCurrentSolarTerm()

const termChecked = ref(false)
async function doCheckIn() {
  const ok = await progress.checkInSolarTerm(term.id)
  if (ok) termChecked.value = true
}

const menuOpen = ref(false)

const recommendedTeas = computed<Tea[]>(() => {
  const types = term.teaTypes
  const matched = teas.filter((t) => types.includes(t.type))
  const rest = teas.filter((t) => !types.includes(t.type))
  return [...matched, ...rest].slice(0, 3)
})

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

const todayPoem = ref<TeaPoem>(pickRandom(TEA_POEMS))
const todayMaster = ref<TeaMaster>(pickRandom(TEA_MASTERS))
function nextPoem() { todayPoem.value = pickRandom(TEA_POEMS) }
function nextMaster() { todayMaster.value = pickRandom(TEA_MASTERS) }

interface NavItem { icon: string; label: string; desc: string; path: string }
const navItems: NavItem[] = [
  { icon: 'Map', label: '茶产区地图', desc: '遍览 19 省名茶', path: '/map' },
  { icon: 'Share2', label: '茶文化图谱', desc: '茶与人 · 茶与诗', path: '/graph' },
  { icon: 'CupSoda', label: '选茶入席', desc: '挑一款今日之茶', path: '/select' },
  { icon: 'Heart', label: '茶修成长', desc: '品茶进阶之路', path: '/profile' },
  { icon: 'BookOpen', label: '我的茶柜', desc: '收藏与品鉴记录', path: '/collection' },
  { icon: 'Bot', label: 'AI 茶灵', desc: '问茶解惑', path: '/ai' },
]

function go(path: string) { router.push(path) }

function shareTea(tea: Tea) {
  const data = {
    teaId: tea.id, teaName: tea.name, teaType: tea.type,
    origin: tea.origin, flavor: tea.flavor,
    description: tea.description, story: tea.story,
  }
  window.open(buildTeaShareUrl(encodeTeaShare(data)), '_blank', 'noopener')
}

let audioStarted = false
function tryStartAudio() {
  if (audioStarted) return
  audioStarted = true
  import('@/composables/useAudio').then(({ startAmbient, playPourWater }) => {
    startAmbient()
    setTimeout(() => playPourWater(3.0), 1200)
  })
}

// 滚动入场：IntersectionObserver 观察 .flow-section，进入视口归位
let observer: IntersectionObserver | null = null

onMounted(() => {
  tryStartAudio()
  progress.loadSolarCheckins().then(() => {
    termChecked.value = !!progress.solarCheckins[term.id]
  })
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in-view')
          observer?.unobserve(e.target)
        }
      }
    },
    { threshold: 0.1 },
  )
  requestAnimationFrame(() => {
    document.querySelectorAll('.flow-section, .map-banner, .entry-card').forEach((el) => {
      observer?.observe(el)
    })
  })
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="home-root" @click="tryStartAudio">
    <HomeHero />

    <header class="topbar">
      <button class="brand" @click.stop="go('/')">
        <span class="brand-seal">茶</span>
        <span class="brand-name">一盏茶</span>
      </button>
      <button class="menu-btn" :aria-expanded="menuOpen" aria-label="打开菜单" @click.stop="menuOpen = true">
        <span></span><span></span><span></span>
      </button>
    </header>

    <main class="content-flow">
      <section class="flow-section">
        <div class="flow-head">
          <h2 class="flow-title"><IconCupSoda class="inline-block -mt-1" /> 今日宜饮</h2>
          <button class="flow-more" @click="go('/select')">全部茶叶 →</button>
        </div>
        <p class="flow-desc">{{ term.description }}</p>
        <button v-if="!termChecked" class="checkin-btn" @click="doCheckIn">
          <span><IconSun class="inline-block -mt-1" /> 打卡 · {{ term.name }}</span>
          <span class="checkin-hint">每节气一次，集齐二十四节气</span>
        </button>
        <button v-else class="checkin-btn checked" disabled>
          <span><IconCheck class="inline-block -mt-0.5 w-4 h-4" /> 今日节气已打卡</span>
          <span class="checkin-hint">{{ term.name }} · 已收入节气册</span>
        </button>
        <div class="tea-grid">
          <HomeTeaCard v-for="tea in recommendedTeas" :key="tea.id" :tea="tea"
            @open="go(`/tea/${$event.id}`)" @share="shareTea" />
        </div>
      </section>

      <button class="map-banner" @click="go('/map')">
        <div class="map-text">
          <h2 class="map-title"><IconMap class="inline-block -mt-1" /> 中国茶产区地图</h2>
          <p class="map-desc">19 省名茶产地 · 一图遍览茶山风土</p>
        </div>
        <span class="map-arrow">→</span>
      </button>

      <section class="flow-section">
        <div class="flow-head">
          <h2 class="flow-title"><IconScrollText class="inline-block -mt-1" /> 今日茶诗</h2>
          <button class="flow-more" @click="nextPoem">换一首 ↻</button>
        </div>
        <div class="poem-card">
          <p class="poem-title">{{ todayPoem.title }} · {{ todayPoem.author }}（{{ todayPoem.dynasty }}）</p>
          <p class="poem-content">{{ todayPoem.content }}</p>
          <p class="poem-desc">{{ todayPoem.description }}</p>
        </div>
      </section>

      <section class="flow-section">
        <div class="flow-head">
          <h2 class="flow-title"><IconUser class="inline-block -mt-1" /> 茶人故事</h2>
          <button class="flow-more" @click="nextMaster">换一位 ↻</button>
        </div>
        <div class="master-card">
          <div class="master-top">
            <component :is="`Icon${todayMaster.avatar}`" class="master-avatar text-[var(--color-tea-gold)]" />
            <div>
              <p class="master-name">{{ todayMaster.name }} · {{ todayMaster.title }}</p>
              <p class="master-dynasty">{{ todayMaster.dynasty }}代茶人</p>
            </div>
          </div>
          <p class="master-quote">「{{ todayMaster.quote }}」</p>
          <p class="master-desc">{{ todayMaster.description }}</p>
        </div>
      </section>

      <section class="entry-grid entry-grid-3">
        <button class="entry-card" @click="go('/graph')">
          <IconShare2 class="entry-icon" />
          <span class="entry-label">茶文化图谱</span>
          <span class="entry-desc">茶与人 · 茶与诗 · 茶与器</span>
        </button>
        <button class="entry-card" @click="go('/garden')">
          <IconSprout class="entry-icon" />
          <span class="entry-label">我的茶园</span>
          <span class="entry-desc">种茶养茶，14天长成</span>
        </button>
        <button class="entry-card" @click="go('/ai')">
          <IconBot class="entry-icon" />
          <span class="entry-label">AI 茶灵</span>
          <span class="entry-desc">问茶解惑，懂茶也懂你</span>
        </button>
      </section>

      <footer class="footer">
        <button class="footer-link" @click="go(auth.isLoggedIn ? '/history' : '/login')">
          {{ auth.isLoggedIn ? '查看品鉴历史' : '登录 / 注册' }}
        </button>
        <p class="footer-note">一盏茶 · Tea Ceremony · 离线可用</p>
      </footer>
    </main>

    <HomeDrawer v-model:open="menuOpen" :items="navItems" />
  </div>
</template>

<style scoped>
.home-root {
  position: relative; min-height: 100vh; overflow-x: hidden;
  background: #0e1a16;
  font-family: 'Noto Serif SC', serif;
  color: #f5f1e6;
}

/* 顶部栏 */
.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.4rem 1.6rem;
}
.brand {
  display: flex; align-items: center; min-height: 2.75rem; gap: 0.6rem;
  color: #f3efe4; background: none; border: none; cursor: pointer; font-family: inherit;
}
.brand-seal {
  display: grid; place-items: center; width: 2rem; height: 2rem;
  border-radius: 6px; background: rgba(201, 169, 110, 0.92); color: #2a2114;
  font-size: 1.05rem; font-weight: 700; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.brand-name { font-size: 1.1rem; letter-spacing: 0.35em; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5); }
.menu-btn {
  display: flex; flex-direction: column; justify-content: center; gap: 5px;
  width: 2.75rem; height: 2.75rem; padding: 0 0.7rem;
  border-radius: 10px; background: rgba(14, 24, 20, 0.32);
  backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.16);
  transition: background 0.3s; cursor: pointer;
}
.menu-btn:hover { background: rgba(14, 24, 20, 0.55); }
.menu-btn span { display: block; height: 1.5px; background: #f3efe4; border-radius: 2px; }

/* 内容流 */
.content-flow {
  position: relative; z-index: 10;
  max-width: 72rem; margin: 0 auto; padding: 0 1.2rem 4rem;
  display: flex; flex-direction: column; gap: 1.6rem;
}
.flow-section, .map-banner, .entry-card {
  /* 滚动入场：初始上移，进入视口后归位（不做隐藏，避免 observer 失败时内容消失） */
  opacity: 1; transform: translateY(24px);
  transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.flow-section.in-view, .map-banner.in-view, .entry-card.in-view {
  transform: translateY(0);
}
.flow-section {
  background: rgba(16, 26, 22, 0.68); backdrop-filter: blur(14px);
  border: 1px solid rgba(245, 241, 230, 0.12);
  border-radius: 1.1rem; padding: 1.4rem 1.3rem;
}
.flow-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.7rem; }
.flow-title { font-size: 1.15rem; letter-spacing: 0.1em; color: #f3efe4; margin: 0; }
.flow-more {
  display: inline-flex; align-items: center; min-height: 2.75rem;
  background: none; border: none; cursor: pointer; font-family: inherit;
  font-size: 0.8rem; letter-spacing: 0.08em;
  color: rgba(201, 169, 110, 0.95); transition: opacity 0.25s;
}
.flow-more:hover { opacity: 0.7; }
.flow-desc { font-size: 0.82rem; line-height: 1.7; color: rgba(245, 241, 230, 0.62); margin: 0 0 1rem; }

.checkin-btn {
  display: flex; align-items: center; justify-content: space-between; gap: 0.8rem;
  width: 100%; padding: 0.7rem 1rem; margin-bottom: 1rem;
  border-radius: 0.8rem; border: 1px dashed rgba(201, 169, 110, 0.5);
  background: rgba(201, 169, 110, 0.1); color: #f3efe4;
  font-family: inherit; font-size: 0.9rem; letter-spacing: 0.08em;
  cursor: pointer; transition: all 0.28s ease;
}
.checkin-btn:hover { background: rgba(201, 169, 110, 0.22); border-color: rgba(201, 169, 110, 0.8); transform: translateY(-1px); }
.checkin-btn.checked { border-style: solid; background: rgba(60, 110, 80, 0.22); border-color: rgba(120, 190, 150, 0.5); cursor: default; }
.checkin-hint { font-size: 0.7rem; letter-spacing: 0.06em; color: rgba(245, 241, 230, 0.5); }

.tea-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.8rem; }

.map-banner {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; text-align: left; padding: 1.5rem 1.6rem;
  border-radius: 1.1rem;
  background: linear-gradient(120deg, rgba(32, 58, 44, 0.82), rgba(22, 38, 30, 0.82));
  backdrop-filter: blur(14px); border: 1px solid rgba(201, 169, 110, 0.28);
  color: #f3efe4; font-family: inherit; cursor: pointer;
  transition: all 0.3s ease;
}
.map-banner:hover { border-color: rgba(201, 169, 110, 0.6); transform: translateY(-2px); }
.map-title { font-size: 1.2rem; letter-spacing: 0.08em; margin: 0 0 0.3rem; }
.map-desc { font-size: 0.82rem; color: rgba(245, 241, 230, 0.6); margin: 0; }
.map-arrow { font-size: 1.5rem; color: rgba(201, 169, 110, 0.9); }

.poem-card, .master-card {
  padding: 1.1rem 1.2rem; border-radius: 0.9rem;
  background: rgba(245, 241, 230, 0.05); border: 1px solid rgba(245, 241, 230, 0.08);
}
.poem-title { font-size: 0.82rem; letter-spacing: 0.08em; color: rgba(201, 169, 110, 0.95); margin: 0 0 0.6rem; }
.poem-content { font-size: 0.95rem; line-height: 2; color: #f3efe4; margin: 0 0 0.7rem; white-space: pre-line; }
.poem-desc { font-size: 0.78rem; line-height: 1.7; color: rgba(245, 241, 230, 0.55); margin: 0; }
.master-top { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.7rem; }
.master-avatar {
  display: grid; place-items: center; width: 2.6rem; height: 2.6rem;
  font-size: 1.3rem; border-radius: 50%;
  background: rgba(201, 169, 110, 0.16); border: 1px solid rgba(201, 169, 110, 0.35);
}
.master-name { font-size: 1rem; color: #f3efe4; margin: 0; }
.master-dynasty { font-size: 0.72rem; color: rgba(245, 241, 230, 0.5); margin: 0.15rem 0 0; }
.master-quote { font-size: 0.9rem; line-height: 1.8; color: rgba(201, 169, 110, 0.95); margin: 0 0 0.6rem; }
.master-desc { font-size: 0.78rem; line-height: 1.7; color: rgba(245, 241, 230, 0.55); margin: 0; }

.entry-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem; }
.entry-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 0.3rem;
  padding: 1.2rem 1.2rem; border-radius: 1rem;
  background: rgba(16, 26, 22, 0.68); backdrop-filter: blur(14px);
  border: 1px solid rgba(245, 241, 230, 0.12);
  color: #f3efe4; font-family: inherit; text-align: left; cursor: pointer;
  transition: all 0.28s ease;
}
.entry-card:hover { border-color: rgba(201, 169, 110, 0.5); background: rgba(24, 38, 32, 0.8); transform: translateY(-2px); }
.entry-icon { font-size: 1.4rem; }
.entry-label { font-size: 1rem; letter-spacing: 0.08em; }
.entry-desc { font-size: 0.74rem; color: rgba(245, 241, 230, 0.52); }

.footer { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; padding: 2rem 0 0.5rem; }
.footer-link {
  background: none; border: 1px solid rgba(245, 241, 230, 0.3);
  border-radius: 999px; padding: 0.75rem 1.8rem;
  font-family: inherit; font-size: 0.85rem; letter-spacing: 0.15em;
  color: #f3efe4; cursor: pointer; transition: all 0.3s;
}
.footer-link:hover { background: rgba(201, 169, 110, 0.9); border-color: rgba(201, 169, 110, 0.9); color: #2a2114; }
.footer-note { font-size: 0.7rem; letter-spacing: 0.2em; color: rgba(245, 241, 230, 0.35); margin: 0; }

@media (max-width: 640px) {
  .topbar { padding: 1.1rem 1.1rem; }
  .content-flow { padding: 0 0.9rem 3rem; }
}
@media (prefers-reduced-motion: reduce) {
  .flow-section, .map-banner, .entry-card { opacity: 1; transform: none; transition: none; }
}
</style>
