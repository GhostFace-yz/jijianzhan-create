export interface User {
  id: string
  email: string
  name?: string
}

export interface Session {
  id: string
  title: string
  updatedAt: string
  createdAt: string
  deletedAt?: string | null
}

export type MessageRole = 'USER' | 'ASSISTANT'

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  type: 'TEXT'
  createdAt: string
}

export interface SendMessageRequest {
  sessionId: string
  content: string
  type: 'TEXT'
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

export interface MessageListResponse {
  items: Message[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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
