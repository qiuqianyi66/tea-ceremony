import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
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
    },
    {
      path: '/taste',
      name: 'taste',
      component: () => import('../views/TasteView.vue'),
    },
    {
      path: '/tools',
      name: 'tools',
      component: () => import('../views/ToolSelect.vue'),
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
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue'),
    },
  ],
})

export default router
