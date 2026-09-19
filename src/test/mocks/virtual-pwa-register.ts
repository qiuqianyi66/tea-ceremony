/**
 * virtual:pwa-register 的测试 stub：
 * 仅保证 vitest 能解析该 virtual 模块；行为由测试中 vi.mock 覆盖。
 */
export function registerSW(_options?: { immediate?: boolean; onNeedRefresh?: () => void }) {
  return () => Promise.resolve()
}
