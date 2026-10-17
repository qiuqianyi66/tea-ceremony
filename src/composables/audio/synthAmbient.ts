/**
 * 程序化环境层（rain / wind，T1.2）+ AudioContext 工具
 *
 * public/audio/ 缺失，Howler 环境音轨静默；主题 ambientSound 的 rain/wind 由本层合成。
 * 复用 3D 茶园 ambient-audio 已验证思路：风声 = 噪声 + 低通 + LFO 起伏；雨声 = 噪声 + 带通；鸟鸣 = 随机滑音。
 *
 * 宿主单例：state / AudioContext / Howler 实例均由 useAudio.ts 的 audioHost 持有，
 * 本模块只经 audioHost 读取，不自建、不自持宿主单例。
 */

import { audioHost } from './host'
import type { AmbientTrack } from './host'

/** rain / wind 走程序化合成（零素材零依赖），其余走 Howler 音轨 */
export function isSyntheticTrack(track: AmbientTrack): track is 'rain' | 'wind' {
  return track === 'rain' || track === 'wind'
}

// ============ 程序化环境层（rain / wind，T1.2）============

interface SynthAmbientLayer {
  kind: 'rain' | 'wind'
  ctx: AudioContext
  master: GainNode
  sources: AudioScheduledSourceNode[]
  birdTimer: ReturnType<typeof setInterval> | null
}

let synthLayer: SynthAmbientLayer | null = null

/** 合成层是否已在运行（宿主判断用；实例仍由本模块持有） */
export function hasSynthAmbient(): boolean {
  return synthLayer !== null
}

/** 安全获取 AudioContext；测试 / 无 AudioContext 环境返回 null（合成静默但不报错） */
export function ensureSynthCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  const ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 创建指定时长的白噪声 buffer（合成层与 SFX 共用） */
export function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** 合成层目标音量（受 环境音量 × 主音量 × 静音 影响） */
function synthTargetGain(): number {
  if (audioHost.state.value.isMuted) return 0
  return audioHost.state.value.ambientVolume * audioHost.state.value.masterVolume
}

/** 启动合成环境层：风声常驻（雨时更轻），雨层仅 rain 时叠加，鸟鸣仅 rain 时调度 */
export function startSynthAmbient(kind: 'rain' | 'wind', paused: boolean) {
  stopSynthAmbient()
  const ctx = ensureSynthCtx()
  if (!ctx) return

  const master = ctx.createGain()
  master.gain.value = paused ? 0 : synthTargetGain()
  master.connect(ctx.destination)

  const sources: AudioScheduledSourceNode[] = []
  let birdTimer: ReturnType<typeof setInterval> | null = null

  // 风声层：白噪声 + 低通 420Hz + 0.08Hz LFO 缓慢起伏
  const windNoise = ctx.createBufferSource()
  windNoise.buffer = createNoiseBuffer(ctx, 4)
  windNoise.loop = true
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 420
  const windGain = ctx.createGain()
  windGain.gain.value = kind === 'wind' ? 0.18 : 0.06
  windNoise.connect(windFilter).connect(windGain).connect(master)
  windNoise.start()
  sources.push(windNoise)
  const windLfo = ctx.createOscillator()
  windLfo.frequency.value = 0.08
  const windLfoGain = ctx.createGain()
  windLfoGain.gain.value = 180
  windLfo.connect(windLfoGain).connect(windFilter.frequency)
  windLfo.start()
  sources.push(windLfo)

  if (kind === 'rain') {
    // 雨声层：白噪声 + 带通 1400Hz
    const rainNoise = ctx.createBufferSource()
    rainNoise.buffer = createNoiseBuffer(ctx, 4)
    rainNoise.loop = true
    const rainFilter = ctx.createBiquadFilter()
    rainFilter.type = 'bandpass'
    rainFilter.frequency.value = 1400
    rainFilter.Q.value = 0.6
    const rainGain = ctx.createGain()
    rainGain.gain.value = 0.45
    rainNoise.connect(rainFilter).connect(rainGain).connect(master)
    rainNoise.start()
    sources.push(rainNoise)

    // 鸟鸣：随机短促滑音（山林茶舍的"鸟鸣"）
    birdTimer = setInterval(
      () => {
        if (!synthLayer || Math.random() > 0.75) return
        const t0 = ctx.currentTime
        const count = 1 + Math.floor(Math.random() * 2)
        for (let i = 0; i < count; i++) {
          const t = t0 + i * (0.09 + Math.random() * 0.06)
          const freq = 2500 + Math.random() * 1600
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, t)
          osc.frequency.exponentialRampToValueAtTime(freq * (1.25 + Math.random() * 0.3), t + 0.07)
          const gain = ctx.createGain()
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, t + 0.015)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
          osc.connect(gain).connect(master)
          osc.start(t)
          osc.stop(t + 0.14)
        }
      },
      3500 + Math.random() * 4000,
    )
  }

  synthLayer = { kind, ctx, master, sources, birdTimer }
}

export function stopSynthAmbient() {
  if (!synthLayer) return
  if (synthLayer.birdTimer) clearInterval(synthLayer.birdTimer)
  for (const src of synthLayer.sources) {
    try {
      src.stop()
    } catch {
      /* 已停止 */
    }
  }
  synthLayer.ctx.close().catch(() => {})
  synthLayer = null
}

export function pauseSynthAmbient() {
  if (!synthLayer) return
  const t = synthLayer.ctx.currentTime
  synthLayer.master.gain.cancelScheduledValues(t)
  synthLayer.master.gain.setTargetAtTime(0, t, 0.15)
}

export function resumeSynthAmbient() {
  if (!synthLayer) return
  const t = synthLayer.ctx.currentTime
  synthLayer.master.gain.cancelScheduledValues(t)
  synthLayer.master.gain.setTargetAtTime(synthTargetGain(), t, 0.15)
}

/** 主音量 / 环境音量 / 静音变化时同步合成层 */
export function syncSynthAmbientVolume() {
  if (!synthLayer) return
  const t = synthLayer.ctx.currentTime
  synthLayer.master.gain.cancelScheduledValues(t)
  synthLayer.master.gain.setTargetAtTime(
    audioHost.state.value.ambientPlaying ? synthTargetGain() : 0,
    t,
    0.1,
  )
}
