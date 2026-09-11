/**
 * IndexedDB 存储服务聚合导出
 * 拆分历史：原 storage.ts 384 行单文件，按域拆为 db/history/achievement/xp/collectedWare/settings。
 * 对外保持 `from '@/services/storage'` 不变。
 */

export { db, initDB } from './db'
export type { TeaCeremonyDB } from './db'
export { historyStorage } from './history'
export { achievementStorage } from './achievement'
export { xpStorage } from './xp'
export { collectedWareStorage } from './collectedWare'
export { settingsStorage } from './settings'
