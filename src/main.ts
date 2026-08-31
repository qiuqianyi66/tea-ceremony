import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { historyStorage, initDB } from '@/services/storage'
import { registerIcons } from '@/plugins/icons'

import App from './App.vue'
import router from './router'
import { useTeaStore } from '@/stores/tea'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(registerIcons)

// 初始化数据库并加载历史数据
async function initializeApp() {
  try {
    await initDB()
    console.log('[App] 数据库初始化完成')

    // 加载茶叶状态（历史、成就、XP、收藏茶器）
    const teaStore = useTeaStore()
    await teaStore.loadHistory()
    console.log('[App] 历史数据加载完成')

    // 已登录用户启动时尝试恢复上次离线期间产生的记录。
    const authStore = useAuthStore()
    if (authStore.isLoggedIn) {
      await historyStorage.syncPending()
    }
  } catch (error) {
    console.error('[App] 初始化失败:', error)
  }
}

initializeApp().then(() => {
  app.mount('#app')

  // 网络恢复时自动重试，不打断用户当前的品茶流程。
  window.addEventListener('online', () => {
    void historyStorage.syncPending()
  })
})
