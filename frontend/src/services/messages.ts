import { api } from './api'
import { useAuthStore } from '@/stores/authStore'
import type {
  Message,
  ApiResponse,
  SendMessageRequest,
  MessageListResponse,
} from '@/types'

export async function getMessages(sessionId: string): Promise<Message[]> {
  const res = await api.get<ApiResponse<MessageListResponse>>(
    `/messages?sessionId=${sessionId}`
  )
  return res.data.data.items
}

export function sendMessageStream(
  request: SendMessageRequest,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: Error) => void
): () => void {
  const controller = new AbortController()

  const doFetch = async () => {
    try {
      const token = useAuthStore.getState().accessToken
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!res.ok) {
        if (res.status === 402) {
          throw new Error('额度已耗尽，请升级订阅计划')
        }
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              onDone()
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.chunk) {
                onChunk(parsed.chunk)
              }
              if (parsed.done) {
                onDone()
                return
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      onDone()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError(err as Error)
      }
    }
  }

  doFetch()

  return () => controller.abort()
}
