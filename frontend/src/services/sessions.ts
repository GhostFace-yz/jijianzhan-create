import { api } from './api'
import type { Session, ApiResponse, PageResult, Message } from '@/types'

export async function getSessions(params?: { page?: number; limit?: number; search?: string }): Promise<PageResult<Session>> {
  const res = await api.get<ApiResponse<PageResult<Session>>>('/sessions', { params })
  return res.data.data
}

export async function getSession(sessionId: string, params?: { cursor?: string; limit?: number }): Promise<Session & { messages: Message[] }> {
  const res = await api.get<ApiResponse<Session & { messages: Message[] }>>(`/sessions/${sessionId}`, { params })
  return res.data.data
}

export async function createSession(title?: string): Promise<Session> {
  const res = await api.post<ApiResponse<Session>>('/sessions', { title })
  return res.data.data
}

export async function updateSession(
  sessionId: string,
  title: string
): Promise<Session> {
  const res = await api.patch<ApiResponse<Session>>(`/sessions/${sessionId}`, {
    title,
  })
  return res.data.data
}

export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}`)
}
