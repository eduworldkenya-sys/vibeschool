'use client'

import { createContext, useContext } from 'react'

export interface GlobalAuthContextType {
  isLoggedIn: boolean
  userId: string | null
  userName: string | null
  triggerAuthPrompt: (action: 'write' | 'vibe' | 'save' | 'create') => void
}

export const GlobalAuthContext = createContext<GlobalAuthContextType>({
  isLoggedIn: false,
  userId: null,
  userName: null,
  triggerAuthPrompt: () => {},
})

export const useGlobalAuth = () => useContext(GlobalAuthContext)
