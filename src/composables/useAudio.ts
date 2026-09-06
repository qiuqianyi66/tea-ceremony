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
 */

import { Howl, Howler } from 'howler'
import { ref, onUnmounted } from 'vue'

// ============ 类型定义 ============

type AmbientTrack = 'guqin' | 'xiao' | 'water' | 'night'

type SfxSprite =
  | 'boil'       // 咕嘟沸腾声
  | 'teaDrop'    // 投茶沙沙声
  | 'pour'       // 注水声
  | 'outflow'    // 出汤声
  | 'sip'        // 轻啜声
  | 'success'    // 完成音
  | 'crackle'    // 火焰噼啪 (短时合成备用)

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

// Howler 实例
let ambientHowl: Howl | null = null
let sfxHowl: Howl | null = null

// Web Audio API 合成器 (火焰噼啪等实时音效)
let audioCtx: AudioContext | null = null
let crackleInterval: ReturnType<typeof setInterval> | null = null

// ============ 工具函数 ============

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// 移动端自动解锁
function setupMobileUnlock() {
  const unlock = () => {
    Howler.autoUnlock = true
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume()
    }
    document.removeEventListener('touchstart', unlock)
    document.removeEventListener('click', unlock)
  }
  document.addEventListener('touchstart', unlock, { once: true, passive: true })
  document.addEventListener('click', unlock, { once: true, passive: true })
}

// ============ Howler 初始化 ============

function initHowler() {
  if (ambientHowl || sfxHowl) return

  // 环境音 Howl - 流式加载，支持循环
  ambientHowl = new Howl({
    src: [
      '/audio/ambient/guqin.webm',
      '/audio/ambient/guqin.mp3',
    ],
    loop: true,
    html5: true, // 大文件流式
    volume: state.value.ambientVolume * state.value.masterVolume,
    onplayerror: (id, err) => {
      console.warn('[Audio] 环境音加载失败，尝试备用格式:', err)
      // 可在此切换到备用 src
    },
    onload: () => console.log('[Audio] 环境音就绪'),
  })

  // 交互音效精灵图 Howl
  sfxHowl = new Howl({
    src: [
      '/audio/sfx/tea-sprites.webm',
      '/audio/sfx/tea-sprites.mp3',
    ],
    sprite: {
      boil: [0, 3000],
      teaDrop: [3000, 500],
      pour: [3500, 1500],
      outflow: [5000, 800],
      sip: [5800, 600],
      success: [6400, 1000],
      crackle: [7400, 200], // 备用合成噼啪
    },
    volume: state.value.sfxVolume * state.value.masterVolume,
    onload: () => console.log('[Audio] SFX 精灵图就绪'),
    onplayerror: (id, err) => console.warn('[Audio] SFX 播放失败:', err),
  })

  // 全局音量同步
  Howler.volume(state.value.masterVolume)
  setupMobileUnlock()
}

// ============ 环境音控制 ============

const ambientTracks: Record<AmbientTrack, { webm: string; mp3: string; name: string }> = {
  guqin: { webm: '/audio/ambient/guqin.webm', mp3: '/audio/ambient/guqin.mp3', name: '古琴·流泉' },
  xiao: { webm: '/audio/ambient/xiao.webm', mp3: '/audio/ambient/xiao.mp3', name: '洞箫·梅花三弄' },
  water: { webm: '/audio/ambient/water.webm', mp3: '/audio/ambient/water.mp3', name: '山涧流水' },
  night: { webm: '/audio/ambient/night.webm', mp3: '/audio/ambient/night.mp3', name: '夜·虫鸣' },
}

/** 切换环境音轨 */
function switchAmbient(track: AmbientTrack) {
  initHowler()
  if (!ambientHowl) return

  const src = [ambientTracks[track].webm, ambientTracks[track].mp3]
  const wasPlaying = state.value.ambientPlaying

  // 无缝切换：先停止当前，换源，再播放
  ambientHowl.stop()
  ambientHowl.unload()
  ambientHowl = new Howl({
    src,
    loop: true,
    html5: true,
    volume: state.value.ambientVolume * state.value.masterVolume,
    onload: () => {
      if (wasPlaying) ambientHowl?.play()
    },
  })

  state.value.currentAmbient = track
  state.value.ambientPlaying = wasPlaying
}

/** 播放/暂停环境音 */
function toggleAmbient() {
  initHowler()
  if (!ambientHowl) return

  if (state.value.ambientPlaying) {
    ambientHowl.pause()
    state.value.ambientPlaying = false
  } else {
    // 首次播放默认古琴
    if (!state.value.currentAmbient) switchAmbient('guqin')
    ambientHowl.play()
    state.value.ambientPlaying = true
  }
}

function stopAmbient() {
  ambientHowl?.stop()
  state.value.ambientPlaying = false
}

// ============ 交互音效 (SFX) ============

function playSfx(sprite: SfxSprite, options?: { volume?: number; rate?: number; pos3d?: [number, number, number] }) {
  initHowler()
  if (!sfxHowl) return

  const id = sfxHowl.play(sprite)

  if (options?.volume !== undefined) {
    sfxHowl.volume(options.volume * state.value.sfxVolume * state.value.masterVolume, id)
  }
  if (options?.rate) {
    sfxHowl.rate(options.rate, id)
  }
  // 3D 空间定位 (需要 Howler 启用 spatial)
  if (options?.pos3d && Howler.usingWebAudio) {
    const [x, y, z] = options.pos3d
    sfxHowl.pos(x, y, z, id)
  }

  return id
}

/** 便捷方法（SFX 走 Web Audio 合成，不依赖外部音频文件） */
const playBoil = (_vol = 1) => startBoilSynth()
const playTeaDropSfx = (vol = 1) => synthTeaDrop(vol)
const playPour = (vol = 1) => synthPour(1.5, vol)
const playOutflow = (vol = 1) => synthOutflow(vol)
const playSip = (vol = 1) => synthSip(vol)
const playSuccess = (vol = 1) => synthSuccess(vol)

// ============ Web Audio API 合成器 (火焰噼啪 - 实时动态) ============

function playCrackleSynthesis() {
  const ctx = getContext()
  const bufferSize = Math.floor(ctx.sampleRate * 0.04)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 15)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800 + Math.random() * 2500
  bp.Q.value = 1.2 + Math.random() * 0.8
  const g = ctx.createGain()
  g.gain.value = 0.08 + Math.random() * 0.06
  src.connect(bp).connect(g).connect(ctx.destination)
  src.start()
}

function startCrackleSynthesis() {
  stopCrackleSynthesis()
  crackleInterval = setInterval(() => {
    if (Math.random() > 0.4) {
      playCrackleSynthesis()
      if (Math.random() > 0.7) setTimeout(playCrackleSynthesis, 30 + Math.random() * 50)
    }
  }, 180 + Math.random() * 250)
}

function stopCrackleSynthesis() {
  if (crackleInterval) {
    clearInterval(crackleInterval)
    crackleInterval = null
  }
}

// ============ Web Audio 合成音效（不依赖外部音频文件） ============
// 因 public/audio/ 资源缺失，Howler SFX 无声；以下用 Web Audio API 程序化合成
// 煮水 / 倒水 / 投茶 / 出汤 / 啜饮 / 完成音，零延迟、零依赖。

let boilInterval: ReturnType<typeof setInterval> | null = null
let boilNoiseSource: AudioBufferSourceNode | null = null

/** 创建指定时长的白噪声 buffer */
function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** 煮水声（循环）：低频沸腾噪声 + 随机气泡 */
function startBoilSynth() {
  if (boilInterval) return
  const ctx = getContext()
  // 底层沸腾噪声
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 2)
  noise.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 420
  bp.Q.value = 0.7
  const g = ctx.createGain()
  g.gain.value = 0.05
  noise.connect(bp).connect(g).connect(ctx.destination)
  noise.start()
  boilNoiseSource = noise
  // 随机气泡
  boilInterval = setInterval(() => {
    if (Math.random() > 0.35) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 480 + Math.random() * 900
      const og = ctx.createGain()
      const t = ctx.currentTime
      og.gain.setValueAtTime(0, t)
      og.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.025, t + 0.02)
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.14 + Math.random() * 0.1)
      osc.connect(og).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    }
  }, 110 + Math.random() * 110)
}

function stopBoilSynth() {
  if (boilInterval) { clearInterval(boilInterval); boilInterval = null }
  if (boilNoiseSource) {
    try { boilNoiseSource.stop() } catch { /* 已停止 */ }
    boilNoiseSource = null
  }
}

/** 倒水声（一次性）：带通噪声，中心频率随时间下降模拟水位上升 */
function synthPour(duration = 1.5, volume = 1) {
  const ctx = getContext()
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, duration)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  const t = ctx.currentTime
  bp.frequency.setValueAtTime(950, t)
  bp.frequency.exponentialRampToValueAtTime(340, t + duration)
  bp.Q.value = 1.1
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.11 * volume, t + 0.08)
  g.gain.setValueAtTime(0.11 * volume, t + Math.max(0.1, duration - 0.2))
  g.gain.linearRampToValueAtTime(0, t + duration)
  noise.connect(bp).connect(g).connect(ctx.destination)
  noise.start(t)
  noise.stop(t + duration)
}

/** 投茶声（一次性）：短促高频沙沙声 */
function synthTeaDrop(volume = 1) {
  const ctx = getContext()
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 0.4)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2400
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(0.14 * volume, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  noise.connect(hp).connect(g).connect(ctx.destination)
  noise.start(t)
  noise.stop(t + 0.4)
}

/** 出汤声（一次性）：短倒水，音量略大 */
function synthOutflow(volume = 1) {
  synthPour(0.85, volume * 1.15)
}

/** 啜饮声（一次性）：短促高频共振 */
function synthSip(volume = 1) {
  const ctx = getContext()
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 0.25)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2800
  bp.Q.value = 2.2
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(0.09 * volume, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  noise.connect(bp).connect(g).connect(ctx.destination)
  noise.start(t)
}

/** 完成音（一次性）：古琴泛音感双音（C5 + E5） */
function synthSuccess(volume = 1) {
  const ctx = getContext()
  const notes = [523.25, 659.25] // C5, E5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const g = ctx.createGain()
    const start = ctx.currentTime + i * 0.14
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(0.075 * volume, start + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, start + 1.3)
    osc.connect(g).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 1.4)
  })
}

// ============ 音量控制 ============

function setMasterVolume(v: number) {
  const vol = Math.max(0, Math.min(1, v))
  state.value.masterVolume = vol
  Howler.volume(vol)
  ambientHowl?.volume(state.value.ambientVolume * vol)
  sfxHowl?.volume(state.value.sfxVolume * vol)
}

function setSfxVolume(v: number) {
  const vol = Math.max(0, Math.min(1, v))
  state.value.sfxVolume = vol
  sfxHowl?.volume(vol * state.value.masterVolume)
}

function setAmbientVolume(v: number) {
  const vol = Math.max(0, Math.min(1, v))
  state.value.ambientVolume = vol
  ambientHowl?.volume(vol * state.value.masterVolume)
}

function toggleMute() {
  state.value.isMuted = !state.value.isMuted
  Howler.mute(state.value.isMuted)
}

// ============ 基于时段自动切换环境音 ============

function getTimeBasedAmbient(): AmbientTrack {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 9) return 'guqin'      // 晨
  if (hour >= 9 && hour < 17) return 'xiao'      // 午
  if (hour >= 17 && hour < 21) return 'water'    // 暮
  return 'night'                                  // 夜
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
  ambientHowl?.unload()
  sfxHowl?.unload()
  ambientHowl = null
  sfxHowl = null
  if (audioCtx) {
    audioCtx.close()
    audioCtx = null
  }
}

// ============ 导出 API ============

export function useAudio() {
  onUnmounted(dispose)

  // 兼容旧版 API 的别名
  const startAmbient = toggleAmbient
  const stopAmbientFn = stopAmbient
  const startBoiling = () => { startBoilSynth(); startCrackleSynthesis() }
  const stopBoiling = () => { stopBoilSynth(); stopCrackleSynthesis() }
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

    // 合成音效 (火焰噼啪)
    startCrackleSynthesis,
    stopCrackleSynthesis,

    // 音量
    setMasterVolume,
    setSfxVolume,
    setAmbientVolume,
    toggleMute,

    // 底层实例 (高级用法)
    get ambientHowl() { return ambientHowl },
    get sfxHowl() { return sfxHowl },
  }
}

// 类型导出
export type { AmbientTrack, SfxSprite, AudioState }

// 兼容旧页面的模块级调用；新代码优先使用 useAudio()。
export const startAmbient = () => toggleAmbient()
export const playPourWater = (volume = 1) => playPour(volume)
export const playPourTea = (volume = 1) => playOutflow(volume)
export const startBoiling = () => { startBoilSynth(); startCrackleSynthesis() }
export const stopBoiling = () => { stopBoilSynth(); stopCrackleSynthesis() }
export const startCrackle = () => startCrackleSynthesis()
export const stopCrackle = () => stopCrackleSynthesis()
export const stopAll = () => dispose()
export const playTeaDrop = (volume = 1) => playTeaDropSfx(volume)
