/**
 * 茶室主题系统
 */

export interface TeaRoomTheme {
  id: string
  name: string
  description: string
  icon: string
  // 颜色覆盖
  colors: {
    wood: string
    woodLight: string
    teaGold: string
    paper: string
    ink: string
    cream: string
  }
  // 音效
  ambientSound: 'guqin' | 'rain' | 'wind'
}

export const TEA_ROOM_THEMES: TeaRoomTheme[] = [
  {
    id: 'song',
    name: '宋式茶室',
    description: '极简 · 留白 · 古琴',
    icon: '🏛️',
    colors: {
      wood: '#4A4A4A',
      woodLight: '#8C8C8C',
      teaGold: '#A8A0A0',
      paper: '#F0EDE8',
      ink: '#2C2C2C',
      cream: '#F5F3F0',
    },
    ambientSound: 'guqin',
  },
  {
    id: 'ming',
    name: '明式茶室',
    description: '紫砂 · 木家具 · 文人气',
    icon: '🪵',
    colors: {
      wood: '#5D4E37',
      woodLight: '#8B7355',
      teaGold: '#9E8050',
      paper: '#F5F0E8',
      ink: '#3D3225',
      cream: '#FAF6F0',
    },
    ambientSound: 'guqin',
  },
  {
    id: 'mountain',
    name: '山林茶舍',
    description: '雨声 · 鸟鸣 · 松风',
    icon: '🌲',
    colors: {
      wood: '#4A6B4A',
      woodLight: '#7A9E7A',
      teaGold: '#8BA896',
      paper: '#F0F5EC',
      ink: '#2C3D2C',
      cream: '#F5FAF2',
    },
    ambientSound: 'rain',
  },
]

export function getThemeById(id: string): TeaRoomTheme {
  return TEA_ROOM_THEMES.find(t => t.id === id) ?? TEA_ROOM_THEMES[1]!
}
