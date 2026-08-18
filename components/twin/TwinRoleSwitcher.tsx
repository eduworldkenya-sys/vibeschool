"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getTwinAuthorityContext, getTwinRoleBindings, listTwinRoles, type TwinRole } from "@/lib/twin/core"

const ROLE_ROUTE: Record<TwinRole, string> = {
  student: "/student",
  teacher: "/teacher/pulse",
  parent: "/parent",
  admin: "/admin",
  hq: "/hq",
}

const ROLE_LABEL: Record<TwinRole, string> = {
  student: "Student",
  teacher: "Teacher",
  parent: "Parent",
  admin: "School Admin",
  hq: "HQ",
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

type ScopeOption = { id: string; name: string }

export default function TwinRoleSwitcher({
  currentRole,
  variant = "dark",
}: {
  currentRole: TwinRole
  variant?: "dark" | "light"
}) {
  const [roles, setRoles] = useState<TwinRole[]>([])
  const [teacherScopes, setTeacherScopes] = useState<ScopeOption[]>([])
  const [teacherScopeId, setTeacherScopeId] = useState("")
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getTwinAuthorityContext()
      .then(async context => {
        if (cancelled) return
        setRoles(listTwinRoles(context))

        if (currentRole !== "teacher") return
        const ids = Array.from(new Set(
          getTwinRoleBindings(context, "teacher")
            .map(binding => binding.schoolId)
            .filter((id): id is string => Boolean(id)),
        ))
        if (ids.length === 0) return

        const [schoolsRes, teacherProfileRes] = await Promise.all([
          supabase.from("schools").select("id, name").in("id", ids),
          supabase.from("teacher_profiles").select("school_id").eq("profile_id", context.userId).maybeSingle(),
        ])
        if (cancelled) return

        const names = new Map((schoolsRes.data ?? []).map(row => [row.id, row.name ?? "School"]))
        setTeacherScopes(ids.map(id => ({ id, name: names.get(id) ?? "School" })))

        const preferred = teacherProfileRes.data?.school_id ?? ""
        if (ids.includes(preferred)) setTeacherScopeId(preferred)
        else if (ids.length === 1) setTeacherScopeId(ids[0])
      })
      .catch(() => {
        if (!cancelled) {
          setRoles([])
          setTeacherScopes([])
          setTeacherScopeId("")
        }
      })
    return () => { cancelled = true }
  }, [currentRole])

  const hasRoleChoice = roles.length > 1 && roles.includes(currentRole)
  const hasTeacherScopeChoice = currentRole === "teacher" && teacherScopes.length > 1
  if (!hasRoleChoice && !hasTeacherScopeChoice) return null

  function switchRole(nextRole: TwinRole) {
    if (nextRole === currentRole) return
    window.speechSynthesis?.cancel()
    // Role switching remains navigation, never browser-side authorization.
    // Destination loaders derive authority again from server/RLS-backed relationships
    // and remount all role-local Twin state.
    window.location.assign(ROLE_ROUTE[nextRole])
  }

  async function switchTeacherScope(nextScopeId: string) {
    if (!nextScopeId || nextScopeId === teacherScopeId || switching) return
    setSwitching(true)
    try {
      const { error } = await rpc("teacher_set_active_twin_school", { p_school_id: nextScopeId })
      if (error) throw new Error(error.message || "Teacher school scope could not be changed.")
      window.speechSynthesis?.cancel()
      // Full navigation deliberately discards the previous school's Twin context.
      window.location.assign(`/teacher/pulse?twin_scope=${encodeURIComponent(nextScopeId)}`)
    } finally {
      setSwitching(false)
    }
  }

  const dark = variant === "dark"
  const wrapperStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 5,
    padding: "3px 7px", borderRadius: 9,
    border: dark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #d1d5db",
    background: dark ? "rgba(255,255,255,0.08)" : "#fff",
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 800,
    color: dark ? "rgba(255,255,255,0.5)" : "#6b7280",
    textTransform: "uppercase", letterSpacing: .4,
  }
  const selectStyle: React.CSSProperties = {
    border: "none", outline: "none", background: "transparent",
    color: dark ? "#fff" : "#111827", fontSize: 11, fontWeight: 800,
    fontFamily: "inherit", cursor: switching ? "wait" : "pointer", maxWidth: 118,
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {hasRoleChoice && (
        <label style={wrapperStyle}>
          <span style={labelStyle}>Mode</span>
          <select
            aria-label="Switch VibeSchool role"
            value={currentRole}
            onChange={event => switchRole(event.target.value as TwinRole)}
            style={selectStyle}
          >
            {roles.map(role => <option key={role} value={role} style={{ color: "#111827" }}>{ROLE_LABEL[role]}</option>)}
          </select>
        </label>
      )}

      {hasTeacherScopeChoice && (
        <label style={wrapperStyle}>
          <span style={labelStyle}>School</span>
          <select
            aria-label="Switch Teacher school scope"
            value={teacherScopeId}
            disabled={switching}
            onChange={event => void switchTeacherScope(event.target.value)}
            style={selectStyle}
          >
            {!teacherScopeId && <option value="">Choose school</option>}
            {teacherScopes.map(scope => <option key={scope.id} value={scope.id} style={{ color: "#111827" }}>{scope.name}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}
