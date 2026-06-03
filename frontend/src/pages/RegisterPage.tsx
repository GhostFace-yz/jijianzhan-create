import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Check } from 'lucide-react'
import { register } from '@/services/auth'
import { useAuthStore } from '@/stores/authStore'
import type { ApiError } from '@/types'

function getPasswordStrength(password: string): { label: string; color: string; score: number } {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { label: '弱', color: 'bg-red-500', score }
  if (score <= 3) return { label: '中', color: 'bg-yellow-500', score }
  return { label: '强', color: 'bg-green-500', score }
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!email) {
      newErrors.email = '请输入邮箱'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '邮箱格式不正确'
    }
    if (!password) {
      newErrors.password = '请输入密码'
    } else if (password.length < 8) {
      newErrors.password = '密码长度至少8位'
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认密码'
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return

    setIsLoading(true)
    try {
      const res = await register({ email, password, confirmPassword })
      const { accessToken, refreshToken, user } = res.data
      setAuth(user, accessToken, refreshToken)
      navigate('/')
    } catch (err) {
      const apiError = err as ApiError
      const message = apiError.response?.data?.message
      const code = apiError.response?.data?.code
      if (code === 'EMAIL_EXISTS') {
        setServerError('该邮箱已被注册')
      } else {
        setServerError(message || '注册失败，请稍后重试')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const strengthChecks = [
    { label: '至少8个字符', met: password.length >= 8 },
    { label: '包含大写字母', met: /[A-Z]/.test(password) },
    { label: '包含小写字母', met: /[a-z]/.test(password) },
    { label: '包含数字', met: /\d/.test(password) },
    { label: '包含特殊字符', met: /[^A-Za-z0-9]/.test(password) },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-card-foreground">注册</h1>
          <p className="text-sm text-muted-foreground mt-1">创建一个新账号以开始使用</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              邮箱
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
                }}
                className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码（至少8位）"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
                }}
                className="w-full rounded-md border border-input bg-background pl-10 pr-10 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            {password && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${(strength.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{strength.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {strengthChecks.map((check) => (
                    <div
                      key={check.label}
                      className={`flex items-center gap-1 text-xs ${
                        check.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                      }`}
                    >
                      <Check className={`h-3 w-3 ${check.met ? 'opacity-100' : 'opacity-30'}`} />
                      {check.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              确认密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (errors.confirmPassword)
                    setErrors((prev) => ({ ...prev, confirmPassword: '' }))
                }}
                className="w-full rounded-md border border-input bg-background pl-10 pr-10 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                注册中...
              </>
            ) : (
              '注册'
            )}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            已有账号？{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              立即登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
