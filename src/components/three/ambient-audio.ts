/**
 * ambient-audio.ts — 茶园环境音效（WebAudio 合成，零素材零依赖）
 * 1. 风声：白噪声 + 低通滤波 + LFO 缓慢调制（风声起伏）
 * 2. 雨声：白噪声 + 带通滤波，强度随天气联动
 * 3. 鸟鸣：随机间隔的短促滑音（2.5-4kHz），清晨/晴天更多
 *
 * 依据：Tone.js 的合成思路（零依赖版）——所有声音程序化合成，无外部音频文件。
 * 注意：AudioContext 需用户手势后才能启动（autoplay policy），默认关闭。
 */

interface ChirpVoice {
  osc: OscillatorNode
  gain: GainNode
}

export interface AmbientAudio {
  setEnabled: (on: boolean) => void
  setRainIntensity: (v: number) => void
  dispose: () => void
}

export function createAmbientAudio(): AmbientAudio {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let windGain: GainNode | null = null
  let windFilter: BiquadFilterNode | null = null
  let windLfo: OscillatorNode | null = null
  let windLfoGain: GainNode | null = null
  let rainGain: GainNode | null = null
  let enabled = false
  let rainIntensity = 0
  let birdTimer: ReturnType<typeof setInterval> | null = null
  let disposed = false

  function ensureCtx(): AudioContext | null {
    if (disposed) return null
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume()
      return ctx
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    // ---- 风声：白噪声 + 低通 + LFO 调制 ----
    const windBuffer = createNoiseBuffer(ctx, 4)
    const windSrc = ctx.createBufferSource()
    windSrc.buffer = windBuffer
    windSrc.loop = true
    windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 420
    windGain = ctx.createGain()
    windGain.gain.value = 0.0
    windSrc.connect(windFilter).connect(windGain).connect(master)
    windSrc.start()
    // LFO：0.08Hz 缓慢起伏风声
    windLfo = ctx.createOscillator()
    windLfo.frequency.value = 0.08
    windLfoGain = ctx.createGain()
    windLfoGain.gain.value = 180
    windLfo.connect(windLfoGain).connect(windFilter.frequency)
    windLfo.start()

    // ---- 雨声：白噪声 + 带通，强度联动 ----
    const rainBuffer = createNoiseBuffer(ctx, 4)
    const rainSrc = ctx.createBufferSource()
    rainSrc.buffer = rainBuffer
    rainSrc.loop = true
    const rainFilter = ctx.createBiquadFilter()
    rainFilter.type = 'bandpass'
    rainFilter.frequency.value = 1400
    rainFilter.Q.value = 0.6
    rainGain = ctx.createGain()
    rainGain.gain.value = 0
    rainSrc.connect(rainFilter).connect(rainGain).connect(master)
    rainSrc.start()

    // ---- 鸟鸣：随机间隔调度 ----
    birdTimer = setInterval(() => scheduleChirp(), 2500 + Math.random() * 3500)
    return ctx
  }

  function createNoiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ac.sampleRate * seconds)
    const buffer = ac.createBuffer(1, len, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  function scheduleChirp(): void {
    if (!ctx || !master || !enabled) return
    // 雨天鸟鸣少
    if (rainIntensity > 0.5 && Math.random() < 0.7) return
    const t0 = ctx.currentTime
    const count = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.06)
      const freq = 2500 + Math.random() * 1600
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * (1.25 + Math.random() * 0.3), t + 0.07)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.06, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
      osc.connect(g).connect(master)
      osc.start(t)
      osc.stop(t + 0.14)
      const voice: ChirpVoice = { osc, gain: g }
      void voice
    }
  }

  return {
    setEnabled(on: boolean) {
      enabled = on
      if (!ctx && on) ensureCtx()
      if (!ctx || !master || !windGain || !rainGain) return
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setTargetAtTime(on ? 0.85 : 0, now, 0.4)
      // 启动时渐入风声
      if (on) {
        windGain.gain.cancelScheduledValues(now)
        windGain.gain.setTargetAtTime(0.05, now, 1.2)
      } else {
        windGain.gain.setTargetAtTime(0, now, 0.5)
        rainGain.gain.setTargetAtTime(0, now, 0.5)
      }
    },
    setRainIntensity(v: number) {
      rainIntensity = v
      if (!ctx || !rainGain) return
      const now = ctx.currentTime
      rainGain.gain.cancelScheduledValues(now)
      rainGain.gain.setTargetAtTime(v * 0.16, now, 0.8)
      if (windFilter) windFilter.frequency.setTargetAtTime(420 - v * 160, now, 0.8)
    },
    dispose() {
      disposed = true
      if (birdTimer) clearInterval(birdTimer)
      if (ctx) void ctx.close()
      ctx = null
    },
  }
}
