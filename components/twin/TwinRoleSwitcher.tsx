"use client"

import { useEffect, useState } from "react"
import { getTwinAuthorityContext, listTwinRoles, type TwinRole } from "@/lib/twin/core"

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

export default function TwinRoleSwitcher({
  currentRole,
  variant = "dark",
}: {
  currentRole: TwinRole
  variant?: "dark" | "light"
}) {
  const [roles, setRoles] = useState<TwinRole[]>([])

  useEffect(() => {
    let cancelled = false
    void getTwinAuthorityContext()
      .then(context => {
        if (!cancelled) setRoles(listTwinRoles(context))
      })
      .catch(() => {
        if (!cancelled) setRoles([])
      })
    return () => { cancelled = true }
  }, [])

  if (roles.length <= 1 || !roles.includes(currentRole)) return null

  function switchRole(nextRole: TwinRole) {
    if (nextRole === currentRole) return
    // Role selection is navigation only. Destination loaders derive authority again
    // from server/RLS-backed relationships; this browser value grants nothing.
    window.speechSynthesis?.cancel()
    window.location.assign(ROLE_ROUTE[nextRole])
  }

  const dark = variant === "dark"
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "3px 7px", borderRadius: 9,
      border: dark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #d1d5db",
      background: dark ? "rgba(255,255,255,0.08)" : "#fff",
    }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: dark ? "rgba(255,255,255,0.5)" : "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>
        Mode
      </span>
      <select
        aria-label="Switch VibeSchool role"
        value={currentRole}
        onChange={event => switchRole(event.target.value as TwinRole)}
        style={{
          border: "none", outline: "none", background: "transparent",
          color: dark ? "#fff" : "#111827", fontSize: 11, fontWeight: 800,
          fontFamily: "inherit", cursor: "pointer", maxWidth: 112,
        }}
      >
        {roles.map(role => <option key={role} value={role} style={{ color: "#111827" }}>{ROLE_LABEL[role]}</option>)}
      </select>
    </label>
  )
}
