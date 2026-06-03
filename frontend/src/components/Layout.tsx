import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
} from '@/services/sessions'
import type { Session } from '@/types'
import {
  MessageSquare,
  LogOut,
  User,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit3,
  Loader2,
  Search,
  CreditCard,
  Settings,
} from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const currentSessionId = searchParams.get('sessionId')
  const isChatActive = location.pathname === '/' || location.pathname === ''

  useEffect(() => {
    let cancelled = false
    getSessions()
      .then((res) => {
        if (!cancelled) setSessions(res.items)
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCreateSession = useCallback(async () => {
    const session = await createSession()
    setSessions((prev) => [session, ...prev])
    navigate({ pathname: '/', search: `?sessionId=${session.id}` })
  }, [navigate])

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      navigate({ pathname: '/', search: `?sessionId=${sessionId}` })
    },
    [navigate]
  )

  const handleRename = useCallback((session: Session) => {
    setEditingId(session.id)
    setEditTitle(session.title)
    setMenuOpenId(null)
  }, [])

  const handleRenameSubmit = useCallback(
    async (sessionId: string) => {
      if (!editTitle.trim()) {
        setEditingId(null)
        return
      }
      await updateSession(sessionId, editTitle.trim())
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, title: editTitle.trim() } : s
        )
      )
      setEditingId(null)
    },
    [editTitle]
  )

  const handleDelete = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setMenuOpenId(null)
      if (currentSessionId === sessionId) {
        setSearchParams({})
      }
    },
    [currentSessionId, setSearchParams]
  )

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        if (minutes === 0) return '刚刚'
        return `${minutes}分钟前`
      }
      return `${hours}小时前`
    }
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="flex h-14 items-center border-b border-border px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
          >
            <MessageSquare className="h-5 w-5" />
            AI Chat
          </button>
        </div>

        <div className="p-3 border-b border-border space-y-2">
          <button
            onClick={handleCreateSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            新建会话
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索会话…"
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && sessions.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {filteredSessions.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? '未找到匹配会话' : '暂无会话'}
            </div>
          )}

          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                isChatActive && currentSessionId === session.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted text-foreground'
              }`}
              onClick={() => handleSelectSession(session.id)}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-60" />

              {editingId === session.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleRenameSubmit(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit(session.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-sm bg-background border border-input rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(session.updated_at)}
                  </p>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(menuOpenId === session.id ? null : session.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>

              {menuOpenId === session.id && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpenId(null)}
                  />
                  <div
                    ref={menuRef}
                    className="absolute right-2 top-8 z-50 w-32 bg-card border border-border rounded-lg shadow-lg py-1"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRename(session)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      重命名
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(session.id)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3 space-y-1">
          <button
            onClick={() => navigate('/profile')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              location.pathname === '/profile'
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <Settings className="h-4 w-4" />
            用户中心
          </button>
          <button
            onClick={() => navigate('/subscription')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              location.pathname === '/subscription'
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            订阅与额度
          </button>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <span className="text-sm text-foreground truncate">
                {user?.name || user?.email || '用户'}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <Outlet context={{ sessionId: currentSessionId }} />
      </main>
    </div>
  )
}
