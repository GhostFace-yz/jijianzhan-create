import { useEffect, useRef, useCallback } from 'react'

interface UseSseOptions {
  url: string
  onMessage: (data: string) => void
  onError?: (error: Event) => void
  onOpen?: () => void
}

export function useSse() {
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(({ url, onMessage, onError, onOpen }: UseSseOptions) => {
    if (esRef.current) {
      esRef.current.close()
    }

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      onOpen?.()
    }

    es.onmessage = (event) => {
      onMessage(event.data)
    }

    es.onerror = (error) => {
      onError?.(error)
    }

    return es
  }, [])

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close()
      }
    }
  }, [])

  return { connect, disconnect }
}
