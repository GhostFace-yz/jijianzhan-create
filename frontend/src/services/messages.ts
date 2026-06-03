import { api } from './api'
import { useAuthStore } from '@/stores/authStore'
import type {
  ApiResponse,
  SendMessageRequest,
  Message,
  PageResult,
} from '@/types'

export async function getMessages(
  sessionId: string,
  params?: { page?: number; pageSize?: number }
): Promise<PageResult<Message>> {
  const res = await api.get<ApiResponse<PageResult<Message>>>('/messages', {
    params: { sessionId, ...params },
  })
  return res.data.data
}

export function connectMessageStream(
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
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!res.ok) {
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
              if (parsed.error) {
                onError(new Error(parsed.error))
                return
              }
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

export async function sendMessage(
  request: SendMessageRequest
): Promise<{ message: Message; content: string }> {
  return new Promise((resolve, reject) => {
    let fullContent = ''
    const abort = connectMessageStream(
      request,
      (chunk) => {
        fullContent += chunk
      },
      () => {
        clearTimeout(timeoutId)
        const msg: Message = {
          id: `msg-${Date.now()}`,
          session_id: request.sessionId ?? '',
          role: 'ASSISTANT',
          content: fullContent,
          type: request.type,
          created_at: new Date().toISOString(),
        }
        resolve({ message: msg, content: fullContent })
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
    // Safety timeout: abort if it takes too long
    const timeoutId = setTimeout(() => {
      abort()
      reject(new Error('请求超时'))
    }, 120000)
  })
}
