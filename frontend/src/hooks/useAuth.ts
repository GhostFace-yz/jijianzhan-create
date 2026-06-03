import { useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { isAuthenticated, user, accessToken, clearAuth } = useAuthStore()

  const logout = useCallback(() => {
    clearAuth()
    window.location.href = '/login'
  }, [clearAuth])

  return {
    isAuthenticated,
    user,
    accessToken,
    logout,
  }
}
