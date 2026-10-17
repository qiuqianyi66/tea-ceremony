/**
 * 茶道音效系统 - Howler.js + Web Audio API 混合方案
 *
 * 策略：
 * - 环境音/长音效 → Howler.js (流式加载、循环、音量独立控制)
 * - 交互短音效 → Howler.js Sound Sprite (零延迟、精灵图)
 * - 实时合成/程序化音效 → 保留原 Web Audio API (火焰噼啪、动态参数)
 *
 * 音频资源目录：public/audio/
 *   ambient/    - 环境音 (guqin.webm/mp3, xiao.webm/mp3, water.webm/mp3)
 *   sfx/        - 精灵图 (tea-sprites.webm/mp3 + tea-sprites.json)
 *
 * 模块分工（audio/ 子目录）：
 * - audio/howlerTracks.ts — Howler 初始化 + 音轨表 + 播放控制
 * - audio/synthAmbient.ts — 程序化雨/风合成
 * - audio/sfx.ts          — 音效精灵与单次播放
 * 本文件是宿主：持有 state 与 AudioContext / Howler 单例，经 audioHost 注入给子模块。
 */

import type { Howl } from 'howler'
import { getCurrentInstance, onUnmounted, ref } from 'vue'
import {
  ambientTracks,
  initHowler,
  loadAmbientTrack,
  muteHowler,
  pauseAmbientHowl,
  playAmbientHowl,
  setAmbientHowlVolume,
  setHowlerMasterVolume,
  setSfxHowlVolume,
  stopAmbientHowl,
  stopHowlerAmbient,
  unloadHowler,
} from './audio/howlerTracks'
import {
  playBoil,
  playOutflow,
  playPour,
  playSfx,
  playSip,
  playSuccess,
  playTeaDropSfx,
  startBoilSynth,
  startCrackleSynthesis,
  stopBoilSynth,
  stopCrackleSynthesis,
  synthQing,
} from './audio/sfx'
import {
  hasSynthAmbient,
  isSyntheticTrack,
  pauseSynthAmbient,
  resumeSynthAmbient,
  startSynthAmbient,
  stopSynthAmbient,
  syncSynthAmbientVolume,
} from './audio/synthAmbient'

// ============ 类型定义 ============

type AmbientTrack = 'guqin' | 'xiao' | 'water' | 'night' | 'rain' | 'wind'

type SfxSprite =
  | 'boil' // 咕嘟沸腾声
  | 'teaDrop' // 投茶沙沙声
  | 'pour' // 注水声
  | 'outflow' // 出汤声
  | 'sip' // 轻啜声
  | 'success' // 完成音
  | 'crackle' // 火焰噼啪 (短时合成备用)

interface AudioState {
  ambientPlaying: boolean
  currentAmbient: AmbientTrack | null
  masterVolume: number
  sfxVolume: number
  ambientVolume: number
  isMuted: boolean
}

// ============ 全局状态 ============

const state = ref<AudioState>({
  ambientPlaying: false,
  currentAmbient: null,
  masterVolume: 1,
  sfxVolume: 0.8,
  ambientVolume: 0.3,
  isMuted: false,
})

// ============ 单例宿主 ============
// AudioContext 与 Howler 实例唯一存放在本文件；子模块不得自建、自持，
// 只能经 audioHost 读取或把新建实例登记回宿主。

let ambientHowl: Howl | null = null
let sfxHowl: Howl | null = null
let audioCtx: AudioContext | null = null

export const audioHost = {
  state,
  get ambientHowl(): Howl | null {
    return ambientHowl
  },
  set ambientHowl(h: Howl | null) {
    ambientHowl = h
  },
  get sfxHowl(): Howl | null {
    return sfxHowl
  },
  set sfxHowl(h: Howl | null) {
    sfxHowl = h
  },
  get audioCtx(): AudioContext | null {
    return audioCtx
  },
  set audioCtx(ctx: AudioContext | null) {
    audioCtx = ctx
  },
}

// ============ 环境音控制 ============

/** 切换环境音轨：rain / wind 走合成层，其余走 Howler */
export function switchAmbient(track: AmbientTrack) {
  const wasPlaying = state.value.ambientPlaying

  if (isSyntheticTrack(track)) {
    // 切到合成环境层：停掉 Howler 环境音（若在播），按播放状态启/停合成层
    stopHowlerAmbient()
    if (wasPlaying) startSynthAmbient(track, false)
    else stopSynthAmbient()
    state.value.currentAmbient = track
    state.value.ambientPlaying = wasPlaying
    return
  }

  // Howler 音轨（public/audio/ 缺失时静默，保留结构以接入素材）
  stopSynthAmbient()
  initHowler()
  if (!audioHost.ambientHowl) return

  loadAmbientTrack(track, wasPlaying)

  state.value.currentAmbient = track
  state.value.ambientPlaying = wasPlaying
}

/** 播放/暂停环境音 */
function toggleAmbient() {
  const current = state.value.currentAmbient

  // 合成层（rain / wind）
  if (current && isSyntheticTrack(current)) {
    if (state.value.ambientPlaying) {
      pauseSynthAmbient()
      state.value.ambientPlaying = false
    } else {
      if (!hasSynthAmbient()) startSynthAmbient(current, false)
      resumeSynthAmbient()
      state.value.ambientPlaying = true
    }
    return
  }

  initHowler()
  if (!audioHost.ambientHowl) return

  if (state.value.ambientPlaying) {
    pauseAmbientHowl()
    state.value.ambientPlaying = false
  } else {
    // 首次播放默认古琴
    if (!state.value.currentAmbient) switchAmbient('guqin')
    playAmbientHowl()
    state.value.ambientPlaying = true
  }
}

function stopAmbient() {
  stopAmbientHowl()
  stopSynthAmbient()
  state.value.ambientPlaying = false
}

// ============ 音量控制 ============

function setMasterVolume(v: number) {
  const vol = Math.max(0, Math.min(1, v))
  state.value.masterVolume = vol
  setHowlerMasterVolume(vol)
  setAmbientHowlVolume(state.value.ambientVolume * vol)
  setSfxHowlVolume(state.value.sfxVolume * vol)
  syncSynthAmbientVolume()
}

function setSfxVolume(v: number) {
  const vol = Math.max(0, Math.min(1, v))
  state.value.sfxVolume = vol
  setSfxHowlVolume(vol * state.value.masterVolume)
}

function setAmbientVolume(v: number) {
  const vol = Math.max(0, Math.min(1, v))
  state.value.ambientVolume = vol
  setAmbientHowlVolume(vol * state.value.masterVolume)
  syncSynthAmbientVolume()
}

function toggleMute() {
  state.value.isMuted = !state.value.isMuted
  muteHowler(state.value.isMuted)
  syncSynthAmbientVolume()
}

// ============ 基于时段自动切换环境音 ============

function getTimeBasedAmbient(): AmbientTrack {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 9) return 'guqin' // 晨
  if (hour >= 9 && hour < 17) return 'xiao' // 午
  if (hour >= 17 && hour < 21) return 'water' // 暮
  return 'night' // 夜
}

function autoSwitchAmbient() {
  const track = getTimeBasedAmbient()
  if (track !== state.value.currentAmbient) {
    switchAmbient(track)
  }
}

// ============ 清理 ============

function dispose() {
  stopAmbient()
  stopCrackleSynthesis()
  stopBoilSynth()
  stopSynthAmbient()
  unloadHowler()
  const ctx = audioHost.audioCtx
  if (ctx) {
    ctx.close()
    audioHost.audioCtx = null
  }
}

// ============ 导出 API ============

export function useAudio() {
  // 仅组件上下文注册卸载清理；测试等非组件环境调用不注册（避免 Vue warn）
  if (getCurrentInstance()) onUnmounted(dispose)

  // 兼容旧版 API 的别名
  const startAmbient = toggleAmbient
  const stopAmbientFn = stopAmbient
  const startBoiling = () => {
    startBoilSynth()
    startCrackleSynthesis()
  }
  const stopBoiling = () => {
    stopBoilSynth()
    stopCrackleSynthesis()
  }
  const startCrackle = startCrackleSynthesis
  const stopCrackle = stopCrackleSynthesis
  const playPourWater = playPour
  const playPourTea = playOutflow
  const stopAll = dispose

  return {
    // 状态
    state,

    // 环境音
    switchAmbient,
    toggleAmbient,
    stopAmbient: stopAmbientFn,
    autoSwitchAmbient,
    getTimeBasedAmbient,
    ambientTracks,

    // 兼容旧版 API
    startAmbient,
    startBoiling,
    stopBoiling,
    startCrackle,
    stopCrackle,
    playPourWater,
    playPourTea,
    stopAll,

    // SFX 交互音效
    playSfx,
    playBoil,
    playTeaDrop: playTeaDropSfx,
    playPour,
    playOutflow,
    playSip,
    playSuccess,
    playQing,

    // 合成音效 (火焰噼啪)
    startCrackleSynthesis,
    stopCrackleSynthesis,

    // 音量
    setMasterVolume,
    setSfxVolume,
    setAmbientVolume,
    toggleMute,

    // 底层实例 (高级用法)
    get ambientHowl() {
      return ambientHowl
    },
    get sfxHowl() {
      return sfxHowl
    },
  }
}

// 类型导出
export type { AmbientTrack, AudioState, SfxSprite }

// 兼容旧页面的模块级调用；新代码优先使用 useAudio()。
export const startAmbient = () => toggleAmbient()
export const playPourWater = (volume = 1) => playPour(volume)
export const playPourTea = (volume = 1) => playOutflow(volume)
export const startBoiling = () => {
  startBoilSynth()
  startCrackleSynthesis()
}
export const stopBoiling = () => {
  stopBoilSynth()
  stopCrackleSynthesis()
}
export const startCrackle = () => startCrackleSynthesis()
export const stopCrackle = () => stopCrackleSynthesis()
export const stopAll = () => dispose()
export const playTeaDrop = (volume = 1) => playTeaDropSfx(volume)
export const playQing = (volume = 1) => synthQing(volume)
