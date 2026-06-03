import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { getCurrentUser, updateCurrentUser } from '@/services/users'
import { getPresignedUrl, uploadToOSS } from '@/services/uploads'
import { Camera, Loader2, Save, User } from 'lucide-react'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadProgress, setUploadProgress] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setAuth = useAuthStore((s) => s.setAuth)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    let cancelled = false
    getCurrentUser()
      .then((u) => {
        if (!cancelled) {
          setName(u.name)
          setAvatarUrl(u.avatar_url)
        }
      })
      .catch(() => {
        if (!cancelled) setError('获取用户信息失败')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB')
      return
    }

    setUploadProgress(true)
    setError('')
    try {
      const presigned = await getPresignedUrl(file.name, file.type, file.size)
      await uploadToOSS(presigned.upload_url, file, file.type)
      setAvatarUrl(presigned.access_url)
    } catch {
      setError('头像上传失败')
    } finally {
      setUploadProgress(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('昵称不能为空')
      return
    }
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await updateCurrentUser({
        name: name.trim(),
        avatar_url: avatarUrl ?? undefined,
      })
      if (user) {
        setAuth({ ...user, name: updated.name, avatar_url: updated.avatar_url }, useAuthStore.getState().accessToken!, useAuthStore.getState().refreshToken!)
      }
      setSuccess('保存成功')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">用户中心</h1>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleAvatarClick}
              disabled={uploadProgress}
              className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors group"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <User className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadProgress ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">点击头像更换（支持 jpg/png/webp，最大 5MB）</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">昵称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="请输入昵称"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">邮箱</label>
            <input
              type="text"
              value={user?.email ?? '未绑定'}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存
          </button>
        </div>
      )}
    </div>
  )
}
