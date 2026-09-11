/**
 * API 聚合导出
 * 拆分历史：原 api.ts 313 行单文件，抽 http.ts 基础层后按域拆 auth/records/teas/garden。
 * 对外保持 `from '@/services/api'` 不变。
 */

export { authApi } from './auth'
export { recordsApi, toRecordDto, type RecordCreateDto } from './records'
export { teasApi } from './teas'
export { gardenApi, toGardenPlantDto, type GardenPlantCreateDto } from './garden'
export { ApiError } from '../http'
