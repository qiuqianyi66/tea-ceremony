<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!username.value || !password.value) {
    error.value = '请填写用户名和密码'
    return
  }
  loading.value = true
  error.value = ''

  try {
    let ok: boolean
    if (isLogin.value) {
      ok = await auth.login(username.value, password.value)
    } else {
      ok = await auth.register(username.value, password.value, displayName.value || undefined)
    }
    if (ok) {
      router.push('/')
    } else {
      error.value = '操作失败，请重试'
    }
  } catch {
    error.value = '网络错误'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-[var(--color-cream)]">
    <div class="w-full max-w-sm glass-panel rounded-2xl p-8">
      <h2 class="text-2xl font-bold text-[var(--color-wood)] text-center mb-2">一盏茶</h2>
      <p class="text-sm text-[var(--color-wood-light)] text-center mb-8">
        {{ isLogin ? '登录以同步品鉴记录' : '注册新的茶人账号' }}
      </p>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <input v-model="username" placeholder="用户名"
            class="w-full px-4 py-3 rounded-lg bg-white border border-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-tea-gold)] transition-colors" />
        </div>
        <div>
          <input v-model="password" type="password" placeholder="密码"
            class="w-full px-4 py-3 rounded-lg bg-white border border-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-tea-gold)] transition-colors" />
        </div>
        <div v-if="!isLogin">
          <input v-model="displayName" placeholder="昵称（可选）"
            class="w-full px-4 py-3 rounded-lg bg-white border border-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-tea-gold)] transition-colors" />
        </div>

        <p v-if="error" class="text-sm text-red-500 text-center">{{ error }}</p>

        <button type="submit" :disabled="loading"
          class="w-full py-3 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-lg hover:bg-[var(--color-wood-light)] transition-colors disabled:opacity-50">
          {{ loading ? '处理中...' : isLogin ? '登录' : '注册' }}
        </button>
      </form>

      <p class="text-sm text-[var(--color-wood-light)] text-center mt-6">
        {{ isLogin ? '还没有账号？' : '已有账号？' }}
        <button @click="isLogin = !isLogin" class="text-[var(--color-tea-gold)] hover:underline">
          {{ isLogin ? '注册' : '登录' }}
        </button>
      </p>

      <button @click="auth.login('茶客', ''); router.push('/')"
        class="w-full mt-4 py-2 text-sm text-[var(--color-wood-light)] hover:text-[var(--color-wood)] transition-colors">
        先逛逛，不登录 →
      </button>
    </div>
  </div>
</template>
