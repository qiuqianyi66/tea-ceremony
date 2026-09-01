<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { TEA_ROOM_THEMES } from '@/data/themes'
import { getCurrentSolarTerm, getSeasonName } from '@/data/solarTerms'

const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
const showThemePicker = ref(false)
const currentTerm = getCurrentSolarTerm()
const sceneVisible = ref(false)
const showContent = ref(false)
const showQuote = ref(false)
const pointerX = ref(0)
const pointerY = ref(0)
const sceneStyle = computed(() => ({
  '--scene-x': `${pointerX.value}px`,
  '--scene-y': `${pointerY.value}px`,
}))
const timeOfDay = computed(() => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'night'
})

// 第一幕：茶语
const teaQuote = ref('')
const quotes = [
  '茶者，南方之嘉木也。',
  '山静无人，水自流。',
  '一席茶，一方天地，一念清心。',
  '且将新火试新茶，诗酒趁年华。',
  '茶香醉人何须酒。',
]

// 音频在首页自动启动
let audioStarted = false
function tryStartAudio() {
  if (audioStarted) return
  audioStarted = true
  import('@/composables/useAudio').then(({ startAmbient, playPourWater }) => {
    startAmbient()
    // 首次进入播放流水声营造氛围
    setTimeout(() => playPourWater(3.0), 1200)
  })
}

onMounted(() => {
  // 1. 黑屏 → 茶语 (1.2s)
  setTimeout(() => {
    teaQuote.value = quotes[Math.floor(Math.random() * quotes.length)]!
    showQuote.value = true
  }, 600)

  // 2. 茶语渐隐 → 渐显场景 (2.5s)
  setTimeout(() => {
    showQuote.value = false
    sceneVisible.value = true
  }, 2500)

  // 2. 尝试启动音效（需要用户交互，加一个兜底）
  tryStartAudio()
  window.addEventListener('pointermove', handleScenePointerMove, { passive: true })

  // 3. 全部渐显后展示内容 (2.5s)
  setTimeout(() => {
    showContent.value = true
  }, 2500)
})

onUnmounted(() => {
  // 离开首页时不停音乐，让其他页面继续播放
  window.removeEventListener('pointermove', handleScenePointerMove)
})

function handleScenePointerMove(event: PointerEvent) {
  pointerX.value = (event.clientX / window.innerWidth - 0.5) * 10
  pointerY.value = (event.clientY / window.innerHeight - 0.5) * 6
}
</script>

<template>
  <!-- 初始黑屏 -->
  <div class="fixed inset-0 bg-black z-50 transition-opacity duration-1000"
    :class="sceneVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'">
  </div>

  <!-- 第一幕：茶语 -->
  <div class="fixed inset-0 z-40 flex items-center justify-center transition-opacity duration-800"
    :class="showQuote ? 'opacity-100' : 'opacity-0 pointer-events-none'">
    <p class="text-2xl sm:text-3xl text-[var(--color-tea-gold)] font-serif tracking-widest opacity-80 text-center px-8"
      style="font-family: 'Noto Serif SC', serif;">
      {{ teaQuote }}
    </p>
  </div>

  <!-- 主场景 -->
  <div class="min-h-screen bg-[var(--color-cream)] flex flex-col items-center justify-center overflow-hidden relative" :class="`time-${timeOfDay}`" :style="sceneStyle">
    <!-- 茶室空间层：墙面、窗、地面和晨雾，先建立真实空间再放置茶席 -->
    <div class="tea-room-wall" :class="sceneVisible ? 'scene-layer-visible' : ''"></div>
    <div class="tea-room-window" :class="sceneVisible ? 'scene-layer-visible' : ''">
      <div class="window-glow"></div>
      <div class="window-muntin window-muntin-v"></div>
      <div class="window-muntin window-muntin-h"></div>
      <div class="window-branch"></div>
    </div>
    <div class="room-light-pool" aria-hidden="true"></div>
    <div class="tea-room-floor" :class="sceneVisible ? 'scene-layer-visible' : ''"></div>
    <div class="tea-room-dust" aria-hidden="true">
      <i v-for="i in 10" :key="i" :style="{ left: `${8 + i * 9}%`, top: `${25 + (i * 13) % 42}%`, animationDelay: `${i * .6}s` }"></i>
    </div>

    <!-- 竹影（背景层）-->
    <div class="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-2000"
      :class="sceneVisible ? 'opacity-30' : ''">
      <div v-for="i in 6" :key="i"
        class="absolute bottom-0 w-2 bg-[var(--color-wood)] rounded-full bamboo-stalk"
        :style="{
          left: `${8 + i * 16}%`,
          height: `${40 + Math.sin(i * 1.5) * 20}%`,
          animationDelay: `${i * 0.3}s`,
        }">
      </div>
    </div>

    <!-- 竹叶（CSS 绘制）-->
    <div class="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-2000"
      :class="sceneVisible ? 'opacity-40' : ''">
      <div v-for="i in 12" :key="'leaf'+i"
        class="absolute leaf"
        :style="{
          left: `${5 + i * 8}%`,
          top: `${20 + Math.sin(i * 2) * 15}%`,
          width: `${20 + Math.sin(i) * 10}px`,
          height: `${4 + Math.sin(i * 1.5) * 2}px`,
          transform: `rotate(${30 + Math.sin(i * 1.5) * 20}deg)`,
          animationDelay: `${i * 0.5}s`,
        }">
      </div>
    </div>

    <!-- 主视觉 -->
    <div class="relative z-10 flex flex-col items-center transition-all duration-1500"
      :class="sceneVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'">

      <!-- 木桌 -->
      <div class="tea-table relative w-72 sm:w-96 h-40">
        <!-- 桌面 -->
        <div class="absolute bottom-8 left-0 right-0 h-4 bg-[var(--color-wood)] rounded-sm
          shadow-[0_4px_12px_rgba(0,0,0,0.2)]"></div>
        <!-- 桌腿 -->
        <div class="absolute bottom-0 left-8 w-2 h-8 bg-[var(--color-wood)] rounded-sm"></div>
        <div class="absolute bottom-0 right-8 w-2 h-8 bg-[var(--color-wood)] rounded-sm"></div>

        <!-- 茶席（桌布）-->
        <div class="absolute bottom-10 left-8 right-8 h-2 bg-[var(--color-tea-gold)] rounded-sm opacity-60"></div>

        <!-- 茶壶（SVG 风格）-->
        <div class="teapot absolute bottom-12 left-1/2 -translate-x-1/2 opacity-0 transition-all duration-1000 delay-500"
          :class="sceneVisible ? 'opacity-100' : ''">
          <svg width="48" height="40" viewBox="0 0 48 40">
            <!-- 壶身 -->
            <ellipse cx="24" cy="28" rx="20" ry="12" fill="#5D4E37" opacity="0.85"/>
            <!-- 壶盖 -->
            <ellipse cx="24" cy="18" rx="14" ry="4" fill="#8B7355"/>
            <!-- 壶钮 -->
            <circle cx="24" cy="15" r="3" fill="#C9A96E"/>
            <!-- 壶嘴 -->
            <path d="M44 24 L48 18 L46 16" stroke="#5D4E37" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <!-- 壶把 -->
            <path d="M4 24 C0 20 -2 28 4 32" stroke="#5D4E37" stroke-width="2.5" fill="none"/>
          </svg>
        </div>

        <!-- 品茗杯 -->
        <div class="cup absolute bottom-11 left-1/3 -translate-x-2 opacity-0 transition-all duration-1000 delay-700"
          :class="sceneVisible ? 'opacity-100' : ''">
          <svg width="20" height="24" viewBox="0 0 20 24">
            <path d="M4 22 L16 22 L18 6 L2 6 Z" fill="#F5F0E8" stroke="#8B7355" stroke-width="1"/>
            <!-- 茶汤 -->
            <rect x="4" y="14" width="12" height="6" rx="1" fill="#C9A96E" opacity="0.6"/>
          </svg>
        </div>

        <!-- 香炉 -->
        <div class="incense absolute -right-4 bottom-14 opacity-0 transition-all duration-1000 delay-900"
          :class="sceneVisible ? 'opacity-100' : ''">
          <svg width="24" height="28" viewBox="0 0 24 28">
            <rect x="4" y="14" width="16" height="12" rx="2" fill="#8B7355"/>
            <rect x="2" y="24" width="20" height="3" rx="1" fill="#5D4E37"/>
            <circle cx="16" cy="18" r="3" fill="none" stroke="#C9A96E" stroke-width="1"/>
            <path d="M12 14 Q14 10 12 6 Q10 2 12 -2" stroke="#999" stroke-width="1.5" fill="none" class="incense-smoke" opacity="0.5"/>
          </svg>
        </div>

        <!-- 挂画（书法卷轴）-->
        <div class="absolute -left-12 top-[-20px] opacity-0 transition-all duration-1500 delay-1100"
          :class="sceneVisible ? 'opacity-100' : ''">
          <svg width="60" height="80" viewBox="0 0 60 80">
            <rect x="25" y="0" width="10" height="80" rx="3" fill="#8B7355"/>
            <rect x="28" y="4" width="4" height="72" rx="1" fill="#F5F0E8"/>
            <!-- 墨迹 -->
            <text x="30" y="30" font-size="6" fill="#3D3225" text-anchor="middle" font-family="serif">茶</text>
            <text x="30" y="42" font-size="4" fill="#3D3225" text-anchor="middle" font-family="serif">禅</text>
            <text x="30" y="52" font-size="3" fill="#3D3225" text-anchor="middle" font-family="serif">一</text>
            <text x="30" y="60" font-size="3" fill="#3D3225" text-anchor="middle" font-family="serif">味</text>
          </svg>
        </div>

        <!-- 插花 -->
        <div class="absolute left-10 bottom-12 opacity-0 transition-all duration-1000 delay-700"
          :class="sceneVisible ? 'opacity-100' : ''">
          <svg width="20" height="30" viewBox="0 0 20 30">
            <!-- 瓶 -->
            <path d="M6 30 L14 30 L12 18 L8 18 Z" fill="#8B7355" opacity="0.8"/>
            <!-- 枝 -->
            <path d="M10 18 Q8 8 12 4" stroke="#5D4E37" stroke-width="1" fill="none"/>
            <path d="M10 18 Q12 10 6 6" stroke="#5D4E37" stroke-width="0.8" fill="none"/>
            <!-- 花 -->
            <circle cx="12" cy="4" r="2" fill="#C9A96E" opacity="0.8"/>
            <circle cx="6" cy="6" r="1.5" fill="#C9A96E" opacity="0.6"/>
          </svg>
        </div>
      </div>

      <!-- 标题区域（延迟显示）-->
      <div class="text-center mt-6 transition-all duration-1000 delay-1000"
        :class="showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'">
        <h1 class="text-5xl sm:text-7xl font-bold text-[var(--color-wood)] mb-3 tracking-widest"
          style="font-family: 'Noto Serif SC', serif;">
          一盏茶
        </h1>
        <p class="text-base sm:text-lg text-[var(--color-wood-light)] mb-2 tracking-wide">
          一席茶，一方天地，一念清心
        </p>
        <p class="text-sm text-[var(--color-tea-gold)] mb-1 italic tracking-wider opacity-70">
          山静无人，水自流
        </p>
        <div class="text-xs text-[var(--color-wood-light)] mb-6">
          <span class="inline-block px-2 py-0.5 rounded-full border border-[var(--color-tea-gold)]/30">
            今日{{ currentTerm.name }} · {{ getSeasonName(currentTerm.season) }}季 · 宜{{ currentTerm.teaTypes.slice(0, 2).join('、') }}
          </span>
        </div>

        <!-- 入席按钮 -->
        <button @click="router.push('/tearoom')"
          class="group relative px-14 py-4 text-lg tracking-widest
            text-[var(--color-cream)] bg-[var(--color-wood)]
            rounded-lg overflow-hidden
            transition-all duration-500 hover:bg-[var(--color-wood-light)]
            hover:shadow-lg hover:shadow-[var(--color-wood)]/30
            active:scale-95"
          @mouseenter="tryStartAudio()">
          <span class="relative z-10">入 席</span>
          <!-- 按钮光效 -->
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
            translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
        </button>
      </div>
    </div>

    <!-- 底部水墨装饰 -->
    <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--color-paper)] to-transparent opacity-50"></div>

    <!-- 点击任意处启动音频（用户交互要求）-->
    <div class="fixed inset-0 z-0 cursor-default" @click="tryStartAudio"></div>

    <!-- 用户菜单 -->
    <div class="fixed top-4 left-4 right-4 z-20 flex flex-wrap justify-end gap-2">
      <!-- 主题切换 -->
      <div class="relative">
        <button @click="showThemePicker = !showThemePicker" aria-label="切换茶室主题" :aria-expanded="showThemePicker"
          class="glass-panel px-3 py-2 rounded-lg text-sm text-[var(--color-wood)] hover:bg-white/80 transition-all">
          {{ theme.currentTheme.icon }}
        </button>
        <div v-if="showThemePicker" class="absolute right-0 top-12 glass-panel rounded-xl p-2 w-48 shadow-xl"
          @mouseleave="showThemePicker = false">
          <button v-for="t in TEA_ROOM_THEMES" :key="t.id" @click="theme.setTheme(t.id); showThemePicker = false"
            class="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
            :class="theme.currentThemeId === t.id ? 'bg-[var(--color-wood)] text-[var(--color-cream)]' : 'text-[var(--color-wood)] hover:bg-white/50'">
            <span class="mr-2">{{ t.icon }}</span>
            <span class="font-bold">{{ t.name }}</span>
            <br>
            <span class="text-xs opacity-70">{{ t.description }}</span>
          </button>
        </div>
      </div>
      <!-- 用户 -->
      <button @click="router.push(auth.isLoggedIn ? '/history' : '/login')"
        class="glass-panel px-3 py-2 rounded-lg text-sm text-[var(--color-wood)] hover:bg-white/80 transition-all">
        {{ auth.isLoggedIn ? auth.user?.display_name || '茶人' : '登录 ☕' }}
      </button>
      <button @click="router.push('/collection')"
        class="glass-panel px-3 py-2 rounded-lg text-sm text-[var(--color-wood)] hover:bg-white/80 transition-all">
        📚 茶柜
      </button>
      <button @click="router.push('/profile')"
        class="glass-panel px-3 py-2 rounded-lg text-sm text-[var(--color-wood)] hover:bg-white/80 transition-all">
        🧘 茶修
      </button>
      <button @click="router.push('/ai')"
        class="glass-panel px-3 py-2 rounded-lg text-sm text-[var(--color-wood)] hover:bg-white/80 transition-all">
        🤖 茶灵
      </button>
      <button @click="router.push('/map')"
        class="glass-panel px-3 py-2 rounded-lg text-sm text-[var(--color-wood)] hover:bg-white/80 transition-all">
        🗺️ 茶地图
      </button>
      <button @click="router.push('/graph')"
        class="glass-panel px-3 py-2 rounded-lg text-sm text-[var(--color-wood)] hover:bg-white/80 transition-all">
        🔗 图谱
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 渐入动画 */
.transition-opacity {
  transition-property: opacity;
}
.transition-all {
  transition-property: all;
}
.duration-1500 { transition-duration: 1500ms; }
.duration-2000 { transition-duration: 2000ms; }
.delay-500 { transition-delay: 500ms; }
.delay-700 { transition-delay: 700ms; }
.delay-900 { transition-delay: 900ms; }

/* 茶室空间背景 */
.tea-room-wall { position: absolute; inset: 0; opacity: 0; background: radial-gradient(ellipse at 50% 35%, rgba(255,252,242,.96), rgba(225,213,194,.72) 70%, rgba(184,164,139,.55)); transition: opacity 2.4s ease; }
.time-night .tea-room-wall { background: radial-gradient(ellipse at 50% 35%, rgba(68,80,91,.92), rgba(35,45,54,.93) 70%, rgba(18,25,31,.97)); }
.tea-room-wall.scene-layer-visible { opacity: 1; }
.tea-room-window { position: absolute; top: 8%; left: 50%; width: min(62vw, 330px); height: min(52vh, 360px); transform: translate(calc(-50% + var(--scene-x, 0px)), var(--scene-y, 0px)); overflow: hidden; border: 8px solid rgba(93,78,55,.48); border-radius: 8px 8px 42% 42%; opacity: 0; box-shadow: 0 12px 40px rgba(93,78,55,.12), inset 0 0 30px rgba(255,245,203,.3); transition: opacity 2.4s ease 350ms, transform 1.2s ease-out; }
.tea-room-window.scene-layer-visible { opacity: .72; }
.window-glow { position: absolute; inset: 0; background: linear-gradient(145deg, rgba(250,244,213,.8), rgba(177,202,191,.42) 55%, rgba(101,126,110,.38)); }
.time-morning .window-glow { background: linear-gradient(145deg, rgba(255,248,210,.82), rgba(187,211,204,.5) 55%, rgba(110,137,124,.32)); }
.time-day .window-glow { background: linear-gradient(145deg, rgba(255,253,226,.95), rgba(190,219,205,.62) 55%, rgba(119,153,132,.35)); }
.time-dusk .window-glow { background: linear-gradient(145deg, rgba(255,208,135,.85), rgba(190,150,126,.5) 55%, rgba(87,92,103,.4)); }
.time-night .window-glow { background: radial-gradient(circle at 65% 28%, rgba(224,230,202,.8) 0 3%, transparent 4%), linear-gradient(145deg, rgba(40,57,72,.9), rgba(76,99,111,.42) 55%, rgba(19,29,39,.8)); }
.window-muntin { position: absolute; background: rgba(93,78,55,.38); }
.window-muntin-v { top: 0; bottom: 0; left: 50%; width: 5px; transform: translateX(-50%); }
.window-muntin-h { left: 0; right: 0; top: 51%; height: 5px; transform: translateY(-50%); }
.window-branch { position: absolute; left: 23%; bottom: 4%; width: 58%; height: 68%; border-left: 4px solid rgba(61,50,37,.32); border-radius: 50%; transform: rotate(24deg); }
.window-branch::after { content: '✦  ❧  ✦'; position: absolute; top: 12%; left: 8px; color: rgba(74,110,73,.48); font-size: 24px; transform: rotate(-22deg); }
.tea-room-floor { position: absolute; right: -12%; bottom: -12%; left: -12%; height: 39%; opacity: 0; background: repeating-linear-gradient(90deg, rgba(125,96,65,.12) 0 2px, transparent 2px 72px), linear-gradient(rgba(130,101,68,.12), rgba(93,78,55,.27)); transform: perspective(360px) rotateX(48deg); transform-origin: bottom; transition: opacity 2.4s ease 500ms; }
.tea-room-floor.scene-layer-visible { opacity: .85; }
.tea-table { transform: translate(calc(var(--scene-x, 0px) * .35), calc(var(--scene-y, 0px) * .35)); transition: transform 1.2s ease-out; }
.tea-room-dust { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.tea-room-dust i { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: rgba(255,250,218,.72); box-shadow: 0 0 5px rgba(255,248,200,.8); animation: dustFloat 7s ease-in-out infinite; }
@keyframes dustFloat { 0%, 100% { transform: translate3d(0, 12px, 0); opacity: 0; } 25% { opacity: .8; } 70% { opacity: .45; } 100% { transform: translate3d(18px, -42px, 0); } }
.room-light-pool { position: absolute; z-index: 1; bottom: 10%; left: 50%; width: min(72vw, 540px); height: 170px; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(ellipse, rgba(255,226,160,.22), transparent 68%); opacity: 0; animation: roomLightBreath 6s ease-in-out infinite; transition: opacity 2s ease; pointer-events: none; }
.tea-room-wall.scene-layer-visible ~ .room-light-pool { opacity: .9; }
.time-night .room-light-pool { background: radial-gradient(ellipse, rgba(205,157,87,.28), transparent 68%); }
@keyframes roomLightBreath { 0%, 100% { transform: translateX(-50%) scale(.96); } 50% { transform: translateX(-50%) scale(1.04); } }

@media (prefers-reduced-motion: reduce) {
  .tea-room-dust i, .room-light-pool, .bamboo-stalk, .leaf, .incense-smoke { animation: none; }
  .tea-room-window, .tea-table { transform: none; transition: none; }
}

@media (max-width: 640px) {
  .tea-room-window { top: 7%; width: 68vw; height: 38vh; border-width: 6px; }
  .tea-table { transform: scale(.86) translateY(8px); transform-origin: center bottom; }
  .tea-room-floor { height: 31%; }
}

/* 竹竿摇摆 */
.bamboo-stalk {
  animation: sway 4s ease-in-out infinite;
  transform-origin: bottom center;
}

@keyframes sway {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(0.5deg); }
  75% { transform: rotate(-0.5deg); }
}

/* 竹叶 */
.leaf {
  background: linear-gradient(to right, transparent, var(--color-wood), transparent);
  border-radius: 50%;
  animation: leafSway 3s ease-in-out infinite;
}

@keyframes leafSway {
  0%, 100% { transform: rotate(0deg) scaleX(1); }
  50% { transform: rotate(3deg) scaleX(1.1); }
}

/* 香烟 */
.incense-smoke {
  animation: smokeRise 3s ease-out infinite;
}

@keyframes smokeRise {
  0% { opacity: 0.6; transform: translateY(0) scaleX(1); }
  50% { opacity: 0.3; transform: translateY(-6px) scaleX(1.2); }
  100% { opacity: 0; transform: translateY(-12px) scaleX(0.8); }
}
</style>
