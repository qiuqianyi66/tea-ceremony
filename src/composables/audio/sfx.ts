/**
 * 交互音效（SFX）：Howler 精灵图播放 + Web Audio 程序化合成
 *
 * 策略：交互短音效 → Howler.js Sound Sprite (零延迟、精灵图)
 *       程序化音效 → Web Audio API (煮水 / 倒水 / 投茶 / 出汤 / 啜饮 / 完成 / 磬声)
 *
 * 宿主单例：AudioContext 与 Howler 实例由 useAudio.ts 的 audioHost 持有，
 * 本模块只经 audioHost 读取，不自建、不自持实例。
 */

import { Howler } from 'howler'
import { audioHost } from './host'
import type { SfxSprite } from './host'
import { initHowler } from './howlerTracks'
import { createNoiseBuffer, ensureSynthCtx } from './synthAmbient'

// ============ 工具函数 ============

function getContext(): AudioContext {
  let ctx = audioHost.audioCtx
  if (!ctx) {
    ctx = new AudioContext()
    audioHost.audioCtx = ctx
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

// ============ 交互音效 (SFX) ============

export function playSfx(
  sprite: SfxSprite,
  options?: { volume?: number; rate?: number; pos3d?: [number, number, number] },
) {
  initHowler()
  const sfx = audioHost.sfxHowl
  if (!sfx) return

  const id = sfx.play(sprite)

  if (options?.volume !== undefined) {
    sfx.volume(
      options.volume * audioHost.state.value.sfxVolume * audioHost.state.value.masterVolume,
      id,
    )
  }
  if (options?.rate) {
    sfx.rate(options.rate, id)
  }
  // 3D 空间定位 (需要 Howler 启用 spatial)
  if (options?.pos3d && Howler.usingWebAudio) {
    const [x, y, z] = options.pos3d
    sfx.pos(x, y, z, id)
  }

  return id
}

/** 便捷方法（SFX 走 Web Audio 合成，不依赖外部音频文件） */
export const playBoil = (_vol = 1) => startBoilSynth()
export const playTeaDropSfx = (vol = 1) => synthTeaDrop(vol)
export const playPour = (vol = 1) => synthPour(1.5, vol)
export const playOutflow = (vol = 1) => synthOutflow(vol)
export const playSip = (vol = 1) => synthSip(vol)
export const playSuccess = (vol = 1) => synthSuccess(vol)

// ============ Web Audio API 合成器 (火焰噼啪 - 实时动态) ============

let crackleInterval: ReturnType<typeof setInterval> | null = null

function playCrackleSynthesis() {
  const ctx = getContext()
  const bufferSize = Math.floor(ctx.sampleRate * 0.04)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp((-i / bufferSize) * 15)
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

export function startCrackleSynthesis() {
  stopCrackleSynthesis()
  crackleInterval = setInterval(
    () => {
      if (Math.random() > 0.4) {
        playCrackleSynthesis()
        if (Math.random() > 0.7) setTimeout(playCrackleSynthesis, 30 + Math.random() * 50)
      }
    },
    180 + Math.random() * 250,
  )
}

export function stopCrackleSynthesis() {
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

/** 煮水声（循环）：低频沸腾噪声 + 随机气泡 */
export function startBoilSynth() {
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
  boilInterval = setInterval(
    () => {
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
    },
    110 + Math.random() * 110,
  )
}

export function stopBoilSynth() {
  if (boilInterval) {
    clearInterval(boilInterval)
    boilInterval = null
  }
  if (boilNoiseSource) {
    try {
      boilNoiseSource.stop()
    } catch {
      /* 已停止 */
    }
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

/** 磬声（一次性，T3.2）：禅意磬/钵音，基频 + 非谐波泛音，长衰减（约 3s）
 * 无 AudioContext 环境（如测试/被禁）静默降级，不抛错。 */
export function synthQing(volume = 1) {
  const ctx = ensureSynthCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const base = 392 // G4，清越磬音
  // 磬为非谐波打击乐：基频 + 2.76×/5.4× 泛音
  const partials: Array<[number, number]> = [
    [1, 0.5],
    [2.76, 0.16],
    [5.4, 0.05],
  ]
  for (const [ratio, amp] of partials) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = base * ratio
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.1 * amp * volume, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
    osc.connect(g).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 3.3)
  }
  // 敲击瞬态：短促高频噪声
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 0.03)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3000
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.05 * volume, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
  noise.connect(hp).connect(ng).connect(ctx.destination)
  noise.start(t)
  noise.stop(t + 0.04)
}
