"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useStudent } from "@/lib/student-context"
import { getLearnerTwinState, type LearnerTwinState } from "@/lib/student/twin"
import { getTwinPolicyState, type TwinPolicyState } from "@/lib/student/twinPolicy"

interface TwinWorkspaceContextValue {
  isOpen: boolean
  openTwin: () => void
  closeTwin: () => void
  refreshTwin: () => Promise<void>
  brain: LearnerTwinState | null
  brainLoading: boolean
  brainError: string | null
  policy: TwinPolicyState | null
  policyLoading: boolean
  policyError: string | null
}

const TwinWorkspaceContext = createContext<TwinWorkspaceContextValue | null>(null)

export function useTwinWorkspace() {
  const value = useContext(TwinWorkspaceContext)
  if (!value) throw new Error("useTwinWorkspace must be used inside TwinWorkspaceProvider")
  return value
}

export function useTwinBrain() {
  const value = useTwinWorkspace()
  return { state: value.brain, loading: value.brainLoading, error: value.brainError, refresh: value.refreshTwin, policy: value.policy, policyLoading: value.policyLoading, policyError: value.policyError }
}

export default function TwinWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { identity } = useStudent()
  const [brain, setBrain] = useState<LearnerTwinState | null>(null)
  const [brainLoading, setBrainLoading] = useState(false)
  const [brainError, setBrainError] = useState<string | null>(null)
  const [policy, setPolicy] = useState<TwinPolicyState | null>(null)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const attemptedBrainForStudentRef = useRef<string | null>(null)

  const refreshPolicy = useCallback(async () => {
    setPolicyLoading(true); setPolicyError(null)
    try { const next = await getTwinPolicyState(); setPolicy(next); return next }
    catch (cause) { setPolicyError(cause instanceof Error ? cause.message : "Twin policy could not be loaded."); return null }
    finally { setPolicyLoading(false) }
  }, [])

  const refreshBrain = useCallback(async (force = false) => {
    if (!identity?.studentId) return null
    setBrainLoading(true); setBrainError(null)
    try {
      const nextBrain = await getLearnerTwinState({ force })
      if (nextBrain.studentId && nextBrain.studentId !== identity.studentId) throw new Error("Your Twin state does not match the active learner profile.")
      setBrain(nextBrain); attemptedBrainForStudentRef.current = identity.studentId; return nextBrain
    } catch (cause) {
      attemptedBrainForStudentRef.current = identity.studentId
      setBrainError(cause instanceof Error ? cause.message : "Your Twin state could not be loaded.")
      return null
    } finally { setBrainLoading(false) }
  }, [identity?.studentId])

  const refreshTwin = useCallback(async () => { await Promise.all([refreshPolicy(), refreshBrain(true)]) }, [refreshBrain, refreshPolicy])
  const openTwin = useCallback(() => { if (policy?.enabled === false) return; router.push("/student/twin") }, [policy?.enabled, router])
  const closeTwin = useCallback(() => { router.back() }, [router])

  useEffect(() => { void refreshPolicy() }, [refreshPolicy])
  useEffect(() => {
    if (!identity?.studentId) { setBrain(null); setBrainError(null); attemptedBrainForStudentRef.current = null; return }
    if (brain?.studentId === identity.studentId) return
    if (attemptedBrainForStudentRef.current === identity.studentId || brainLoading) return
    attemptedBrainForStudentRef.current = identity.studentId
    void refreshBrain(false)
  }, [brain?.studentId, brainLoading, identity?.studentId, refreshBrain])

  const value = useMemo<TwinWorkspaceContextValue>(() => ({ isOpen:false, openTwin, closeTwin, refreshTwin, brain, brainLoading, brainError, policy, policyLoading, policyError }), [brain,brainError,brainLoading,closeTwin,openTwin,policy,policyError,policyLoading,refreshTwin])
  const blocked = policy?.enabled === false

  return <TwinWorkspaceContext.Provider value={value}>
    {children}
    <button onClick={openTwin} disabled={blocked || policyLoading} aria-label={blocked?"VibeTwin is currently unavailable by VibeSchool policy":"Open VibeTwin learning workspace"} title={blocked?"Twin is temporarily disabled by VibeSchool policy":policyError?"Twin policy is temporarily unavailable":"Open VibeTwin"} style={{position:"fixed",right:16,bottom:"calc(78px + env(safe-area-inset-bottom))",zIndex:10010,width:54,height:54,borderRadius:18,border:blocked?"2px solid var(--vs-error)":brainError?"2px solid var(--vs-warning)":"1px solid rgba(255,255,255,.18)",background:blocked?"#374151":"var(--vs-accent)",color:"white",boxShadow:"0 12px 28px rgba(91,78,232,.34)",fontSize:22,fontWeight:900,cursor:blocked?"not-allowed":"pointer",display:"grid",placeItems:"center",opacity:policyLoading?.7:1}}>✦</button>
  </TwinWorkspaceContext.Provider>
}
