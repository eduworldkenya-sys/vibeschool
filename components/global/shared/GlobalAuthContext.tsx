'use client'

import { createContext, useContext } from 'react'

export interface GlobalAuthContextType {
  authReady: boolean
  isLoggedIn: boolean
  userId: string | null
  userName: string | null
  triggerAuthPrompt: (action: 'write' | 'vibe' | 'save' | 'create') => void
}

export const GlobalAuthContext = createContext<GlobalAuthContextType>({
  authReady: false,
  isLoggedIn: false,
  userId: null,
  userName: null,
  triggerAuthPrompt: () => {},
})

export const useGlobalAuth = () => useContext(GlobalAuthContext)
