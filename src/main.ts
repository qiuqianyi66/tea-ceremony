import './assets/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { registerIcons } from '@/plugins/icons'
import { installErrorBuffer } from '@/services/errorBuffer'
import { initTelemetry } from '@/services/telemetry'
import { initWebVitals } from '@/services/vitals'
import { useAuthStore } from '@/stores/auth'
import { useTeaStore } from '@/stores/tea'
import App from './App.vue'
import router from './router'

// storage 桶（含 Dexie）按 PLAN-storage-lazy-loading-2026-10-21 改为动态加载，退出首屏静态图
const loadStorage = () => import('@/services/storage')

// P1-9：Web Vitals 本地采集（只写 IndexedDB，无外发）；尽早注册以覆盖首屏 LCP
initWebVitals()
// ADR-022：匿名遥测（读设置开关，关闭时零监听零外发）；异步初始化，不阻塞渲染
void initTelemetry()
// P2-9：前端本地错误缓冲（只写 IndexedDB，无外发）；先于页面代码注册以捕获早期错误
installErrorBuffer()

// 预取 storage chunk：不 await、不阻塞首屏绘制；initializeApp 里复用同一 promise
const storageReady = loadStorage()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(registerIcons)

/** 登录用户启动时 / 网络恢复时重试离线期间产生的记录 */
async function syncPendingRecords(): Promise<void> {
  const { historyStorage } = await storageReady
  await historyStorage.syncPending()
}

// 初始化数据库并加载历史数据。页面先挂载，避免 IndexedDB 异常或升级时白屏。
async function initializeApp() {
  try {
    const { initDB } = await storageReady
    await initDB()
    console.log('[App] 数据库初始化完成')

    // 加载茶叶状态（历史、成就、XP、收藏茶器）
    const teaStore = useTeaStore()
    await teaStore.loadHistory()
    console.log('[App] 历史数据加载完成')

    // 已登录用户启动时尝试恢复上次离线期间产生的记录。
    const authStore = useAuthStore()
    if (authStore.isLoggedIn) {
      await syncPendingRecords()
    }
  } catch (error) {
    console.error('[App] 初始化失败:', error)
  }
}

app.mount('#app')

void initializeApp()

// 网络恢复时自动重试，不打断用户当前的品茶流程。
window.addEventListener('online', () => {
  void syncPendingRecords()
})
