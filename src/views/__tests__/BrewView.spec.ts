// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import BrewView from '@/views/BrewView.vue'
import { useBrewStore } from '@/stores/brew'
import { useTeaStore } from '@/stores/tea'
import { getTeaById } from '@/data/teas'
import { registerIcons } from '@/plugins/icons'
import { BrewPhase } from '@/types/brewing'

// 这两个组合式依赖 WebGL / Web Audio / tsParticles，jsdom 下会崩溃，必须 mocked。
vi.mock('@/composables/useAudio', () => ({
  useAudio: () => ({
    state: {},
    switchAmbient() {},
    toggleAmbient() {},
    stopAmbient() {},
    autoSwitchAmbient() {},
    getTimeBasedAmbient() {},
    ambientTracks: [],
    startAmbient() {},
    startBoiling() {},
    stopBoiling() {},
    startCrackle() {},
    stopCrackle() {},
    playPourWater() {},
    playPourTea() {},
    stopAll() {},
    playSfx() {},
    playBoil() {},
    playTeaDrop() {},
    playPour() {},
    playOutflow() {},
    playSip() {},
    playSuccess() {},
    playQing() {},
    startCrackleSynthesis() {},
    stopCrackleSynthesis() {},
    setMasterVolume() {},
    setSfxVolume() {},
    setAmbientVolume() {},
    toggleMute() {},
  }),
}))

vi.mock('@/composables/useParticles', () => ({
  useParticleSystem: () => ({
    containerRef: vi.fn(),
    state: { mode: 'idle', isRunning: false, flameIntensity: 1, steamIntensity: 1 },
    startFire() {},
    stopFire() {},
    startSteam() {},
    stopSteam() {},
    startRipple() {},
    stopRipple() {},
    setFlameIntensity() {},
    setSteamIntensity() {},
    destroy() {},
  }),
}))

const TeaBrewScene3DStub = { name: 'TeaBrewScene3D', template: '<div class="scene3d-stub"></div>' }
let ceremonyProps: Record<string, unknown> | null = null
const CeremonyProgressStub = {
  name: 'CeremonyProgress',
  props: ['steps', 'currentIndex'],
  template: '<div class="ceremony-stub"></div>',
  setup(props: { currentIndex: number }) {
    ceremonyProps = props as unknown as Record<string, unknown>
    return {}
  },
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/brew', name: 'brew', component: { template: '<div>brew</div>' } },
      { path: '/tools', name: 'tools', component: { template: '<div>tools</div>' } },
      { path: '/taste', name: 'taste', component: { template: '<div>taste</div>' } },
    ],
  })
}

describe('BrewView', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = makeRouter()
    ceremonyProps = null
    vi.useRealTimers()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function mountBrew() {
    router.push('/brew')
    await router.isReady()
    wrapper = mount(BrewView, {
      global: {
        plugins: [pinia, router, registerIcons],
        stubs: { TeaBrewScene3D: TeaBrewScene3DStub, CeremonyProgress: CeremonyProgressStub },
      },
    })
    await flushPromises()
    return wrapper
  }

  function mainActionButton(w: ReturnType<typeof mount>) {
    return w
      .findAll('button')
      .find((b) => /°C|温杯中|醒茶中|第\d+泡|出汤|继续|开始品鉴/.test(b.text()))!
  }

  it('redirects to /tools when arriving at IDLE (no brew setup)', async () => {
    useBrewStore().state.phase = BrewPhase.IDLE
    await mountBrew()
    expect(router.currentRoute.value.name).toBe('tools')
  })

  it('shows the live temperature while HEATING and disables the main action', async () => {
    const brew = useBrewStore()
    brew.state.phase = BrewPhase.HEATING
    brew.state.currentTemp = 20
    await mountBrew()
    expect(wrapper!.text()).toContain('20°C')
    expect((mainActionButton(wrapper!).element as HTMLButtonElement).disabled).toBe(true)
  })

  it('prompts the first infusion while READY', async () => {
    const brew = useBrewStore()
    brew.state.phase = BrewPhase.READY
    brew.state.infusionsDone = 0
    await mountBrew()
    expect(wrapper!.text()).toContain('第1泡')
    expect(ceremonyProps?.currentIndex).toBe(4)
  })

  it('shows "继续" when more infusions remain (DONE)', async () => {
    const brew = useBrewStore()
    const tea = useTeaStore()
    brew.state.phase = BrewPhase.DONE
    brew.state.infusionsDone = 1
    tea.currentTea = { ...getTeaById('longjing')!, infusions: 3 } as never
    await mountBrew()
    expect(wrapper!.text()).toContain('继续')
  })

  it('shows "开始品鉴" after the last infusion (DONE)', async () => {
    const brew = useBrewStore()
    brew.state.phase = BrewPhase.DONE
    brew.state.infusionsDone = 3
    await mountBrew()
    expect(wrapper!.text()).toContain('开始品鉴')
    expect(ceremonyProps?.currentIndex).toBe(5)
  })

  it('advances the full HEATING → WARMING → RINSING → READY state machine via timers', async () => {
    vi.useFakeTimers()
    const brew = useBrewStore()
    brew.state.phase = BrewPhase.HEATING
    brew.state.currentTemp = 20
    brew.state.targetTemp = 80
    await mountBrew()
    // 加热：约 60×80ms 达到目标 80°C → 自动转 WARMING
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(brew.state.phase).toBe(BrewPhase.WARMING)
    // 温杯 800ms → RINSING + 启动醒茶倒计时
    vi.advanceTimersByTime(800)
    await flushPromises()
    expect(brew.state.phase).toBe(BrewPhase.RINSING)
    // 醒茶倒计时 5s → READY
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(brew.state.phase).toBe(BrewPhase.READY)
  })
})
