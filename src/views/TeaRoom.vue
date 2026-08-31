<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaRoomStore } from '@/stores/teaRoom'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { startAmbient, stopAll } from '@/composables/useAudio'
import { getCurrentSolarTerm, getSeasonName } from '@/data/solarTerms'
import { TEA_ROOM_THEMES } from '@/data/themes'

const router = useRouter()
const room = useTeaRoomStore()
const theme = useThemeStore()
const auth = useAuthStore()
const currentTerm = getCurrentSolarTerm()
const showRoomPicker = ref(false)
const greeting = ref('')
const showGreeting = ref(false)

// 入席引导语
function generateGreeting() {
  const hour = new Date().getHours()
  const timeStr = hour < 11 ? '清晨' : hour < 14 ? '午间' : hour < 18 ? '午后' : hour < 21 ? '黄昏' : '静夜'
  const season = currentTerm.name
  const roomName = room.currentRoom.name

  const greetings: string[] = [
    `${timeStr}来到${roomName}，今日${season}，宜静心一盏。`,
    `${season}，${timeStr}。${roomName}已为您备好茶席。`,
    `山静无人，水自流。${roomName}中一壶茶，足以慰风尘。`,
  ]
  greeting.value = greetings[Math.floor(Math.random() * greetings.length)]!
  showGreeting.value = true
  setTimeout(() => { showGreeting.value = false }, 5000)
}

onMounted(() => {
  startAmbient()
  generateGreeting()
})

onUnmounted(() => {
  stopAll()
})

// 十二境流程步骤
const teaSteps = [
  { icon: '🧹', name: '净手', desc: '洗净尘埃，心随水静' },
  { icon: '🚪', name: '入席', desc: '端坐茶席前，收摄心神' },
  { icon: '👀', name: '观茶', desc: '观干茶之形，闻茶香之韵' },
  { icon: '🫖', name: '温器', desc: '温热茶器，以迎茶汤' },
  { icon: '💧', name: '取水', desc: '好水为茶之母' },
  { icon: '🔥', name: '烹水', desc: '听水声三沸：蟹眼、鱼眼、松涛' },
  { icon: '🍃', name: '投茶', desc: '投茶入器，量随人定' },
  { icon: '🌊', name: '注水', desc: '环壁低斟，唤醒茶香' },
  { icon: '⏳', name: '浸泡', desc: '静待茶汤渐成' },
  { icon: '🫗', name: '出汤', desc: '茶汤入杯，香韵初显' },
  { icon: '👁️', name: '观色', desc: '观汤色之变化，赏茶韵之流转' },
  { icon: '😌', name: '品味', desc: '入口、回味、余韵，三品而知茶' },
]

const currentStep = ref(0)
const stepProgress = computed(() => `${currentStep.value + 1} / ${teaSteps.length}`)

function nextStep() {
  if (currentStep.value < teaSteps.length - 1) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function startBrew() {
  router.push('/tools')
}
</script>

<template>
  <div class="tea-room-page min-h-screen flex flex-col">
    <div class="room-mist room-mist-a" aria-hidden="true"></div>
    <div class="room-mist room-mist-b" aria-hidden="true"></div>
    <div class="room-lantern" aria-hidden="true"><span></span></div>
    <div class="room-window-shadow" aria-hidden="true"></div>
    <!-- 顶栏 -->
    <div class="flex items-center justify-between p-4 z-10">
      <div class="flex items-center gap-2">
        <button @click="router.push('/')" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]">
          ← 退出
        </button>
        <span class="text-xs text-[var(--color-wood-light)]">｜</span>
        <!-- 茶室选择 -->
        <div class="relative">
          <button @click="showRoomPicker = !showRoomPicker"
            class="text-sm text-[var(--color-wood)] hover:text-[var(--color-wood-light)]">
                        {{ theme.currentTheme.icon }} {{ room.currentRoom.name }}
          </button>
          <div v-if="showRoomPicker" class="absolute top-8 left-0 glass-panel rounded-xl p-2 w-44 shadow-xl z-20"
            @mouseleave="showRoomPicker = false">
            <button v-for="t in TEA_ROOM_THEMES" :key="t.id" @click="room.setRoom(t.id); showRoomPicker = false"
              class="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
              :class="room.currentRoom.id === t.id ? 'bg-[var(--color-wood)] text-[var(--color-cream)]' : 'text-[var(--color-wood)] hover:bg-white/50'">
              <span class="mr-2">{{ t.icon }}</span>{{ t.name }}
            </button>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs text-[var(--color-wood-light)]">
        <span>{{ currentTerm.name }}</span>
        <span>·</span>
        <span>{{ auth.isLoggedIn ? auth.user?.display_name : '茶客' }}</span>
      </div>
    </div>

    <!-- 迎宾引导 -->
    <Teleport to="body">
      <div v-if="showGreeting"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-700"
        @click="showGreeting = false">
        <div class="glass-panel rounded-2xl p-8 max-w-sm text-center animate-[fadeIn_0.5s_ease-out]">
          <p class="text-4xl mb-4">🍵</p>
          <p class="text-lg text-[var(--color-wood)] leading-relaxed">{{ greeting }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-4">轻触屏幕继续</p>
        </div>
      </div>
    </Teleport>

    <!-- 主茶席区域 -->
    <div class="flex-1 flex flex-col items-center justify-center px-4">
      <!-- 十二境进度 -->
      <div class="w-full max-w-lg mb-6">
        <div class="flex justify-between text-xs text-[var(--color-wood-light)] mb-2">
          <span>茶道十二境</span>
          <span>{{ stepProgress }}</span>
        </div>
        <div class="w-full h-1.5 bg-[var(--color-paper)] rounded-full overflow-hidden">
          <div class="h-full bg-[var(--color-tea-gold)] rounded-full transition-all duration-500"
            :style="{ width: `${((currentStep + 1) / teaSteps.length) * 100}%` }">
          </div>
        </div>
      </div>

      <!-- 当前步骤展示 -->
      <div class="glass-panel room-step-card rounded-2xl p-8 w-full max-w-lg text-center mb-6">
        <div class="step-breath"><p class="text-6xl mb-4">{{ teaSteps[currentStep]!.icon }}</p></div>
        <h3 class="text-2xl font-bold text-[var(--color-wood)] mb-2">{{ teaSteps[currentStep]!.name }}</h3>
        <p class="text-[var(--color-wood-light)]">{{ teaSteps[currentStep]!.desc }}</p>
      </div>

      <!-- 控制 -->
      <div class="flex gap-4 mb-6">
        <button @click="prevStep" :disabled="currentStep === 0"
          class="px-6 py-2 rounded-lg border border-[var(--color-tea-gold)] text-[var(--color-tea-gold)] disabled:opacity-30 transition-all">
          上一步
        </button>
        <button v-if="currentStep < teaSteps.length - 1" @click="nextStep"
          class="px-6 py-2 rounded-lg bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-wood-light)] transition-all">
          下一步
        </button>
        <button v-else @click="startBrew"
          class="px-6 py-2 rounded-lg bg-[var(--color-tea-gold)] text-white hover:bg-[#B89450] transition-all">
          开始冲泡 →
        </button>
      </div>

      <!-- 快速入口 -->
      <div class="flex gap-3 text-xs text-[var(--color-wood-light)]">
        <button @click="startBrew" class="hover:text-[var(--color-wood)]">直接选茶 →</button>
        <button @click="router.push('/graph')" class="hover:text-[var(--color-wood)]">探索茶文化</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tea-room-page {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 250, 231, .9), transparent 32%),
    linear-gradient(145deg, var(--color-cream), var(--color-paper));
}
.tea-room-page::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .26;
  background: repeating-linear-gradient(90deg, transparent 0 46px, rgba(93,78,55,.035) 47px 48px);
}
.room-window-shadow {
  position: absolute;
  top: 5%;
  left: 50%;
  width: min(75vw, 430px);
  height: 42vh;
  transform: translateX(-50%);
  border: 1px solid rgba(93,78,55,.16);
  border-radius: 50% 50% 10px 10px;
  background: linear-gradient(135deg, rgba(255,255,255,.24), rgba(109,145,128,.12));
  box-shadow: inset 0 0 60px rgba(255,248,207,.35), 0 20px 80px rgba(93,78,55,.08);
  pointer-events: none;
}
.room-window-shadow::before, .room-window-shadow::after { content: ''; position: absolute; background: rgba(93,78,55,.12); }
.room-window-shadow::before { top: 0; bottom: 0; left: 50%; width: 2px; }
.room-window-shadow::after { left: 0; right: 0; top: 52%; height: 2px; }
.room-lantern { position: absolute; top: 10%; right: 12%; width: 34px; height: 48px; border: 2px solid rgba(158,128,80,.38); border-radius: 8px; background: rgba(200,155,60,.12); box-shadow: 0 0 30px rgba(200,155,60,.22); animation: lanternBreath 4s ease-in-out infinite; pointer-events: none; }
.room-lantern::before, .room-lantern::after { content: ''; position: absolute; left: 50%; width: 16px; height: 2px; transform: translateX(-50%); background: rgba(158,128,80,.5); }
.room-lantern::before { top: -7px; } .room-lantern::after { bottom: -7px; }
.room-lantern span { position: absolute; inset: 10px; border-radius: 50%; background: rgba(255,210,100,.35); filter: blur(4px); }
.room-mist { position: absolute; z-index: 0; border-radius: 50%; pointer-events: none; filter: blur(18px); opacity: .28; animation: mistDrift 12s ease-in-out infinite; }
.room-mist-a { top: 32%; left: 8%; width: 180px; height: 65px; background: rgba(255,255,255,.8); }
.room-mist-b { right: 5%; bottom: 25%; width: 220px; height: 75px; background: rgba(200,155,60,.14); animation-delay: -5s; }
.room-step-card { position: relative; z-index: 1; box-shadow: 0 20px 50px rgba(93,78,55,.1); backdrop-filter: blur(12px); }
.step-breath { animation: stepBreath 3.2s ease-in-out infinite; transform-origin: center; }
@keyframes lanternBreath { 0%, 100% { opacity: .58; transform: translateY(0); } 50% { opacity: .95; transform: translateY(4px); } }
@keyframes mistDrift { 0%, 100% { transform: translateX(-12px) scale(.95); } 50% { transform: translateX(20px) scale(1.08); } }
@keyframes stepBreath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .room-lantern, .room-mist, .step-breath { animation: none; }
}
@media (max-width: 640px) {
  .room-window-shadow { top: 9%; height: 32vh; width: 76vw; }
  .room-lantern { top: 9%; right: 8%; transform: scale(.8); }
}
</style>
