<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-8">
    <h1 class="text-6xl font-bold text-[var(--color-wood)] mb-4">一盏茶</h1>
    <p class="text-xl text-[var(--color-wood-light)] mb-12">沉浸式在线茶道体验</p>
    <button
      @click="router.push('/select')"
      class="px-12 py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg
             hover:bg-[var(--color-wood-light)] transition-colors duration-300"
    >
      开始品茶
    </button>
  </div>
</template>
