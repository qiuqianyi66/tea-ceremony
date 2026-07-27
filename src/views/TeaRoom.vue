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
  <div class="min-h-screen flex flex-col">
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
      <div class="glass-panel rounded-2xl p-8 w-full max-w-lg text-center mb-6">
        <p class="text-6xl mb-4">{{ teaSteps[currentStep]!.icon }}</p>
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
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
