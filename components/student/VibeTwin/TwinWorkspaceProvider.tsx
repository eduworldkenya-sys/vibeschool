"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useStudent } from "@/lib/student-context"
import { getLearnerTwinState, type LearnerTwinState } from "@/lib/student/twin"

interface TwinWorkspaceContextValue {
  isOpen: boolean
  openTwin: () => void
  closeTwin: () => void
  refreshTwin: () => Promise<void>
  brain: LearnerTwinState | null
  brainLoading: boolean
  brainError: string | null
}

const TwinWorkspaceContext = createContext<TwinWorkspaceContextValue | null>(null)

export function useTwinWorkspace() {
  const value = useContext(TwinWorkspaceContext)
  if (!value) throw new Error("useTwinWorkspace must be used inside TwinWorkspaceProvider")
  return value
}

export function useTwinBrain() {
  const value = useTwinWorkspace()
  return { state: value.brain, loading: value.brainLoading, error: value.brainError, refresh: value.refreshTwin }
}

export default function TwinWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { identity } = useStudent()
  const [brain, setBrain] = useState<LearnerTwinState | null>(null)
  const [brainLoading, setBrainLoading] = useState(false)
  const [brainError, setBrainError] = useState<string | null>(null)
  const attemptedBrainForStudentRef = useRef<string | null>(null)

  const refreshBrain = useCallback(async (force = false) => {
    if (!identity?.studentId) return null
    setBrainLoading(true)
    setBrainError(null)
    try {
      const nextBrain = await getLearnerTwinState({ force })
      if (nextBrain.studentId && nextBrain.studentId !== identity.studentId) {
        throw new Error("Your Twin state does not match the active learner profile.")
      }
      setBrain(nextBrain)
      attemptedBrainForStudentRef.current = identity.studentId
      return nextBrain
    } catch (cause) {
      attemptedBrainForStudentRef.current = identity.studentId
      setBrainError(cause instanceof Error ? cause.message : "Your Twin state could not be loaded.")
      return null
    } finally {
      setBrainLoading(false)
    }
  }, [identity?.studentId])

  const refreshTwin = useCallback(async () => { await refreshBrain(true) }, [refreshBrain])
  const openTwin = useCallback(() => { router.push("/student/twin") }, [router])
  const closeTwin = useCallback(() => { router.back() }, [router])

  useEffect(() => {
    if (!identity?.studentId) {
      setBrain(null)
      setBrainError(null)
      attemptedBrainForStudentRef.current = null
      return
    }
    if (brain?.studentId === identity.studentId) return
    if (attemptedBrainForStudentRef.current === identity.studentId || brainLoading) return
    attemptedBrainForStudentRef.current = identity.studentId
    void refreshBrain(false)
  }, [brain?.studentId, brainLoading, identity?.studentId, refreshBrain])

  const value = useMemo<TwinWorkspaceContextValue>(() => ({
    isOpen: false,
    openTwin,
    closeTwin,
    refreshTwin,
    brain,
    brainLoading,
    brainError,
  }), [brain, brainError, brainLoading, closeTwin, openTwin, refreshTwin])

  return (
    <TwinWorkspaceContext.Provider value={value}>
      {children}

    </TwinWorkspaceContext.Provider>
  )
}
