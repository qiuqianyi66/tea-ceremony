/**
 * Vitest 全局测试环境：
 * 注入 fake-indexeddb（内存实现替换全局 indexedDB），让 Dexie 可测试。
 */
import 'fake-indexeddb/auto'
