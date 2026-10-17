/**
 * 音频单例宿主 —— useAudio 拆分后的依赖注入中心。
 *
 * 为什么单独成文件：`AudioContext` 与 Howler 实例必须进程内唯一，子模块不得自建。
 * 若宿主留在 `useAudio.ts` 而子模块从那里取，会形成 `useAudio ↔ audio/*` 的循环 import。
 * 下沉到本文件后依赖方向变成单向：
 *
 *     useAudio.ts  ─┐
 *     audio/sfx.ts ─┼─→ audio/host.ts（本文件，不 import 任何业务模块）
 *     audio/howlerTracks.ts ─┘
 *     audio/synthAmbient.ts ─┘
 */
import type { Howl } from 'howler'
import { ref } from 'vue'

export type AmbientTrack = 'guqin' | 'xiao' | 'water' | 'night' | 'rain' | 'wind'

export type SfxSprite =
  | 'boil' // 咕嘟沸腾声
  | 'teaDrop' // 投茶沙沙声
  | 'pour' // 注水声
  | 'outflow' // 出汤声
  | 'sip' // 轻啜声
  | 'success' // 完成音
  | 'crackle' // 火焰噼啪 (短时合成备用)

export interface AudioState {
  ambientPlaying: boolean
  currentAmbient: AmbientTrack | null
  masterVolume: number
  sfxVolume: number
  ambientVolume: number
  isMuted: boolean
}

/** 全局音量/播放状态（单例） */
export const state = ref<AudioState>({
  ambientPlaying: false,
  currentAmbient: null,
  masterVolume: 1,
  sfxVolume: 0.8,
  ambientVolume: 0.3,
  isMuted: false,
})

// AudioContext 与 Howler 实例唯一存放在本文件；子模块不得自建、自持，
// 只能经 audioHost 读取，或把新建实例登记回宿主。
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
