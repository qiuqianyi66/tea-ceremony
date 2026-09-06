<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTeaStore } from '@/stores/tea'
import { getCurrentSolarTerm, getSeasonName } from '@/data/solarTerms'
import { teas } from '@/data/teas'
import { TEA_POEMS, type TeaPoem } from '@/data/teaPoems'
import { TEA_MASTERS, type TeaMaster } from '@/data/teaMasters'
import type { Tea } from '@/types/tea'
import { encodeTeaShare, buildTeaShareUrl } from '@/services/share'
// 首页茶山实景背景：Tanmoy281 / Wikimedia Commons，CC BY-SA 4.0，详见 README「素材致谢」
import heroImg from '@/assets/tea-mountain-hero.jpg'

const router = useRouter()
const auth = useAuthStore()
const teaStore = useTeaStore()
const term = getCurrentSolarTerm()

// 当前节气是否已打卡
const termChecked = ref(false)
async function doCheckIn() {
  const ok = await teaStore.checkInSolarTerm(term.id)
  if (ok) termChecked.value = true
}

// 入场与导航抽屉
const entered = ref(false)
const menuOpen = ref(false)

// 鼠标视差（外层位移，与背景 Ken Burns 分层避免冲突）
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

// 茶语（直接叠在茶山上）
const quotes = [
  '山静无人，水自流。',
  '茶者，南方之嘉木也。',
  '一席茶，一方天地，一念清心。',
  '且将新火试新茶，诗酒趁年华。',
  '坐酌泠泠水，看煎瑟瑟尘。',
]
const teaQuote = ref(quotes[Math.floor(Math.random() * quotes.length)]!)

// ===== 内容流数据 =====
// 今日宜饮：按节气推荐茶类筛选，数量不足时用其他茶类补齐
const recommendedTeas = computed<Tea[]>(() => {
  const types = term.teaTypes
  const matched = teas.filter((t) => types.includes(t.type))
  const rest = teas.filter((t) => !types.includes(t.type))
  return [...matched, ...rest].slice(0, 3)
})

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

// 今日茶诗 / 茶人（随机，可换）
const todayPoem = ref<TeaPoem>(pickRandom(TEA_POEMS))
const todayMaster = ref<TeaMaster>(pickRandom(TEA_MASTERS))
function nextPoem() {
  todayPoem.value = pickRandom(TEA_POEMS)
}
function nextMaster() {
  todayMaster.value = pickRandom(TEA_MASTERS)
}

interface NavItem {
  icon: string
  label: string
  desc: string
  path: string
}
// 内容入口置前：让"逛"成为第一选择
const navItems: NavItem[] = [
  { icon: '🗺️', label: '茶产区地图', desc: '遍览 19 省名茶', path: '/map' },
  { icon: '🔗', label: '茶文化图谱', desc: '茶与人 · 茶与诗', path: '/graph' },
  { icon: '🍵', label: '选茶入席', desc: '挑一款今日之茶', path: '/select' },
  { icon: '🧘', label: '茶修成长', desc: '品茶进阶之路', path: '/profile' },
  { icon: '📚', label: '我的茶柜', desc: '收藏与品鉴记录', path: '/collection' },
  { icon: '🤖', label: 'AI 茶灵', desc: '问茶解惑', path: '/ai' },
]

function go(path: string) {
  menuOpen.value = false
  router.push(path)
}

// 入席体验：直达选茶
function enter() {
  tryStartAudio()
  router.push('/select')
}

// 一键茶歇：3 秒静心暂停键（核心首屏钩子）
function startBreak() {
  tryStartAudio()
  router.push('/break')
}

// 分享名茶知识卡（新窗口打开只读分享页）
function shareTea(tea: Tea) {
  const data = {
    teaId: tea.id,
    teaName: tea.name,
    teaType: tea.type,
    origin: tea.origin,
    flavor: tea.flavor,
    description: tea.description,
  }
  const url = buildTeaShareUrl(encodeTeaShare(data))
  window.open(url, '_blank', 'noopener')
}

// 氛围音频（沿用原逻辑，离开首页不停止）
let audioStarted = false
function tryStartAudio() {
  if (audioStarted) return
  audioStarted = true
  import('@/composables/useAudio').then(({ startAmbient, playPourWater }) => {
    startAmbient()
    setTimeout(() => playPourWater(3.0), 1200)
  })
}

function onPointerMove(event: PointerEvent) {
  pointerX.value = event.clientX / window.innerWidth - 0.5
  pointerY.value = event.clientY / window.innerHeight - 0.5
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') menuOpen.value = false
}

// 抽屉打开时锁定背景滚动
watch(menuOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => { entered.value = true }))
  tryStartAudio()
  teaStore.loadSolarCheckins().then(() => {
    termChecked.value = !!teaStore.solarCheckins[term.id]
  })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="home-root" :class="[`time-${timeOfDay}`, { 'is-entered': entered }]" @click="tryStartAudio">
    <!-- 实景茶山背景：固定铺满，内容在其上滚动 -->
    <div class="hero-parallax" :style="parallaxStyle">
      <img :src="heroImg" alt="晨雾中的茶山茶园" class="hero-img" draggable="false" />
    </div>
    <div class="mist mist-a" aria-hidden="true"></div>
    <div class="mist mist-b" aria-hidden="true"></div>
    <div class="hero-haze" aria-hidden="true"></div>
    <div class="hero-scrim" aria-hidden="true"></div>
    <div class="hero-grain" aria-hidden="true"></div>

    <!-- 顶部栏 -->
    <header class="topbar">
      <button class="brand" @click.stop="go('/')">
        <span class="brand-seal">茶</span>
        <span class="brand-name">一盏茶</span>
      </button>
      <button class="menu-btn" :aria-expanded="menuOpen" aria-label="打开菜单" @click.stop="menuOpen = true">
        <span></span><span></span><span></span>
      </button>
    </header>

    <!-- 氛围头图：压缩版 hero，保留入席入口 -->
    <section class="hero-main">
      <div class="hero-content" :class="{ 'content-in': entered }">
        <p class="term-tag">
          今日{{ term.name }} · {{ getSeasonName(term.season) }}季 · 宜{{ term.teaTypes.slice(0, 2).join('、') }}
        </p>
        <h1 class="hero-title">一盏茶</h1>
        <p class="hero-sub">给忙碌的一天，留五分钟茶歇</p>
        <p class="hero-quote">{{ teaQuote }}</p>
        <div class="hero-cta">
          <button class="enter-btn break-btn" @click.stop="startBreak">
            <span>🍵 茶歇 5 分钟</span>
            <span class="enter-arrow">→</span>
          </button>
          <button class="enter-link" @click.stop="enter">
            入席 · 完整泡茶体验 →
          </button>
        </div>
      </div>
      <div class="scroll-hint">向下探索 · 茶之世界</div>
    </section>

    <!-- 内容流：让"逛"成立 -->
    <main class="content-flow">
      <!-- 今日宜饮 -->
      <section class="flow-section">
        <div class="flow-head">
          <h2 class="flow-title">🍵 今日宜饮</h2>
          <button class="flow-more" @click="go('/select')">全部茶叶 →</button>
        </div>
        <p class="flow-desc">{{ term.description }}</p>
        <button v-if="!termChecked" class="checkin-btn" @click="doCheckIn">
          <span>☀️ 打卡 · {{ term.name }}</span>
          <span class="checkin-hint">每节气一次，集齐二十四节气</span>
        </button>
        <button v-else class="checkin-btn checked" disabled>
          <span>✓ 今日节气已打卡</span>
          <span class="checkin-hint">{{ term.name }} · 已收入节气册</span>
        </button>
        <div class="tea-grid">
          <div v-for="tea in recommendedTeas" :key="tea.id" class="tea-card" role="button" tabindex="0"
            @click="go(`/tea/${tea.id}`)" @keydown.enter="go(`/tea/${tea.id}`)">
            <div class="tea-card-top">
              <span class="tea-type">{{ tea.type }}</span>
              <span class="tea-share" role="button" tabindex="0" @click.stop="shareTea(tea)"
                @keydown.enter.stop="shareTea(tea)">↗ 分享</span>
            </div>
            <p class="tea-name">{{ tea.name }}</p>
            <p class="tea-desc">{{ tea.description }}</p>
            <div class="tea-flavors">
              <span v-for="f in tea.flavor" :key="f" class="flavor-pill">{{ f }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 茶产区地图横幅 -->
      <button class="map-banner" @click="go('/map')">
        <div class="map-text">
          <h2 class="map-title">🗺️ 中国茶产区地图</h2>
          <p class="map-desc">19 省名茶产地 · 一图遍览茶山风土</p>
        </div>
        <span class="map-arrow">→</span>
      </button>

      <!-- 今日茶诗 -->
      <section class="flow-section">
        <div class="flow-head">
          <h2 class="flow-title">📜 今日茶诗</h2>
          <button class="flow-more" @click="nextPoem">换一首 ↻</button>
        </div>
        <div class="poem-card">
          <p class="poem-title">{{ todayPoem.title }} · {{ todayPoem.author }}（{{ todayPoem.dynasty }}）</p>
          <p class="poem-content">{{ todayPoem.content }}</p>
          <p class="poem-desc">{{ todayPoem.description }}</p>
        </div>
      </section>

      <!-- 茶人故事 -->
      <section class="flow-section">
        <div class="flow-head">
          <h2 class="flow-title">👤 茶人故事</h2>
          <button class="flow-more" @click="nextMaster">换一位 ↻</button>
        </div>
        <div class="master-card">
          <div class="master-top">
            <span class="master-avatar">{{ todayMaster.avatar }}</span>
            <div>
              <p class="master-name">{{ todayMaster.name }} · {{ todayMaster.title }}</p>
              <p class="master-dynasty">{{ todayMaster.dynasty }}代茶人</p>
            </div>
          </div>
          <p class="master-quote">「{{ todayMaster.quote }}」</p>
          <p class="master-desc">{{ todayMaster.description }}</p>
        </div>
      </section>

      <!-- 图谱 + 茶园 + AI 三列入口 -->
      <section class="entry-grid entry-grid-3">
        <button class="entry-card" @click="go('/graph')">
          <span class="entry-icon">🔗</span>
          <span class="entry-label">茶文化图谱</span>
          <span class="entry-desc">茶与人 · 茶与诗 · 茶与器</span>
        </button>
        <button class="entry-card" @click="go('/garden')">
          <span class="entry-icon">🌱</span>
          <span class="entry-label">我的茶园</span>
          <span class="entry-desc">种茶养茶，14天长成</span>
        </button>
        <button class="entry-card" @click="go('/ai')">
          <span class="entry-icon">🤖</span>
          <span class="entry-label">AI 茶灵</span>
          <span class="entry-desc">问茶解惑，懂茶也懂你</span>
        </button>
      </section>

      <!-- 底部 -->
      <footer class="footer">
        <button class="footer-link" @click="go(auth.isLoggedIn ? '/history' : '/login')">
          {{ auth.isLoggedIn ? '查看品鉴历史' : '登录 / 注册' }}
        </button>
        <p class="footer-note">一盏茶 · Tea Ceremony · 离线可用</p>
      </footer>
    </main>

    <!-- 侧边导航抽屉 -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="menuOpen" class="drawer-mask" @click="menuOpen = false">
          <aside class="drawer" @click.stop>
            <div class="drawer-head">
              <div>
                <p class="drawer-title">一盏茶</p>
                <p class="drawer-user">{{ auth.isLoggedIn ? auth.user?.display_name || '茶人' : '尚未登录 · 茶客' }}</p>
              </div>
              <button class="drawer-close" aria-label="关闭菜单" @click="menuOpen = false">✕</button>
            </div>

            <nav class="drawer-nav">
              <button v-for="item in navItems" :key="item.path" class="drawer-item" @click="go(item.path)">
                <span class="drawer-icon">{{ item.icon }}</span>
                <span class="drawer-text">
                  <span class="drawer-label">{{ item.label }}</span>
                  <span class="drawer-desc">{{ item.desc }}</span>
                </span>
                <span class="drawer-chevron">›</span>
              </button>
            </nav>

            <button class="drawer-auth" @click="go(auth.isLoggedIn ? '/history' : '/login')">
              {{ auth.isLoggedIn ? '查看品鉴历史' : '登录 / 注册' }}
            </button>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.home-root {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  background: #0e1a16;
  font-family: 'Noto Serif SC', serif;
  color: #f5f1e6;
}

/* ---------- 背景层（固定） ---------- */
.hero-parallax {
  position: fixed;
  inset: -4%;
  z-index: 0;
  will-change: transform;
  transition: transform 1.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 52%;
  filter: saturate(0.78) brightness(1.05) contrast(0.96);
  animation: kenburns 26s ease-in-out infinite alternate;
}
@keyframes kenburns {
  from { transform: scale(1); }
  to { transform: scale(1.1) translate(-1.2%, -1%); }
}

.mist {
  position: fixed;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
  z-index: 1;
}
.mist-a {
  top: 6%; left: -12%;
  width: 86vw; height: 44vh;
  background: radial-gradient(ellipse, rgba(238, 244, 241, 0.72), transparent 70%);
  animation: mistDrift 24s ease-in-out infinite alternate;
}
.mist-b {
  top: 22%; right: -14%;
  width: 78vw; height: 38vh;
  background: radial-gradient(ellipse, rgba(226, 237, 231, 0.62), transparent 72%);
  animation: mistDrift 30s ease-in-out infinite alternate-reverse;
}
@keyframes mistDrift {
  from { transform: translateX(-3%) translateY(0); }
  to { transform: translateX(8%) translateY(2%); }
}

.hero-haze {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  mix-blend-mode: screen;
  background:
    linear-gradient(180deg, rgba(228, 238, 233, 0.82) 0%, rgba(228, 238, 233, 0.4) 32%, rgba(228, 238, 233, 0.14) 56%, rgba(228, 238, 233, 0.03) 76%, rgba(228, 238, 233, 0) 100%),
    radial-gradient(130% 85% at 50% 10%, rgba(236, 243, 239, 0.55), transparent 56%);
}

.hero-scrim {
  position: fixed;
  inset: 0;
  z-index: 3;
  pointer-events: none;
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
.time-night .hero-img { filter: saturate(0.7) brightness(0.62) hue-rotate(-8deg); }

.hero-grain {
  position: fixed;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---------- 顶部栏 ---------- */
.topbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.4rem 1.6rem;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #f3efe4;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.brand-seal {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
  background: rgba(201, 169, 110, 0.92);
  color: #2a2114;
  font-size: 1.05rem;
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.brand-name {
  font-size: 1.1rem;
  letter-spacing: 0.35em;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}
.menu-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 2.7rem;
  height: 2.7rem;
  padding: 0 0.7rem;
  border-radius: 10px;
  background: rgba(14, 24, 20, 0.32);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  transition: background 0.3s;
  cursor: pointer;
}
.menu-btn:hover { background: rgba(14, 24, 20, 0.55); }
.menu-btn span {
  display: block;
  height: 1.5px;
  background: #f3efe4;
  border-radius: 2px;
}

/* ---------- 氛围头图 ---------- */
.hero-main {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-height: 54vh;
  padding: 6rem 1.5rem 3rem;
  text-align: center;
}
.hero-content {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 1.1s ease 0.2s, transform 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.2s;
}
.hero-content.content-in { opacity: 1; transform: translateY(0); }

.term-tag {
  display: inline-block;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  color: rgba(245, 241, 230, 0.86);
  padding: 0.35rem 0.95rem;
  margin-bottom: 1.1rem;
  border-radius: 999px;
  border: 1px solid rgba(245, 241, 230, 0.28);
  background: rgba(14, 24, 20, 0.26);
  backdrop-filter: blur(6px);
}
.hero-title {
  font-size: clamp(2.6rem, 7vw, 4.2rem);
  font-weight: 700;
  letter-spacing: 0.32em;
  margin: 0 0 0.7rem;
  padding-left: 0.32em;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.55), 0 1px 4px rgba(0, 0, 0, 0.4);
}
.hero-sub {
  font-size: clamp(0.95rem, 2.2vw, 1.15rem);
  letter-spacing: 0.22em;
  color: rgba(245, 241, 230, 0.94);
  margin: 0 0 0.6rem;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}
.hero-quote {
  font-size: 0.88rem;
  letter-spacing: 0.12em;
  color: rgba(201, 169, 110, 0.95);
  margin: 0 0 1.6rem;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
}
.enter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.85rem 2.6rem;
  font-family: inherit;
  font-size: 1.05rem;
  letter-spacing: 0.4em;
  padding-left: 3rem;
  color: #f5f1e6;
  border-radius: 999px;
  border: 1px solid rgba(245, 241, 230, 0.5);
  background: rgba(201, 169, 110, 0.16);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: all 0.4s ease;
}
.enter-btn:hover {
  background: rgba(201, 169, 110, 0.92);
  border-color: rgba(201, 169, 110, 0.92);
  color: #2a2114;
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
.enter-btn:active { transform: translateY(0) scale(0.98); }
.enter-arrow { transition: transform 0.3s; letter-spacing: 0; }
.enter-btn:hover .enter-arrow { transform: translateX(4px); }

.hero-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}
.break-btn {
  background: rgba(201, 169, 110, 0.88);
  border-color: rgba(201, 169, 110, 0.88);
  color: #2a2114;
  font-weight: 500;
  box-shadow: 0 6px 24px rgba(201, 169, 110, 0.35);
}
.break-btn:hover {
  background: #c9a96e;
  border-color: #c9a96e;
  color: #1a1408;
  box-shadow: 0 10px 32px rgba(201, 169, 110, 0.5);
}
.enter-link {
  background: none;
  border: none;
  color: rgba(245, 241, 230, 0.55);
  font-size: 0.82rem;
  letter-spacing: 0.15em;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  transition: color 0.25s;
  font-family: inherit;
}
.enter-link:hover { color: rgba(245, 241, 230, 0.9); }

.scroll-hint {
  margin-top: 2.2rem;
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  color: rgba(245, 241, 230, 0.55);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 1.2s ease 1s;
}
.is-entered .scroll-hint { opacity: 1; }

/* ---------- 内容流 ---------- */
.content-flow {
  position: relative;
  z-index: 10;
  max-width: 72rem;
  margin: 0 auto;
  padding: 0 1.2rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}
.flow-section {
  background: rgba(16, 26, 22, 0.68);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(245, 241, 230, 0.12);
  border-radius: 1.1rem;
  padding: 1.4rem 1.3rem;
}
.flow-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}
.flow-title {
  font-size: 1.15rem;
  letter-spacing: 0.1em;
  color: #f3efe4;
  margin: 0;
}
.flow-more {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: rgba(201, 169, 110, 0.95);
  transition: opacity 0.25s;
}
.flow-more:hover { opacity: 0.7; }
.flow-desc {
  font-size: 0.82rem;
  line-height: 1.7;
  color: rgba(245, 241, 230, 0.62);
  margin: 0 0 1rem;
}

/* 节气打卡 */
.checkin-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  width: 100%;
  padding: 0.7rem 1rem;
  margin-bottom: 1rem;
  border-radius: 0.8rem;
  border: 1px dashed rgba(201, 169, 110, 0.5);
  background: rgba(201, 169, 110, 0.1);
  color: #f3efe4;
  font-family: inherit;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.28s ease;
}
.checkin-btn:hover {
  background: rgba(201, 169, 110, 0.22);
  border-color: rgba(201, 169, 110, 0.8);
  transform: translateY(-1px);
}
.checkin-btn.checked {
  border-style: solid;
  background: rgba(60, 110, 80, 0.22);
  border-color: rgba(120, 190, 150, 0.5);
  cursor: default;
}
.checkin-hint { font-size: 0.7rem; letter-spacing: 0.06em; color: rgba(245, 241, 230, 0.5); }

.tea-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 0.8rem;
}
.tea-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: left;
  padding: 1rem 1.05rem;
  border-radius: 0.9rem;
  background: rgba(245, 241, 230, 0.06);
  border: 1px solid rgba(245, 241, 230, 0.1);
  color: #f3efe4;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.28s ease;
}
.tea-card:hover {
  background: rgba(201, 169, 110, 0.14);
  border-color: rgba(201, 169, 110, 0.45);
  transform: translateY(-2px);
}
.tea-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tea-type {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgba(201, 169, 110, 0.95);
  border: 1px solid rgba(201, 169, 110, 0.4);
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
}
.tea-org { font-size: 0.72rem; color: rgba(245, 241, 230, 0.5); }
.tea-share {
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: rgba(201, 169, 110, 0.95);
  border: 1px solid rgba(201, 169, 110, 0.4);
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
}
.tea-share:hover {
  background: rgba(201, 169, 110, 0.25);
  border-color: rgba(201, 169, 110, 0.8);
}
.tea-name { font-size: 1.1rem; font-weight: 600; margin: 0.1rem 0 0; }
.tea-desc {
  font-size: 0.76rem;
  line-height: 1.6;
  color: rgba(245, 241, 230, 0.58);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tea-flavors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
}
.flavor-pill {
  font-size: 0.68rem;
  color: rgba(245, 241, 230, 0.78);
  background: rgba(245, 241, 230, 0.08);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
}

/* 地图横幅 */
.map-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  text-align: left;
  padding: 1.5rem 1.6rem;
  border-radius: 1.1rem;
  background: linear-gradient(120deg, rgba(32, 58, 44, 0.82), rgba(22, 38, 30, 0.82));
  backdrop-filter: blur(14px);
  border: 1px solid rgba(201, 169, 110, 0.28);
  color: #f3efe4;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.3s ease;
}
.map-banner:hover {
  border-color: rgba(201, 169, 110, 0.6);
  transform: translateY(-2px);
}
.map-title { font-size: 1.2rem; letter-spacing: 0.08em; margin: 0 0 0.3rem; }
.map-desc { font-size: 0.82rem; color: rgba(245, 241, 230, 0.6); margin: 0; }
.map-arrow { font-size: 1.5rem; color: rgba(201, 169, 110, 0.9); }

/* 茶诗 */
.poem-card {
  padding: 1.1rem 1.2rem;
  border-radius: 0.9rem;
  background: rgba(245, 241, 230, 0.05);
  border: 1px solid rgba(245, 241, 230, 0.08);
}
.poem-title {
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  color: rgba(201, 169, 110, 0.95);
  margin: 0 0 0.6rem;
}
.poem-content {
  font-size: 0.95rem;
  line-height: 2;
  color: #f3efe4;
  margin: 0 0 0.7rem;
  white-space: pre-line;
}
.poem-desc {
  font-size: 0.78rem;
  line-height: 1.7;
  color: rgba(245, 241, 230, 0.55);
  margin: 0;
}

/* 茶人 */
.master-card {
  padding: 1.1rem 1.2rem;
  border-radius: 0.9rem;
  background: rgba(245, 241, 230, 0.05);
  border: 1px solid rgba(245, 241, 230, 0.08);
}
.master-top {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.7rem;
}
.master-avatar {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  font-size: 1.3rem;
  border-radius: 50%;
  background: rgba(201, 169, 110, 0.16);
  border: 1px solid rgba(201, 169, 110, 0.35);
}
.master-name { font-size: 1rem; color: #f3efe4; margin: 0; }
.master-dynasty { font-size: 0.72rem; color: rgba(245, 241, 230, 0.5); margin: 0.15rem 0 0; }
.master-quote {
  font-size: 0.9rem;
  line-height: 1.8;
  color: rgba(201, 169, 110, 0.95);
  margin: 0 0 0.6rem;
}
.master-desc {
  font-size: 0.78rem;
  line-height: 1.7;
  color: rgba(245, 241, 230, 0.55);
  margin: 0;
}

/* 双列入口 */
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.8rem;
}
.entry-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  padding: 1.2rem 1.2rem;
  border-radius: 1rem;
  background: rgba(16, 26, 22, 0.68);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(245, 241, 230, 0.12);
  color: #f3efe4;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.28s ease;
}
.entry-card:hover {
  border-color: rgba(201, 169, 110, 0.5);
  background: rgba(24, 38, 32, 0.8);
  transform: translateY(-2px);
}
.entry-icon { font-size: 1.4rem; }
.entry-label { font-size: 1rem; letter-spacing: 0.08em; }
.entry-desc { font-size: 0.74rem; color: rgba(245, 241, 230, 0.52); }

/* 底部 */
.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 2rem 0 0.5rem;
}
.footer-link {
  background: none;
  border: 1px solid rgba(245, 241, 230, 0.3);
  border-radius: 999px;
  padding: 0.6rem 1.8rem;
  font-family: inherit;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  color: #f3efe4;
  cursor: pointer;
  transition: all 0.3s;
}
.footer-link:hover {
  background: rgba(201, 169, 110, 0.9);
  border-color: rgba(201, 169, 110, 0.9);
  color: #2a2114;
}
.footer-note { font-size: 0.7rem; letter-spacing: 0.2em; color: rgba(245, 241, 230, 0.35); margin: 0; }

/* ---------- 抽屉 ---------- */
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(8, 14, 12, 0.5);
  backdrop-filter: blur(3px);
}
.drawer {
  position: absolute;
  top: 0; right: 0;
  display: flex;
  flex-direction: column;
  width: min(86vw, 360px);
  height: 100%;
  padding: 1.6rem 1.3rem;
  background: linear-gradient(170deg, rgba(22, 32, 27, 0.97), rgba(14, 21, 18, 0.98));
  border-left: 1px solid rgba(201, 169, 110, 0.22);
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.4);
}
.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 1.3rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.drawer-title {
  font-size: 1.4rem;
  letter-spacing: 0.3em;
  color: #f3efe4;
  margin: 0 0 0.3rem;
}
.drawer-user { font-size: 0.82rem; color: rgba(245, 241, 230, 0.55); margin: 0; }
.drawer-close {
  width: 2.2rem; height: 2.2rem;
  border-radius: 8px;
  color: rgba(245, 241, 230, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: all 0.3s;
}
.drawer-close:hover { color: #f3efe4; border-color: rgba(255, 255, 255, 0.3); }
.drawer-nav { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; overflow-y: auto; }
.drawer-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  text-align: left;
  padding: 0.85rem 0.7rem;
  border-radius: 12px;
  color: #f3efe4;
  background: none;
  border: none;
  font-family: inherit;
  transition: background 0.25s;
}
.drawer-item:hover { background: rgba(255, 255, 255, 0.06); }
.drawer-icon { font-size: 1.35rem; }
.drawer-text { flex: 1; display: flex; flex-direction: column; }
.drawer-label { color: #f0ebde; font-size: 1rem; letter-spacing: 0.08em; }
.drawer-desc { color: rgba(240, 235, 222, 0.45); font-size: 0.74rem; margin-top: 2px; }
.drawer-chevron { color: rgba(201, 169, 110, 0.7); font-size: 1.3rem; }
.drawer-auth {
  margin-top: 1rem;
  padding: 0.85rem;
  border-radius: 12px;
  font-family: inherit;
  letter-spacing: 0.15em;
  color: #2a2114;
  background: rgba(201, 169, 110, 0.9);
  transition: background 0.3s;
}
.drawer-auth:hover { background: rgba(201, 169, 110, 1); }

.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.3s ease; }
.drawer-fade-enter-active .drawer, .drawer-fade-leave-active .drawer { transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1); }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }
.drawer-fade-enter-from .drawer, .drawer-fade-leave-to .drawer { transform: translateX(100%); }

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .hero-main { min-height: 58vh; padding-top: 5rem; }
  .topbar { padding: 1.1rem 1.1rem; }
  .mist-a { width: 110vw; }
  .mist-b { width: 100vw; }
  .content-flow { padding: 0 0.9rem 3rem; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-img, .mist-a, .mist-b { animation: none; }
  .hero-parallax { transition: none; }
  .hero-content, .scroll-hint { transition: opacity 0.4s ease; transform: none; }
}
</style>
