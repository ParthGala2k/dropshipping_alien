import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'

type User = { id: string; display_name: string | null; is_verified: boolean } | null

const AuthContext = createContext<{
  user: User
  loading: boolean
  login: (alienToken: string) => Promise<void>
  logout: () => Promise<void>
  devLogin: () => Promise<void>
} | null>(null)

declare global {
  interface Window {
    __ALIEN_JWT__?: string
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  const login = useCallback(async (alienToken: string) => {
    const { user: u } = await api.auth.alien(alienToken)
    setUser(u)
  }, [])

  const devLogin = useCallback(async () => {
    await api.auth.alien('dev-bypass')
    const { user: u } = await api.auth.alien('dev-bypass')
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    await api.auth.logout()
    setUser(null)
  }, [])

  useEffect(() => {
    const token = window.__ALIEN_JWT__
    if (token) {
      login(token).catch(() => setLoading(false))
      return
    }
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
      devLogin().finally(() => setLoading(false))
      return
    }
    setLoading(false)
  }, [login, devLogin])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, devLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
