"use client"

import { useEffect, useState } from "react"
import { acknowledgeCompanyPolicy, evaluateCompanyPolicy, type PolicyEvaluation } from "@/lib/company/config"

type Props = {
  productKey: string
  policyKey: string
  children: React.ReactNode
  label?: string
}

type GateState = "checking" | "allowed" | "denied"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Enforces an HQ-governed product policy with the registry-defined failure mode. */
export default function ProductAuthorityGate({ productKey, policyKey, children, label = "This VibeSchool service" }: Props) {
  const [state, setState] = useState<GateState>("checking")
  const [reason, setReason] = useState("")

  useEffect(() => {
    let live = true
    const cacheKey = `vs_policy_${productKey}_${policyKey}`

    async function check() {
      try {
        const result = await evaluateCompanyPolicy<boolean>(productKey, policyKey, { surface: "product_gate" })
        if (!live) return
        localStorage.setItem(cacheKey, JSON.stringify({ value: result.value, failureMode: result.failureMode, at: Date.now() }))
        setState(result.value ? "allowed" : "denied")
        setReason(result.value ? "" : "Disabled by company policy")
        void acknowledgeCompanyPolicy(productKey, policyKey, result.value, "enforced").catch(() => undefined)
      } catch (error) {
        if (!live) return
        let cached: { value?: boolean; failureMode?: PolicyEvaluation<boolean>["failureMode"]; at?: number } | null = null
        try { cached = JSON.parse(localStorage.getItem(cacheKey) || "null") } catch { cached = null }
        const fresh = Boolean(cached?.at && Date.now() - cached.at <= CACHE_TTL_MS)
        if (cached?.failureMode === "fail_open") {
          setState("allowed")
          return
        }
        if (cached?.failureMode === "last_known_good" && fresh && typeof cached.value === "boolean") {
          setState(cached.value ? "allowed" : "denied")
          setReason("Using last verified company policy")
          return
        }
        setState("denied")
        setReason(error instanceof Error ? error.message : "Company policy could not be verified")
      }
    }

    void check()
    return () => { live = false }
  }, [policyKey, productKey])

  if (state === "checking") return <div style={{ minHeight: "100dvh", background: "#0F0F1A" }} />
  if (state === "allowed") return <>{children}</>

  return <div style={{ minHeight: "100dvh", background: "#0F0F1A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <div style={{ width: "100%", maxWidth: 440, background: "#1A1A2E", border: "1px solid #2D2D4E", borderRadius: 18, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: "#9090B0", textTransform: "uppercase" }}>VibeSchool HQ</div>
      <h1 style={{ margin: "12px 0 8px", fontSize: 22 }}>{label} is temporarily unavailable</h1>
      <p style={{ margin: 0, color: "#B8B7CE", fontSize: 14, lineHeight: 1.6 }}>{reason || "Access is currently disabled by company policy."}</p>
    </div>
  </div>
}
