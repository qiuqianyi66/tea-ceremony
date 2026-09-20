/**
 * IndexedDB 存储服务聚合导出
 * 拆分历史：原 storage.ts 384 行单文件，按域拆为 db/history/achievement/xp/collectedWare/settings。
 * 对外保持 `from '@/services/storage'` 不变。
 */

export { achievementStorage } from './achievement'
export { collectedWareStorage } from './collectedWare'
export type { TeaCeremonyDB } from './db'
export { db, initDB } from './db'
export { historyStorage } from './history'
export { settingsStorage } from './settings'
export { xpStorage } from './xp'
