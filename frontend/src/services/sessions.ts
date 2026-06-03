import { api } from './api'
import type { Session, ApiResponse } from '@/types'

export async function getSessions(): Promise<Session[]> {
  const res = await api.get<ApiResponse<Session[]>>('/sessions')
  return res.data.data
}

export async function createSession(): Promise<Session> {
  const res = await api.post<ApiResponse<Session>>('/sessions')
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
