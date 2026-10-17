/**
 * Howler 音轨层：初始化、音轨表、环境音播放控制、音量与卸载
 *
 * 策略：环境音/长音效 → Howler.js (流式加载、循环、音量独立控制)
 *
 * 音频资源目录：public/audio/
 *   ambient/    - 环境音 (guqin.webm/mp3, xiao.webm/mp3, water.webm/mp3)
 *   sfx/        - 精灵图 (tea-sprites.webm/mp3 + tea-sprites.json)
 *
 * 宿主单例：Howler 实例与 AudioContext 引用均由 useAudio.ts 的 audioHost 持有，
 * 本模块只经 audioHost 读取/登记，不自持实例副本。
 */

import { Howl, Howler } from 'howler'
import { audioHost } from './host'
import type { AmbientTrack } from './host'

/** 有素材文件的 Howler 音轨；rain / wind 走程序化合成 */
type HowlerTrack = Exclude<AmbientTrack, 'rain' | 'wind'>

// ============ Howler 初始化 ============

// 移动端自动解锁
function setupMobileUnlock() {
  const unlock = () => {
    Howler.autoUnlock = true
    const ctx = audioHost.audioCtx
    if (ctx?.state === 'suspended') {
      ctx.resume()
    }
    document.removeEventListener('touchstart', unlock)
    document.removeEventListener('click', unlock)
  }
  document.addEventListener('touchstart', unlock, { once: true, passive: true })
  document.addEventListener('click', unlock, { once: true, passive: true })
}

export function initHowler() {
  if (audioHost.ambientHowl || audioHost.sfxHowl) return

  // 环境音 Howl - 流式加载，支持循环
  audioHost.ambientHowl = new Howl({
    src: ['/audio/ambient/guqin.webm', '/audio/ambient/guqin.mp3'],
    loop: true,
    html5: true, // 大文件流式
    volume: audioHost.state.value.ambientVolume * audioHost.state.value.masterVolume,
    onplayerror: (id, err) => {
      console.warn('[Audio] 环境音加载失败，尝试备用格式:', err)
      // 可在此切换到备用 src
    },
    onload: () => console.log('[Audio] 环境音就绪'),
  })

  // 交互音效精灵图 Howl
  audioHost.sfxHowl = new Howl({
    src: ['/audio/sfx/tea-sprites.webm', '/audio/sfx/tea-sprites.mp3'],
    sprite: {
      boil: [0, 3000],
      teaDrop: [3000, 500],
      pour: [3500, 1500],
      outflow: [5000, 800],
      sip: [5800, 600],
      success: [6400, 1000],
      crackle: [7400, 200], // 备用合成噼啪
    },
    volume: audioHost.state.value.sfxVolume * audioHost.state.value.masterVolume,
    onload: () => console.log('[Audio] SFX 精灵图就绪'),
    onplayerror: (id, err) => console.warn('[Audio] SFX 播放失败:', err),
  })

  // 全局音量同步
  Howler.volume(audioHost.state.value.masterVolume)
  setupMobileUnlock()
}

// ============ 环境音控制 ============

export const ambientTracks: Record<HowlerTrack, { webm: string; mp3: string; name: string }> = {
  guqin: { webm: '/audio/ambient/guqin.webm', mp3: '/audio/ambient/guqin.mp3', name: '古琴·流泉' },
  xiao: { webm: '/audio/ambient/xiao.webm', mp3: '/audio/ambient/xiao.mp3', name: '洞箫·梅花三弄' },
  water: { webm: '/audio/ambient/water.webm', mp3: '/audio/ambient/water.mp3', name: '山涧流水' },
  night: { webm: '/audio/ambient/night.webm', mp3: '/audio/ambient/night.mp3', name: '夜·虫鸣' },
}

/** 换轨：先停当前实例，换源重建，再按 wasPlaying 续播 */
export function loadAmbientTrack(track: HowlerTrack, wasPlaying: boolean) {
  const src = [ambientTracks[track].webm, ambientTracks[track].mp3]

  // 无缝切换：先停止当前，换源，再播放
  audioHost.ambientHowl?.stop()
  audioHost.ambientHowl?.unload()
  audioHost.ambientHowl = new Howl({
    src,
    loop: true,
    html5: true,
    volume: audioHost.state.value.ambientVolume * audioHost.state.value.masterVolume,
    onload: () => {
      if (wasPlaying) audioHost.ambientHowl?.play()
    },
  })
}

export function playAmbientHowl() {
  audioHost.ambientHowl?.play()
}

export function pauseAmbientHowl() {
  audioHost.ambientHowl?.pause()
}

export function stopAmbientHowl() {
  audioHost.ambientHowl?.stop()
}

/** 停掉并卸载 Howler 环境音实例（切到合成层时用） */
export function stopHowlerAmbient() {
  const ambient = audioHost.ambientHowl
  if (ambient) {
    ambient.stop()
    ambient.unload()
    audioHost.ambientHowl = null
  }
}

/** 卸载全部 Howler 实例（dispose 用） */
export function unloadHowler() {
  audioHost.ambientHowl?.unload()
  audioHost.sfxHowl?.unload()
  audioHost.ambientHowl = null
  audioHost.sfxHowl = null
}

// ============ 音量（Howler 侧） ============

export function setHowlerMasterVolume(volume: number) {
  Howler.volume(volume)
}

export function muteHowler(muted: boolean) {
  Howler.mute(muted)
}

export function setAmbientHowlVolume(volume: number) {
  audioHost.ambientHowl?.volume(volume)
}

export function setSfxHowlVolume(volume: number) {
  audioHost.sfxHowl?.volume(volume)
}
