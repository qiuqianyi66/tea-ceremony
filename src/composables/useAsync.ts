/**
 * useAsync — 统一异步状态管理
 * 消灭 view 里重复的 `const loading = ref(false); const error = ref(null); try { loading.value = true; ... }`
 *
 * 用法：
 *   const { data, loading, error, run } = useAsync(() => recordsApi.list())
 *   onMounted(() => run())
 */
import { ref, shallowRef } from 'vue'

export function useAsync<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: { immediate?: boolean } = {},
) {
  const data = shallowRef<T | null>(null)
  const error = shallowRef<Error | null>(null)
  const loading = ref(false)

  async function run(...args: Args): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const result = await fn(...args)
      data.value = result
      return result
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err
      return null
    } finally {
      loading.value = false
    }
  }

  if (options.immediate) {
    // immediate 模式不预填参数，调用方自己 run()
  }

  return { data, error, loading, run }
}
