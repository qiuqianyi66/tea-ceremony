/**
 * useImgFailed 组合式单测：失败标记只增不减、跨 key 隔离。
 */
import { describe, expect, it } from 'vitest'
import { useImgFailed } from '@/composables/useImgFailed'

describe('useImgFailed', () => {
  it('标记后对应 key 变为 true', () => {
    const { imgFailed, markImgFailed } = useImgFailed()
    expect(imgFailed['longjing']).toBeFalsy()
    markImgFailed('longjing')
    expect(imgFailed['longjing']).toBe(true)
  })

  it('key 之间互不影响', () => {
    const { imgFailed, markImgFailed } = useImgFailed()
    markImgFailed('longjing')
    expect(imgFailed['biluochun']).toBeFalsy()
  })

  it('同一实例的标记在响应式对象上持续累积', () => {
    const { imgFailed, markImgFailed } = useImgFailed()
    markImgFailed('a')
    markImgFailed('b')
    expect(Object.keys(imgFailed)).toEqual(['a', 'b'])
  })
})
