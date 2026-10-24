/**
 * 茶图 / 茶器图加载失败记录（纯 UI 状态，不持久化）。
 *
 * 此前该逻辑以 reactive + markImgFailed 形式在 5 个组件里逐字重复
 * （CollectionView / SelectView / TeaDetailView / HomeTeaCard / ToolSelect），
 * 收敛到单一来源。模板侧 v-if="imgFailed[key]" 用法不变。
 */
import { reactive } from 'vue'

export function useImgFailed() {
  const imgFailed = reactive<Record<string, boolean>>({})
  function markImgFailed(key: string) {
    imgFailed[key] = true
  }
  return { imgFailed, markImgFailed }
}
