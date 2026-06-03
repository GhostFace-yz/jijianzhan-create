import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { MessageSquare, LogOut, User } from 'lucide-react'

export default function Layout() {
  const { isAuthenticated, logout } = useAuth()

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r border-border bg-card">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <MessageSquare className="h-5 w-5" />
            AI Chat
          </Link>
        </div>
        <nav className="p-4 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            聊天
          </Link>
        </nav>
        <div className="absolute bottom-0 w-64 border-t border-border p-4">
          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                已登录
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-3 w-3" />
                退出
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <User className="h-4 w-4" />
              登录
            </Link>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
