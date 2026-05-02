import { create } from 'zustand'
import type { UserInfo, LoginResponse } from '../api/client'
import { api } from '../api/client'

interface AuthState {
  user: UserInfo | null
  token: string | null
  loading: boolean
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,

  login: async (phone: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { phone, password })
    localStorage.setItem('token', res.access_token)
    set({ token: res.access_token })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },

  fetchUser: async () => {
    try {
      set({ loading: true })
      const user = await api.get<UserInfo>('/auth/me')
      set({ user })
    } catch {
      localStorage.removeItem('token')
      set({ user: null, token: null })
    } finally {
      set({ loading: false })
    }
  },
}))
