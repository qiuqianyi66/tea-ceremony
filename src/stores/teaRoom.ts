/**
 * 茶席空间状态管理
 * 管理当前茶室/季节/氛围
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useThemeStore } from './theme'
import { getCurrentSolarTerm } from '@/data/solarTerms'

export interface TeaRoomState {
  roomId: string
  roomName: string
  mood: number
  ambientPlaying: boolean
}

export const useTeaRoomStore = defineStore('teaRoom', () => {
  const theme = useThemeStore()

  const currentRoom = ref({
    id: 'ming',
    name: '明式茶室',
    style: 'classic',
  })
  const mood = ref(5)        // 1-10
  const step = ref(0)        // 当前茶道步骤
  const ambientPlaying = ref(true)
  const currentSeason = computed(() => getCurrentSolarTerm())

  function setRoom(roomId: string) {
    const rooms: Record<string, { id: string; name: string; style: string }> = {
      song: { id: 'song', name: '宋式茶室', style: 'elegant' },
      ming: { id: 'ming', name: '明式茶室', style: 'classic' },
      mountain: { id: 'mountain', name: '山林茶舍', style: 'nature' },
    }
    const room = rooms[roomId]
    if (room) {
      currentRoom.value = room
      // 同步茶室主题
      if (roomId === 'song') theme.setTheme('song')
      else if (roomId === 'ming') theme.setTheme('ming')
      else if (roomId === 'mountain') theme.setTheme('mountain')
    }
  }

  function setStep(s: number) { step.value = s }

  return {
    currentRoom, mood, step, ambientPlaying, currentSeason,
    setRoom, setStep,
  }
})
