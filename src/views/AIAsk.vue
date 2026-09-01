<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { askTeaMaster, getSuggestion } from '@/services/teaAI'

const router = useRouter()

const messages = ref<Array<{ role: 'user' | 'ai'; content: string }>>([])
const input = ref('')
const loading = ref(false)

const suggestions = [
  '今天适合喝什么茶？',
  '绿茶用什么茶器最好？',
  '如何判断茶汤品质？',
  '泡茶的水温怎么控制？',
  '工夫茶和日常泡茶有什么区别？',
]

async function sendMessage(text?: string) {
  const msg = (text || input.value).trim()
  if (!msg || loading.value) return

  messages.value.push({ role: 'user', content: msg })
  input.value = ''
  loading.value = true

  // 构建对话历史
  const history = messages.value.slice(-6).map(m => ({
    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }))

  const reply = await askTeaMaster(msg, history)
  messages.value.push({ role: 'ai', content: reply })
  loading.value = false
}

function useSuggestion(text: string) {
  input.value = text
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- 顶栏 -->
    <div class="flex items-center justify-between p-4 border-b border-[var(--color-paper)]">
      <div class="flex items-center gap-2">
        <span class="text-xl">🤖</span>
        <div>
          <h2 class="text-lg font-bold text-[var(--color-wood)]">茶灵 AI</h2>
          <p class="text-xs text-[var(--color-wood-light)]">你的私人茶道师傅</p>
        </div>
      </div>
      <button @click="router.push('/')" aria-label="关闭茶灵" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]">✕</button>
    </div>

    <!-- 对话区域 -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- 初始空状态：显示推荐问题 -->
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center py-12">
        <p class="text-5xl mb-4">🍵</p>
        <p class="text-[var(--color-wood)] mb-6">有什么关于茶的问题想问？</p>
        <div class="flex flex-wrap gap-2 justify-center max-w-md">
          <button v-for="s in suggestions" :key="s" @click="useSuggestion(s)"
            class="px-4 py-2 rounded-full border border-[var(--color-tea-gold)] text-sm text-[var(--color-tea-gold)] hover:bg-[var(--color-tea-gold)] hover:text-[var(--color-cream)] transition-all">
            {{ s }}
          </button>
        </div>
      </div>

      <!-- 对话气泡 -->
      <div v-for="(msg, i) in messages" :key="i"
        class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
        <div v-if="msg.role === 'ai'" class="flex items-start gap-2 max-w-[80%]">
          <span class="text-lg mt-1">🤖</span>
          <div class="glass-panel rounded-2xl rounded-tl-sm p-3 text-sm text-[var(--color-wood)]">
            {{ msg.content }}
          </div>
        </div>
        <div v-else class="max-w-[70%]">
          <div class="bg-[var(--color-wood)] text-[var(--color-cream)] rounded-2xl rounded-tr-sm p-3 text-sm">
            {{ msg.content }}
          </div>
        </div>
      </div>

      <!-- AI 输入中 -->
      <div v-if="loading" class="flex items-start gap-2 max-w-[80%]">
        <span class="text-lg mt-1">🤖</span>
        <div class="glass-panel rounded-2xl rounded-tl-sm p-3">
          <span class="text-sm text-[var(--color-wood-light)]">思考中...</span>
        </div>
      </div>
    </div>

    <!-- 输入框 -->
    <div class="p-4 border-t border-[var(--color-paper)]">
      <form @submit.prevent="sendMessage()" class="flex gap-2">
        <label for="tea-ai-question" class="sr-only">向茶灵提问</label>
        <input id="tea-ai-question" v-model="input" autocomplete="off" placeholder="问茶灵 AI 一个问题..."
          class="flex-1 px-4 py-3 rounded-xl bg-white border border-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-tea-gold)] transition-colors" />
        <button type="submit" :disabled="loading || !input.trim()"
          class="px-6 py-3 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-xl hover:bg-[var(--color-wood-light)] transition-colors disabled:opacity-50">
          发送
        </button>
      </form>
    </div>
  </div>
</template>
