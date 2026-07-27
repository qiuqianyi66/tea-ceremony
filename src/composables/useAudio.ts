/**
 * 茶道音效系统
 * 使用 Web Audio API 纯合成音效，无需外部音频文件
 *
 * 音效清单：
 * - 环境音：古琴泛音 + 轻风白噪音
 * - 煮水声：低通滤波白噪音 + LFO 振幅调制（沸腾气泡）
 * - 火焰噼啪：短时带通噪声爆发
 * - 注水声：包络成形带通噪声
 * - 出汤声：中频带通噪声 + 衰减
 * - 轻啜声：短时指数衰减带通噪声
 */

let audioCtx: AudioContext | null = null

// ============ 内部音频节点引用（用于停止特定音效）============
let ambientNodes: { oscillators: OscillatorNode[]; windSrc: AudioBufferSourceNode | null; gains: GainNode[]; lfos: OscillatorNode[]; lfoGains: GainNode[] } | null = null
let boilingSource: AudioBufferSourceNode | null = null
let boilingGain: GainNode | null = null
let boilingLfo: OscillatorNode | null = null
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

/** 生成白噪音 AudioBuffer */
function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * durationSec)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

// ============ ① 环境音 ============

export function startAmbient() {
  const ctx = getContext()
  stopAmbient()

  const oscillators: OscillatorNode[] = []
  const gains: GainNode[] = []
  const lfos: OscillatorNode[] = []
  const lfoGains: GainNode[] = []

  // 古琴风格泛音：轻微失谐的正弦波叠加
  const baseFreq = 220 // A3
  const partials = [1, 2.01, 3.02, 4.99, 7.01]
  partials.forEach((ratio, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = baseFreq * ratio

    const gain = ctx.createGain()
    gain.gain.value = 0.02 / (i + 1)

    // 缓慢振幅调制
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.1 + Math.random() * 0.2
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.01
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    lfo.start()
    lfos.push(lfo)
    lfoGains.push(lfoGain)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    oscillators.push(osc)
    gains.push(gain)
  })

  // 轻微风噪层
  const windBuffer = createNoiseBuffer(ctx, 8)
  const windSrc = ctx.createBufferSource()
  windSrc.buffer = windBuffer
  windSrc.loop = true
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 300
  const windGain = ctx.createGain()
  windGain.gain.value = 0.015
  windSrc.connect(windFilter).connect(windGain).connect(ctx.destination)
  windSrc.start()

  ambientNodes = { oscillators, windSrc, gains, lfos, lfoGains }
}

export function stopAmbient() {
  if (ambientNodes) {
    ambientNodes.oscillators.forEach(o => { try { o.stop() } catch {} })
    ambientNodes.lfos.forEach(o => { try { o.stop() } catch {} })
    if (ambientNodes.windSrc) { try { ambientNodes.windSrc.stop() } catch {} }
    ambientNodes = null
  }
}

// ============ ② 煮水声（沸腾气泡）============

export function startBoiling() {
  const ctx = getContext()
  stopBoiling()

  // 噪声源
  const buffer = createNoiseBuffer(ctx, 4)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  // 低通滤波 → 闷煮声
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1000
  filter.Q.value = 0.5

  // 振幅控制 + LFO 调制 → 气泡节奏
  const gain = ctx.createGain()
  gain.gain.value = 0.25

  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 4  // 4Hz → 快速气泡
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.15
  lfo.connect(lfoGain)
  lfoGain.connect(gain.gain)
  lfo.start()

  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()

  boilingSource = source
  boilingGain = gain
  boilingLfo = lfo
}

export function stopBoiling() {
  if (boilingSource) { try { boilingSource.stop() } catch {}; boilingSource = null }
  if (boilingLfo) { try { boilingLfo.stop() } catch {}; boilingLfo = null }
  boilingGain = null
}

// ============ ③ 火焰噼啪 ============

function playSingleCrackle() {
  const ctx = getContext()
  const bufferSize = Math.floor(ctx.sampleRate * 0.05) // 50ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2000 + Math.random() * 3000
  bp.Q.value = 1.5
  const g = ctx.createGain()
  g.gain.value = 0.1 + Math.random() * 0.08
  src.connect(bp).connect(g).connect(ctx.destination)
  src.start()
}

export function startCrackle() {
  stopCrackle()
  crackleInterval = setInterval(() => {
    if (Math.random() > 0.5) {
      playSingleCrackle()
      if (Math.random() > 0.6) playSingleCrackle() // 双爆
    }
  }, 150 + Math.random() * 200)
}

export function stopCrackle() {
  if (crackleInterval) {
    clearInterval(crackleInterval)
    crackleInterval = null
  }
}

// ============ ④ 注水声 ============

export function playPourWater(duration = 2.0) {
  const ctx = getContext()
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2500
  bp.Q.value = 0.8
  const env = ctx.createGain()
  const now = ctx.currentTime
  env.gain.setValueAtTime(0, now)
  env.gain.linearRampToValueAtTime(0.4, now + 0.15)  // attack
  env.gain.linearRampToValueAtTime(0.25, now + duration * 0.6) // sustain
  env.gain.linearRampToValueAtTime(0, now + duration)  // release
  src.connect(bp).connect(env).connect(ctx.destination)
  src.start(now)
}

// ============ ⑤ 出汤声 ============

export function playPourTea(duration = 1.5) {
  const ctx = getContext()
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800
  bp.Q.value = 1.0
  const env = ctx.createGain()
  const now = ctx.currentTime
  env.gain.setValueAtTime(0, now)
  env.gain.linearRampToValueAtTime(0.35, now + 0.1)
  env.gain.linearRampToValueAtTime(0.2, now + duration * 0.5)
  env.gain.linearRampToValueAtTime(0, now + duration)
  src.connect(bp).connect(env).connect(ctx.destination)
  src.start(now)
}

// ============ ⑥ 轻啜声 ============

export function playSip() {
  const ctx = getContext()
  const duration = 0.12
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 20)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3000
  bp.Q.value = 2
  const g = ctx.createGain()
  g.gain.value = 0.2
  src.connect(bp).connect(g).connect(ctx.destination)
  src.start()
}

// ============ ⑦ 投茶声（茶叶沙沙） ============

export function playDropTea() {
  const ctx = getContext()
  const duration = 0.08
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30) * (0.5 + Math.random() * 0.5)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'highpass'
  bp.frequency.value = 4000
  const g = ctx.createGain()
  g.gain.value = 0.15
  src.connect(bp).connect(g).connect(ctx.destination)
  src.start()
}

// ============ 全局停止 ============

export function stopAll() {
  stopAmbient()
  stopBoiling()
  stopCrackle()
}
