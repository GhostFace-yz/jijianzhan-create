export interface User {
  id: string
  email: string | null
  phone: string | null
  name: string
  avatar_url: string | null
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  title: string
  status: 'ACTIVE' | 'ARCHIVED'
  created_at: string
  updated_at: string
}

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'
export type MessageType = 'TEXT' | 'IMAGE_GEN' | 'VIDEO_GEN'

export interface GeneratedMedia {
  type: 'image' | 'video'
  url: string
}

export interface Message {
  id: string
  session_id: string
  role: MessageRole
  content: string
  type: MessageType
  attachments?: string[]
  generated_media?: GeneratedMedia[]
  metadata?: Record<string, unknown>
  created_at: string
}

export interface SendMessageRequest {
  sessionId: string
  content: string
  type: MessageType
  attachments?: string[]
  params?: GenerationParams
}

export interface GenerationParams {
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  width?: number
  height?: number
  frame_rate?: number
  frame_count?: number
}

export interface SSEChunk {
  chunk: string
  done: boolean
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface CursorPagination {
  limit: number
  next_cursor: string | null
  has_more: boolean
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface SessionDetailResponse {
  session: Session
  messages: Message[]
  pagination: CursorPagination
}

export interface TextMessageResponse {
  message: Message
  stream_url: string
}

export interface ImageGenResponse {
  message: Message
  generated_media: GeneratedMedia[]
}

export interface VideoGenResponse {
  message: Message
  task: GenerationTask
}

export type SendMessageResponse = TextMessageResponse | ImageGenResponse | VideoGenResponse

export interface GenerationTask {
  id: string
  message_id: string
  user_id: string
  type: 'IMAGE' | 'VIDEO'
  provider_task_id: string | null
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  result_url: string | null
  params: Record<string, unknown>
  error_message: string | null
  progress: number | null
  created_at: string
  updated_at: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  tier: 'FREE' | 'BASIC' | 'PRO'
  price_monthly: number
  price_yearly: number
  features: Record<string, unknown>
  quota_limits: {
    text_chats: number
    image_gens: number
    video_gens: number
  }
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED'
  current_period_start: string
  current_period_end: string
  usage_quota: number
  usage_consumed: number
  cancel_at_period_end: boolean
  plan?: SubscriptionPlan
  created_at: string
  updated_at: string
}

export interface Bill {
  id: string
  user_id: string
  subscription_id: string
  amount: number
  currency: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  paid_at: string | null
  period_start: string
  period_end: string
  created_at: string
}

export interface QuotaInfo {
  quota: {
    text_chats: number
    image_gens: number
    video_gens: number
  }
  usage: {
    text_chats: number
    image_gens: number
    video_gens: number
  }
  reset_at: string
}

export interface PresignedUrlResponse {
  upload_url: string
  object_key: string
  access_url: string
  expires_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  confirmPassword: string
}

export interface AuthResponse {
  data: {
    accessToken: string
    refreshToken: string
    expires_in: number
    token_type: string
    user: User
  }
}

export interface ApiError {
  response?: {
    data?: {
      message?: string
      code?: string
    }
  }
  message: string
}
