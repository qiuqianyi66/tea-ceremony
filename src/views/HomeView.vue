<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getCurrentSolarTerm, getSeasonName } from '@/data/solarTerms'
// 首页茶山实景背景：Tanmoy281 / Wikimedia Commons，CC BY-SA 4.0，详见 README「素材致谢」
import heroImg from '@/assets/tea-mountain-hero.jpg'

const router = useRouter()
const auth = useAuthStore()
const currentTerm = getCurrentSolarTerm()

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

// 茶语（直接叠在茶山上，不再用黑屏开场）
const quotes = [
  '山静无人，水自流。',
  '茶者，南方之嘉木也。',
  '一席茶，一方天地，一念清心。',
  '且将新火试新茶，诗酒趁年华。',
  '坐酌泠泠水，看煎瑟瑟尘。',
]
const teaQuote = ref(quotes[Math.floor(Math.random() * quotes.length)]!)

interface NavItem {
  icon: string
  label: string
  desc: string
  path: string
}
const navItems: NavItem[] = [
  { icon: '🍃', label: '选茶入席', desc: '挑一款今日之茶', path: '/select' },
  { icon: '🗺️', label: '茶产区地图', desc: '遍览中国茶山', path: '/map' },
  { icon: '📚', label: '我的茶柜', desc: '收藏与品鉴记录', path: '/collection' },
  { icon: '🧘', label: '茶修成长', desc: '品茶进阶之路', path: '/profile' },
  { icon: '🤖', label: 'AI 茶灵', desc: '问茶解惑', path: '/ai' },
  { icon: '🔗', label: '茶文化图谱', desc: '探索茶知识', path: '/graph' },
]

function go(path: string) {
  menuOpen.value = false
  router.push(path)
}

// 入席：跳过冗余的十二境文字页，直接进入选茶
function enter() {
  tryStartAudio()
  router.push('/select')
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
  <div class="hero-root" :class="[`time-${timeOfDay}`, { 'is-entered': entered }]" @click="tryStartAudio">
    <!-- 实景茶山背景：外层视差，内层 Ken Burns 缓慢推近 -->
    <div class="hero-parallax" :style="parallaxStyle">
      <img :src="heroImg" alt="晨雾中的茶山茶园" class="hero-img" draggable="false" />
    </div>

    <!-- 晨雾氛围层 -->
    <div class="mist mist-a" aria-hidden="true"></div>
    <div class="mist mist-b" aria-hidden="true"></div>
    <!-- 全局薄雾：柔化天空与远山，营造晨雾冷青调 -->
    <div class="hero-haze" aria-hidden="true"></div>

    <!-- 可读性遮罩：顶部导航渐变 + 底部内容压暗 + 晨雾冷调 -->
    <div class="hero-scrim" aria-hidden="true"></div>
    <div class="hero-grain" aria-hidden="true"></div>

    <!-- 顶部栏 -->
    <header class="hero-topbar">
      <button class="brand" @click.stop="go('/')">
        <span class="brand-seal">茶</span>
        <span class="brand-name">一盏茶</span>
      </button>
      <button class="menu-btn" :aria-expanded="menuOpen" aria-label="打开菜单" @click.stop="menuOpen = true">
        <span></span><span></span><span></span>
      </button>
    </header>

    <!-- 主内容：居中偏下 -->
    <main class="hero-main">
      <div class="hero-content" :class="{ 'content-in': entered }">
        <p class="term-tag">
          今日{{ currentTerm.name }} · {{ getSeasonName(currentTerm.season) }}季 ·
          宜{{ currentTerm.teaTypes.slice(0, 2).join('、') }}
        </p>
        <h1 class="hero-title">一盏茶</h1>
        <p class="hero-sub">给忙碌的一天，留五分钟茶歇</p>
        <p class="hero-quote">{{ teaQuote }}</p>
        <button class="enter-btn" @click.stop="enter">
          <span>入 席</span>
          <span class="enter-arrow">→</span>
        </button>
      </div>
    </main>

    <!-- 底部滚动提示 -->
    <div class="hero-hint" :class="{ 'hint-in': entered }">选茶 · 冲泡 · 品鉴，一方静谧天地</div>

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
.hero-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #0e1a16;
  font-family: 'Noto Serif SC', serif;
}

/* ---------- 背景层 ---------- */
.hero-parallax {
  position: absolute;
  inset: -4%;
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

/* ---------- 晨雾 ---------- */
.mist {
  position: absolute;
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

/* 全局薄雾：自上而下由浓到淡，压柔天空与远山；screen 让高光泛白更接近晨雾 */
.hero-haze {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  mix-blend-mode: screen;
  background:
    linear-gradient(180deg, rgba(228, 238, 233, 0.82) 0%, rgba(228, 238, 233, 0.4) 32%, rgba(228, 238, 233, 0.14) 56%, rgba(228, 238, 233, 0.03) 76%, rgba(228, 238, 233, 0) 100%),
    radial-gradient(130% 85% at 50% 10%, rgba(236, 243, 239, 0.55), transparent 56%);
}

/* ---------- 遮罩 ---------- */
.hero-scrim {
  position: absolute;
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

/* 胶片颗粒 */
.hero-grain {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---------- 顶部栏 ---------- */
.hero-topbar {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 10;
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
}
.menu-btn:hover { background: rgba(14, 24, 20, 0.55); }
.menu-btn span {
  display: block;
  height: 1.5px;
  background: #f3efe4;
  border-radius: 2px;
}

/* ---------- 主内容 ---------- */
.hero-main {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 1.5rem 14vh;
}
.hero-content {
  text-align: center;
  color: #f5f1e6;
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
  margin-bottom: 1.4rem;
  border-radius: 999px;
  border: 1px solid rgba(245, 241, 230, 0.28);
  background: rgba(14, 24, 20, 0.26);
  backdrop-filter: blur(6px);
}
.hero-title {
  font-size: clamp(3.4rem, 9vw, 6rem);
  font-weight: 700;
  letter-spacing: 0.32em;
  margin: 0 0 1rem;
  padding-left: 0.32em; /* 视觉居中抵消字间距 */
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.55), 0 1px 4px rgba(0, 0, 0, 0.4);
}
.hero-sub {
  font-size: clamp(1rem, 2.4vw, 1.3rem);
  letter-spacing: 0.22em;
  color: rgba(245, 241, 230, 0.94);
  margin: 0 0 0.7rem;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}
.hero-quote {
  font-size: 0.9rem;
  letter-spacing: 0.12em;
  color: rgba(201, 169, 110, 0.95);
  margin: 0 0 2.2rem;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
}
.enter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.95rem 3rem;
  font-family: inherit;
  font-size: 1.1rem;
  letter-spacing: 0.4em;
  padding-left: 3.4rem;
  color: #f5f1e6;
  border-radius: 999px;
  border: 1px solid rgba(245, 241, 230, 0.5);
  background: rgba(201, 169, 110, 0.16);
  backdrop-filter: blur(12px);
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

.hero-hint {
  position: absolute;
  bottom: 2.2rem;
  left: 0; right: 0;
  z-index: 8;
  text-align: center;
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  color: rgba(245, 241, 230, 0.6);
  opacity: 0;
  transition: opacity 1.2s ease 1s;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.hero-hint.hint-in { opacity: 1; }

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
  .hero-main { padding-bottom: 12vh; }
  .hero-topbar { padding: 1.1rem 1.1rem; }
  .mist-a { width: 110vw; }
  .mist-b { width: 100vw; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-img, .mist-a, .mist-b { animation: none; }
  .hero-parallax { transition: none; }
  .hero-content, .hero-hint { transition: opacity 0.4s ease; transform: none; }
}
</style>
