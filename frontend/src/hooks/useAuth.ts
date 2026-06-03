import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { token, isAuthenticated, setToken, logout } = useAuthStore()

  return {
    token,
    isAuthenticated,
    setToken,
    logout,
  }
}
