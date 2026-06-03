import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  Send,
  Square,
  Copy,
  Check,
  Image as ImageIcon,
  Video,
  MessageSquare,
  Paperclip,
  X,
} from 'lucide-react'
import { connectMessageStream, getMessages } from '@/services/messages'
import { getPresignedUrl, uploadToOSSWithProgress } from '@/services/uploads'
import type { Message, MessageType } from '@/types'

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

const TYPE_OPTIONS: { value: MessageType; label: string; icon: typeof MessageSquare }[] = [
  { value: 'TEXT', label: '文本', icon: MessageSquare },
  { value: 'IMAGE_GEN', label: '图片', icon: ImageIcon },
  { value: 'VIDEO_GEN', label: '视频', icon: Video },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('TEXT')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchParams] = useSearchParams()

  const activeSessionId = searchParams.get('sessionId')

  useEffect(() => {
    if (!activeSessionId) {
      Promise.resolve().then(() => {
        setMessages([])
        setIsLoadingHistory(false)
      })
      return
    }
    let cancelled = false
    getMessages(activeSessionId, { page: 1, pageSize: 200 })
      .then((data) => {
        if (!cancelled) setMessages(data.items)
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false)
      })
    return () => { cancelled = true }
  }, [activeSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !activeSessionId) return

    const content = input.trim()
    const type = messageType

    const optimisticUserMessage: Message = {
      id: `msg-${Date.now()}`,
      session_id: activeSessionId,
      role: 'USER',
      content,
      type,
      attachments: attachments.length > 0 ? attachments : undefined,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticUserMessage])
    setInput('')
    setAttachments([])

    if (type === 'TEXT') {
      setIsStreaming(true)
      setStreamingContent('')

      abortRef.current = connectMessageStream(
        { sessionId: activeSessionId, content, type: 'TEXT', attachments: attachments.length > 0 ? attachments : undefined },
        (chunk) => setStreamingContent((prev) => prev + chunk),
        () => {
          setIsStreaming(false)
          setStreamingContent((finalContent) => {
            if (finalContent) {
              const assistantMessage: Message = {
                id: `msg-${Date.now() + 1}`,
                session_id: activeSessionId,
                role: 'ASSISTANT',
                content: finalContent,
                type: 'TEXT',
                created_at: new Date().toISOString(),
              }
              setMessages((prev) => [...prev, assistantMessage])
            }
            return ''
          })
          abortRef.current = null
        },
        (error) => {
          setIsStreaming(false)
          setStreamingContent('')
          const errorMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            session_id: activeSessionId,
            role: 'ASSISTANT',
            content: `❌ 发送失败：${error.message}`,
            type: 'TEXT',
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, errorMessage])
          abortRef.current = null
        }
      )
    } else {
      // IMAGE_GEN or VIDEO_GEN - backend currently routes all messages through text streaming
      // We send via the messages API and display the text response with a generation notice
      setIsStreaming(true)
      setStreamingContent('')

      abortRef.current = connectMessageStream(
        { sessionId: activeSessionId, content, type, attachments: attachments.length > 0 ? attachments : undefined },
        (chunk) => setStreamingContent((prev) => prev + chunk),
        () => {
          setIsStreaming(false)
          setStreamingContent((finalContent) => {
            const prefix = type === 'IMAGE_GEN'
              ? '🎨 图片生成请求已提交，后端处理中...\n\n'
              : '🎬 视频生成请求已提交，后端处理中...\n\n'
            const fullContent = prefix + (finalContent || '')
            const assistantMessage: Message = {
              id: `msg-${Date.now() + 1}`,
              session_id: activeSessionId,
              role: 'ASSISTANT',
              content: fullContent,
              type,
              created_at: new Date().toISOString(),
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
            session_id: activeSessionId,
            role: 'ASSISTANT',
            content: `❌ 发送失败：${error.message}`,
            type: 'TEXT',
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, errorMessage])
          abortRef.current = null
        }
      )
    }
  }, [input, isStreaming, activeSessionId, messageType, attachments])

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current()
      abortRef.current = null
      setIsStreaming(false)
      setStreamingContent((finalContent) => {
        if (finalContent) {
          const assistantMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            session_id: activeSessionId || '',
            role: 'ASSISTANT',
            content: finalContent,
            type: 'TEXT',
            created_at: new Date().toISOString(),
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('仅支持图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB')
      return
    }

    setUploadProgress(0)
    try {
      const presigned = await getPresignedUrl(file.name, file.type, file.size)
      await uploadToOSSWithProgress(presigned.upload_url, file, file.type, (percent) => {
        setUploadProgress(percent)
      })
      setAttachments((prev) => [...prev, presigned.access_url])
    } catch {
      alert('上传失败')
    } finally {
      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const renderMessageContent = (msg: Message) => {
    if (msg.role === 'USER') {
      return (
        <div className="space-y-2">
          <div>{msg.content}</div>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {msg.attachments.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt="attachment"
                  className="max-h-32 rounded-md border border-white/20"
                />
              ))}
            </div>
          )}
        </div>
      )
    }

    if (msg.generated_media && msg.generated_media.length > 0) {
      return (
        <div className="space-y-2">
          {msg.content && <div>{msg.content}</div>}
          <div className="flex flex-wrap gap-2">
            {msg.generated_media.map((media, idx) =>
              media.type === 'image' ? (
                <img
                  key={idx}
                  src={media.url}
                  alt="generated"
                  className="max-h-48 rounded-md border border-border"
                />
              ) : (
                <video
                  key={idx}
                  src={media.url}
                  controls
                  className="max-h-48 rounded-md border border-border"
                />
              )
            )}
          </div>
        </div>
      )
    }

    return (
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
    )
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
              {renderMessageContent(msg)}
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

      <div className="border-t border-border px-6 py-4 space-y-3">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((url, idx) => (
              <div key={idx} className="relative group">
                <img src={url} alt="attachment" className="h-12 w-12 rounded-md object-cover border border-border" />
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>上传中...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Message type selector */}
        <div className="flex items-center gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMessageType(opt.value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                messageType === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <opt.icon className="h-3 w-3" />
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeSessionId || isStreaming || uploadProgress !== null}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="上传图片"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !activeSessionId
                ? '请先选择会话'
                : messageType === 'TEXT'
                ? '输入消息…'
                : messageType === 'IMAGE_GEN'
                ? '描述你想生成的图片…'
                : '描述你想生成的视频…'
            }
            disabled={!activeSessionId || isStreaming || uploadProgress !== null}
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
              disabled={!activeSessionId || !input.trim() || uploadProgress !== null}
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
