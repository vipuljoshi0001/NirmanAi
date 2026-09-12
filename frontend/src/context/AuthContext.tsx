import React, { createContext, useContext, useState, useEffect } from 'react'
import type { AuthUser, UserRole } from '../types'
import { authLogin } from '../services/api'

interface AuthContextType {
  user: AuthUser | null
  role: UserRole
  login: (role: 'admin' | 'contractor', contractorId?: string) => Promise<AuthUser>
  logout: () => void
  isLoginModalOpen: boolean
  setLoginModalOpen: (open: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'nirman_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [isLoginModalOpen, setLoginModalOpen] = useState<boolean>(false)

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Failed to save auth state to localStorage', e)
    }
  }, [user])

  const login = async (role: 'admin' | 'contractor', contractorId?: string): Promise<AuthUser> => {
    const res = await authLogin(role, contractorId)
    setUser(res.user)
    setLoginModalOpen(false)
    return res.user
  }

  const logout = () => {
    setUser(null)
  }

  const role: UserRole = user ? user.role : 'guest'

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        login,
        logout,
        isLoginModalOpen,
        setLoginModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
