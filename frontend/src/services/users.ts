import { api } from './api'
import type { User, ApiResponse } from '@/types'

export async function getCurrentUser(): Promise<User> {
  const res = await api.get<ApiResponse<User>>('/users/me')
  return res.data.data
}

export async function updateCurrentUser(data: { name?: string; avatar_url?: string }): Promise<User> {
  const res = await api.patch<ApiResponse<User>>('/users/me', data)
  return res.data.data
}
