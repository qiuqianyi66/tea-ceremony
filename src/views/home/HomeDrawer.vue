<script setup lang="ts">
/**
 * 首页侧边导航抽屉
 */
import { watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

interface NavItem {
  icon: string
  label: string
  desc: string
  path: string
}

const props = defineProps<{
  open: boolean
  items: NavItem[]
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const router = useRouter()
const auth = useAuthStore()

function go(path: string) {
  emit('update:open', false)
  router.push(path)
}

function close() {
  emit('update:open', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(() => props.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="drawer-mask" @click="close">
        <aside class="drawer" @click.stop>
          <div class="drawer-head">
            <div>
              <p class="drawer-title">一盏茶</p>
              <p class="drawer-user">{{ auth.isLoggedIn ? auth.user?.display_name || '茶人' : '尚未登录 · 茶客' }}</p>
            </div>
            <button class="drawer-close" aria-label="关闭菜单" @click="close"><IconX class="w-5 h-5" /></button>
          </div>
          <nav class="drawer-nav">
            <button v-for="item in items" :key="item.path" class="drawer-item" @click="go(item.path)">
              <component :is="`Icon${item.icon}`" class="drawer-icon" />
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
</template>

<style scoped>
.drawer-mask {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(8, 14, 12, 0.5); backdrop-filter: blur(3px);
}
.drawer {
  position: absolute; top: 0; right: 0;
  display: flex; flex-direction: column;
  width: min(86vw, 360px); height: 100%;
  padding: 1.6rem 1.3rem;
  background: linear-gradient(170deg, rgba(22, 32, 27, 0.97), rgba(14, 21, 18, 0.98));
  border-left: 1px solid rgba(201, 169, 110, 0.22);
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.4);
}
.drawer-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding-bottom: 1.3rem; margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.drawer-title { font-size: 1.4rem; letter-spacing: 0.3em; color: #f3efe4; margin: 0 0 0.3rem; }
.drawer-user { font-size: 0.82rem; color: rgba(245, 241, 230, 0.55); margin: 0; }
.drawer-close {
  width: 2.2rem; height: 2.2rem; border-radius: 8px;
  color: rgba(245, 241, 230, 0.7); border: 1px solid rgba(255, 255, 255, 0.12);
  transition: all 0.3s;
}
.drawer-close:hover { color: #f3efe4; border-color: rgba(255, 255, 255, 0.3); }
.drawer-nav { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; overflow-y: auto; }
.drawer-item {
  display: flex; align-items: center; gap: 0.9rem; width: 100%;
  text-align: left; padding: 0.85rem 0.7rem; border-radius: 12px;
  color: #f3efe4; background: none; border: none;
  font-family: inherit; transition: background 0.25s;
}
.drawer-item:hover { background: rgba(255, 255, 255, 0.06); }
.drawer-icon { font-size: 1.35rem; }
.drawer-text { flex: 1; display: flex; flex-direction: column; }
.drawer-label { color: #f0ebde; font-size: 1rem; letter-spacing: 0.08em; }
.drawer-desc { color: rgba(240, 235, 222, 0.45); font-size: 0.74rem; margin-top: 2px; }
.drawer-chevron { color: rgba(201, 169, 110, 0.7); font-size: 1.3rem; }
.drawer-auth {
  margin-top: 1rem; padding: 0.85rem; border-radius: 12px;
  font-family: inherit; letter-spacing: 0.15em;
  color: #2a2114; background: rgba(201, 169, 110, 0.9);
  transition: background 0.3s;
}
.drawer-auth:hover { background: rgba(201, 169, 110, 1); }
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.3s ease; }
.drawer-fade-enter-active .drawer, .drawer-fade-leave-active .drawer { transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1); }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }
.drawer-fade-enter-from .drawer, .drawer-fade-leave-to .drawer { transform: translateX(100%); }
</style>
