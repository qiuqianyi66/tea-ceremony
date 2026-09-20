/**
 * useAudio 环境音状态机测试（T1.2 主题环境音接线）
 *
 * 覆盖：rain/wind 合成层切换、播放/暂停、停止、Howler 音轨回切、音量/静音同步。
 * 测试环境无 AudioContext，合成层走 ensureSynthCtx 静默降级，仅断言状态机。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('howler', () => ({
  Howl: class {
    stop() {}
    pause() {}
    play() {}
    unload() {}
    volume() {}
    rate() {}
    pos() {}
    constructor() {}
  },
  Howler: { volume: vi.fn(), mute: vi.fn(), autoUnlock: true, usingWebAudio: false },
}))

import { useAudio } from '../useAudio'

// 模块级单例：每个用例前复位播放状态，用例内再显式切换音轨，避免跨用例泄漏
let audio: ReturnType<typeof useAudio>
beforeEach(() => {
  audio = useAudio()
  audio.stopAll()
  audio.stopAmbient()
})

describe('useAudio 环境音（rain/wind 合成层）', () => {
  it('切到 rain：currentAmbient 更新，播放状态保持（未播放时不启动合成）', () => {
    audio.switchAmbient('rain')
    expect(audio.state.value.currentAmbient).toBe('rain')
    expect(audio.state.value.ambientPlaying).toBe(false)
  })

  it('切到 wind：currentAmbient 更新', () => {
    audio.switchAmbient('wind')
    expect(audio.state.value.currentAmbient).toBe('wind')
  })

  it('从合成层切回 Howler 音轨（guqin）：currentAmbient 更新为 guqin', () => {
    audio.switchAmbient('rain')
    audio.switchAmbient('guqin')
    expect(audio.state.value.currentAmbient).toBe('guqin')
  })

  it('rain 播放中切换：切换后保持播放状态', () => {
    audio.switchAmbient('rain')
    audio.toggleAmbient()
    expect(audio.state.value.ambientPlaying).toBe(true)
    audio.switchAmbient('wind')
    expect(audio.state.value.currentAmbient).toBe('wind')
    expect(audio.state.value.ambientPlaying).toBe(true)
  })

  it('toggleAmbient：播放 → 暂停 → 再播放', () => {
    audio.switchAmbient('rain')
    audio.toggleAmbient()
    expect(audio.state.value.ambientPlaying).toBe(true)
    audio.toggleAmbient()
    expect(audio.state.value.ambientPlaying).toBe(false)
    audio.toggleAmbient()
    expect(audio.state.value.ambientPlaying).toBe(true)
  })

  it('stopAmbient：停止合成层并复位播放状态', () => {
    audio.switchAmbient('rain')
    audio.toggleAmbient()
    audio.stopAmbient()
    expect(audio.state.value.ambientPlaying).toBe(false)
  })

  it('音量/静音同步不抛错（合成层未运行时静默）', () => {
    audio.switchAmbient('rain')
    audio.toggleAmbient()
    expect(() => {
      audio.setAmbientVolume(0.5)
      audio.setMasterVolume(0.8)
      audio.toggleMute()
    }).not.toThrow()
    expect(audio.state.value.isMuted).toBe(true)
  })

  it('磬声 playQing（T3.2）：无 AudioContext 环境静默不抛错', () => {
    expect(() => audio.playQing()).not.toThrow()
    expect(() => audio.playQing(0.5)).not.toThrow()
  })

  it('首次 toggle（无 currentAmbient）：默认切到 guqin（全新模块）', async () => {
    vi.resetModules()
    const fresh = await import('../useAudio')
    const freshAudio = fresh.useAudio()
    freshAudio.toggleAmbient()
    expect(freshAudio.state.value.currentAmbient).toBe('guqin')
    expect(freshAudio.state.value.ambientPlaying).toBe(true)
  })
})
