import { createRouter, createWebHistory } from 'vue-router'
import { useTeaStore } from '@/stores/tea'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/garden',
      name: 'garden',
      component: () => import('../views/GardenView.vue'),
    },
    {
      path: '/garden/:regionId',
      name: 'garden-region',
      component: () => import('../views/GardenView.vue'),
    },
    {
      path: '/synesthesia/:id',
      name: 'synesthesia',
      component: () => import('../views/TeaSynesthesiaView.vue'),
    },
    {
      path: '/break',
      name: 'break',
      component: () => import('../views/TeaBreakView.vue'),
    },
    {
      path: '/select',
      name: 'select',
      component: () => import('../views/SelectView.vue'),
    },
    {
      path: '/brew',
      name: 'brew',
      component: () => import('../views/BrewView.vue'),
      // 冲泡页首帧要等 three 编译着色器（~1.7s）：页面淡入会在这段主线程忙碌里卡在近乎全透明，
      // 用户看到的是先空白再硬切。这一页直接进场，让外壳先画出来。
      meta: { requiresTea: true, instant: true },
    },
    {
      path: '/taste',
      name: 'taste',
      component: () => import('../views/TasteView.vue'),
      meta: { requiresTea: true },
    },
    {
      path: '/tools',
      name: 'tools',
      component: () => import('../views/ToolSelect.vue'),
      meta: { requiresTea: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/collection',
      name: 'collection',
      component: () => import('../views/CollectionView.vue'),
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('../views/AIAsk.vue'),
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../views/MapView.vue'),
    },
    {
      path: '/graph',
      name: 'graph',
      component: () => import('../views/TeaGraph.vue'),
    },
    {
      path: '/tearoom',
      name: 'tearoom',
      component: () => import('../views/TeaRoom.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/TeaProfile.vue'),
    },
    {
      path: '/tea/:id',
      name: 'tea-detail',
      component: () => import('../views/TeaDetailView.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue'),
    },
    {
      path: '/growth',
      name: 'growth',
      component: () => import('../views/GrowthView.vue'),
    },
    {
      path: '/share',
      name: 'share',
      component: () => import('../views/ShareView.vue'),
    },
    {
      path: '/health',
      name: 'health',
      component: () => import('../views/HealthView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresTea) {
    const teaStore = useTeaStore()
    if (!teaStore.currentTea) {
      return { name: 'select' }
    }
  }
})

export default router
