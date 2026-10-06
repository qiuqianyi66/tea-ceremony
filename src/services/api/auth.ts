/** 认证 API（Spring Boot /api/v1/auth，契约见 .harness/wiki/api-contract.md） */

import { requestOrMock } from '../http'

/** 新后端 TokenVo（ApiResponse.data；user.displayName 为 camelCase——后端无全局 snake_case 策略） */
interface TokenVo {
  token: string
  expiresInSeconds: number
  user: {
    id: number
    username: string
    displayName: string
    level: number
    xp: number
  }
}

interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

/** 解包 ApiResponse.data，并把 user.displayName 还原为前端 UserInfo.display_name（store 零改动） */
function toStoreShape(data: TokenVo): {
  access_token: string
  user: { id: number; username: string; display_name: string; level: number; xp: number }
} {
  return {
    access_token: data.token,
    user: {
      id: data.user.id,
      username: data.user.username,
      display_name: data.user.displayName,
      level: data.user.level,
      xp: data.user.xp,
    },
  }
}

export const authApi = {
  async register(username: string, password: string, displayName?: string) {
    const res = await requestOrMock<ApiResponse<TokenVo>>(
      '/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, displayName }),
      },
      {
        code: 'OK',
        message: 'ok',
        data: {
          token: 'dev-token',
          expiresInSeconds: 86400,
          user: { id: 1, username, displayName: displayName || username, level: 1, xp: 0 },
        },
      },
    )
    return toStoreShape(res.data)
  },

  async login(username: string, password: string) {
    const res = await requestOrMock<ApiResponse<TokenVo>>(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      {
        code: 'OK',
        message: 'ok',
        data: {
          token: 'dev-token',
          expiresInSeconds: 86400,
          user: { id: 1, username, displayName: username, level: 1, xp: 0 },
        },
      },
    )
    return toStoreShape(res.data)
  },
}
