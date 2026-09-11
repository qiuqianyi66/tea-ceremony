/** 认证 API */

import { requestOrMock } from '../http'

export const authApi = {
  async register(username: string, password: string, displayName?: string) {
    return requestOrMock('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, display_name: displayName }),
    }, {
      access_token: 'dev-token',
      user: { id: 1, username, display_name: displayName || username, level: 1, xp: 0 },
    })
  },

  async login(username: string, password: string) {
    return requestOrMock('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, {
      access_token: 'dev-token',
      user: { id: 1, username, display_name: username, level: 1, xp: 0 },
    })
  },
}
