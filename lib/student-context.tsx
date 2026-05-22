'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type VibeTab = 'feed' | 'indexer' | 'library'

interface StudentContextType {
  activeTab: VibeTab
  setActiveTab: (tab: VibeTab) => void
  isLoading: boolean
  setIsLoading: (val: boolean) => void
  error: string | null
  setError: (msg: string | null) => void
  clearError: () => void
}

const StudentContext = createContext<StudentContextType | undefined>(undefined)

export function StudentProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<VibeTab>('feed')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  return (
    <StudentContext.Provider value={{
      activeTab,
      setActiveTab,
      isLoading,
      setIsLoading,
      error,
      setError,
      clearError
    }}>
      {children}
    </StudentContext.Provider>
  )
}

export function useStudent() {
  const context = useContext(StudentContext)
  if (!context) throw new Error('useStudent must be used within StudentProvider')
  return context
}
