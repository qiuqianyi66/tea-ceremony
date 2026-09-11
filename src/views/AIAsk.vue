<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { askTeaMaster } from '@/services/teaAI'

const router = useRouter()

interface ChatMsg { role: 'user' | 'ai'; content: string }
const messages = ref<ChatMsg[]>([])
const input = ref('')
const loading = ref(false)
const scrollRef = ref<HTMLElement | null>(null)

const suggestions = [
  '今天适合喝什么茶？',
  '绿茶用什么茶器最好？',
  '如何判断茶汤品质？',
  '泡茶的水温怎么控制？',
  '工夫茶和日常泡茶有什么区别？',
]

async function scrollToBottom() {
  await nextTick()
  scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight, behavior: 'smooth' })
}

async function sendMessage(text?: string) {
  const msg = (text || input.value).trim()
  if (!msg || loading.value) return

  messages.value.push({ role: 'user', content: msg })
  input.value = ''
  loading.value = true
  await scrollToBottom()

  const history = messages.value.slice(-6).map(m => ({
    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }))

  const reply = await askTeaMaster(msg, history)
  messages.value.push({ role: 'ai', content: reply })
  loading.value = false
  await scrollToBottom()
}
</script>

<template>
  <div class="ai-root">
    <!-- 顶栏 -->
    <header class="ai-topbar">
      <div class="ai-title-wrap">
        <IconBot class="w-6 h-6 text-[#c9a96e]" />
        <div>
          <h2 class="ai-title">茶灵</h2>
          <p class="ai-sub">你的私人茶道师傅</p>
        </div>
      </div>
      <button @click="router.push('/')" aria-label="关闭茶灵" class="ai-close">
        <IconX class="w-5 h-5" />
      </button>
    </header>

    <!-- 对话区域 -->
    <div ref="scrollRef" class="ai-chat">
      <!-- 初始空状态 -->
      <div v-if="messages.length === 0" class="ai-empty">
        <IconCupSoda class="w-14 h-14 mx-auto mb-4 text-[#c9a96e]" />
        <p class="ai-empty-text">有什么关于茶的问题想问？</p>
        <div class="ai-suggestions">
          <button v-for="s in suggestions" :key="s" @click="sendMessage(s)"
            class="ai-suggestion-btn">
            {{ s }}
          </button>
        </div>
      </div>

      <!-- 对话气泡 -->
      <div v-for="(msg, i) in messages" :key="i"
        class="ai-row" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
        <div v-if="msg.role === 'ai'" class="ai-ai-wrap">
          <IconBot class="ai-avatar" />
          <div class="ai-ai-bubble">{{ msg.content }}</div>
        </div>
        <div v-else class="ai-user-bubble">{{ msg.content }}</div>
      </div>

      <!-- AI 输入中 -->
      <div v-if="loading" class="ai-row justify-start">
        <IconBot class="ai-avatar" />
        <div class="ai-ai-bubble ai-thinking">
          <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
        </div>
      </div>
    </div>

    <!-- 输入框 -->
    <footer class="ai-input-bar">
      <form @submit.prevent="sendMessage()" class="ai-form">
        <input v-model="input" maxlength="500" autocomplete="off"
          placeholder="问茶灵一个问题..."
          class="ai-input" />
        <button type="submit" :disabled="loading || !input.trim()"
          class="ai-send-btn">
          发送
        </button>
      </form>
    </footer>
  </div>
</template>

<style scoped>
.ai-root {
  display: flex; flex-direction: column;
  min-height: 100dvh;
  background: linear-gradient(160deg, #0f1a14 0%, #1a2420 50%, #0d1410 100%);
  color: #f5f1e6;
}

.ai-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.2rem 1.4rem;
  background: rgba(13, 20, 16, 0.6);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(245, 241, 230, 0.08);
}
.ai-title-wrap { display: flex; align-items: center; gap: 0.6rem; }
.ai-title {
  font-family: var(--font-serif);
  font-size: 1.15rem; letter-spacing: 0.15em; margin: 0; color: #f3efe4;
}
.ai-sub { font-size: 0.72rem; color: rgba(245, 241, 230, 0.5); margin: 0.1rem 0 0; }
.ai-close {
  width: 2.4rem; height: 2.4rem; border-radius: 8px;
  display: grid; place-items: center;
  color: rgba(245, 241, 230, 0.6);
  background: none; border: 1px solid rgba(245, 241, 230, 0.12);
  cursor: pointer; transition: all 0.25s;
}
.ai-close:hover { color: #f3efe4; border-color: rgba(245, 241, 230, 0.3); }

.ai-chat {
  flex: 1; overflow-y: auto; padding: 1.2rem;
  display: flex; flex-direction: column; gap: 1rem;
}

.ai-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center;
  padding: 3rem 1rem;
}
.ai-empty-text {
  font-size: 0.95rem; color: rgba(245, 241, 230, 0.6);
  margin: 0 0 1.5rem; letter-spacing: 0.08em;
}
.ai-suggestions {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  justify-content: center; max-width: 28rem;
}
.ai-suggestion-btn {
  padding: 0.5rem 1rem; border-radius: 999px;
  font-size: 0.82rem; cursor: pointer;
  background: rgba(245, 241, 230, 0.06);
  border: 1px solid rgba(201, 169, 110, 0.35);
  color: rgba(201, 169, 110, 0.9);
  transition: all 0.25s; font-family: inherit;
}
.ai-suggestion-btn:hover {
  background: rgba(201, 169, 110, 0.18);
  border-color: rgba(201, 169, 110, 0.7);
}

.ai-row { display: flex; width: 100%; }
.ai-ai-wrap { display: flex; align-items: flex-start; gap: 0.5rem; max-width: 85%; }
.ai-avatar {
  width: 1.5rem; height: 1.5rem; margin-top: 0.3rem; flex-shrink: 0;
  color: rgba(201, 169, 110, 0.9);
}
.ai-ai-bubble {
  padding: 0.7rem 0.95rem; border-radius: 1rem; border-top-left-radius: 0.2rem;
  background: rgba(16, 26, 22, 0.75);
  border: 1px solid rgba(201, 169, 110, 0.2);
  font-size: 0.88rem; line-height: 1.7; color: #e8d5b0;
}
.ai-user-bubble {
  max-width: 75%;
  padding: 0.7rem 0.95rem; border-radius: 1rem; border-top-right-radius: 0.2rem;
  background: rgba(201, 169, 110, 0.9);
  color: #1a120a;
  font-size: 0.88rem; line-height: 1.6;
}

.ai-thinking { display: flex; gap: 0.3rem; align-items: center; padding: 0.8rem 1rem; }
.ai-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(201, 169, 110, 0.7);
  animation: ai-pulse 1.2s infinite;
}
.ai-dot:nth-child(2) { animation-delay: 0.2s; }
.ai-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes ai-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

.ai-input-bar {
  padding: 0.9rem 1rem 1.1rem;
  background: rgba(13, 20, 16, 0.7);
  backdrop-filter: blur(14px);
  border-top: 1px solid rgba(245, 241, 230, 0.08);
}
.ai-form { display: flex; gap: 0.6rem; max-width: 48rem; margin: 0 auto; }
.ai-input {
  flex: 1; padding: 0.75rem 1rem; border-radius: 0.8rem;
  background: rgba(245, 241, 230, 0.08);
  border: 1px solid rgba(245, 241, 230, 0.15);
  color: #e8d5b0; font-size: 0.9rem;
  outline: none; transition: border-color 0.25s;
  font-family: inherit;
}
.ai-input::placeholder { color: rgba(232, 213, 176, 0.35); }
.ai-input:focus { border-color: rgba(201, 169, 110, 0.6); }
.ai-send-btn {
  padding: 0.75rem 1.4rem; border-radius: 0.8rem;
  background: rgba(201, 169, 110, 0.9);
  color: #1a120a; font-weight: 500;
  border: none; cursor: pointer; transition: background 0.25s;
  font-family: inherit; font-size: 0.9rem;
  min-height: 2.75rem;
}
.ai-send-btn:hover:not(:disabled) { background: #d4b87a; }
.ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
