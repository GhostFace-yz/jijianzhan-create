import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Send, Square, Copy, Check } from 'lucide-react'
import { getMessages, sendMessageStream } from '@/services/messages'
import type { Message } from '@/types'

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  const handleCopy = async () => {
    const text = codeRef.current?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative group my-2">
      <pre ref={codeRef} className={`${className} rounded-md bg-muted p-4 overflow-x-auto text-sm`}>
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
        title="复制代码"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()

  const activeSessionId = searchParams.get('sessionId')

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    setIsLoadingHistory(true)
    getMessages(activeSessionId)
      .then((msgs) => setMessages(msgs))
      .catch(() => setMessages([]))
      .finally(() => setIsLoadingHistory(false))
  }, [activeSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming || !activeSessionId) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sessionId: activeSessionId,
      role: 'USER',
      content: input.trim(),
      type: 'TEXT',
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    abortRef.current = sendMessageStream(
      { sessionId: activeSessionId, content: userMessage.content, type: 'TEXT' },
      (chunk) => {
        setStreamingContent((prev) => prev + chunk)
      },
      () => {
        setIsStreaming(false)
        setStreamingContent((finalContent) => {
          const assistantMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            sessionId: activeSessionId,
            role: 'ASSISTANT',
            content: finalContent,
            type: 'TEXT',
            createdAt: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, assistantMessage])
          return ''
        })
        abortRef.current = null
      },
      (error) => {
        setIsStreaming(false)
        setStreamingContent('')
        const errorMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          sessionId: activeSessionId,
          role: 'ASSISTANT',
          content: `❌ 发送失败：${error.message}`,
          type: 'TEXT',
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMessage])
        abortRef.current = null
      }
    )
  }, [input, isStreaming, activeSessionId])

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current()
      abortRef.current = null
      setIsStreaming(false)
      setStreamingContent((finalContent) => {
        if (finalContent) {
          const assistantMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            sessionId: activeSessionId || '',
            role: 'ASSISTANT',
            content: finalContent,
            type: 'TEXT',
            createdAt: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, assistantMessage])
        }
        return ''
      })
    }
  }, [activeSessionId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          {activeSessionId ? 'AI 聊天' : '请选择或创建一个会话'}
        </h1>
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            正在生成...
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {isLoadingHistory && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!activeSessionId && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            请从左侧选择一个会话或新建会话开始聊天
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === 'USER'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {msg.role === 'USER' ? (
                msg.content
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      pre({ children }) {
                        return <CodeBlock>{children}</CodeBlock>
                      },
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className="bg-background/80 px-1 py-0.5 rounded text-xs" {...props}>
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-muted text-muted-foreground">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    pre({ children }) {
                      return <CodeBlock>{children}</CodeBlock>
                    },
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      return match ? (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className="bg-background/80 px-1 py-0.5 rounded text-xs" {...props}>
                          {children}
                        </code>
                      )
                    },
                  }}
                >
                  {streamingContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-muted text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                思考中…
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeSessionId ? '输入消息…' : '请先选择会话'}
            disabled={!activeSessionId || isStreaming}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              onClick={handleCancel}
              className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!activeSessionId || !input.trim()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
