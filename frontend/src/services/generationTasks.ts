import { api } from './api'
import type { GenerationTask, ApiResponse } from '@/types'

export async function getGenerationTask(id: string): Promise<GenerationTask> {
  const res = await api.get<ApiResponse<GenerationTask>>(`/generation-tasks/${id}`)
  return res.data.data
}

export async function retryGenerationTask(id: string): Promise<GenerationTask> {
  const res = await api.post<ApiResponse<GenerationTask>>(`/generation-tasks/${id}/retry`)
  return res.data.data
}
