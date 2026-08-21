"use client"

import { useEffect, useState } from "react"
import { HQPage, HQPanel, HQ_THEME as C } from "@/components/hq/HQShell"
import { hqSupabase } from "@/lib/hq/supabase"

type BillingOverview = {
  summary: {
    active: number
    trialing: number
    past_due: number
    cancelled: number
    revenue_30d: number
  }
  subscriptions: Array<{
    id: string
    profile_id: string
    full_name: string | null
    plan_key: string
    status: string
    currency: string
    amount: number
    billing_interval: string
    current_period_end: string | null
  }>
}

export default function HQBilling() {
  const [data, setData] = useState<BillingOverview | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      const { data: overview, error: overviewError } = await hqSupabase.rpc(
        "hq_billing_overview",
        { p_limit: 200 },
      )

      if (overviewError) {
        setError(overviewError.message)
        return
      }

      setData(overview as BillingOverview)
    })()
  }, [])

  const metrics: Array<[string, string | number]> = [
    ["Active", data?.summary.active ?? "—"],
    ["Trialing", data?.summary.trialing ?? "—"],
    ["Past due", data?.summary.past_due ?? "—"],
    ["Cancelled", data?.summary.cancelled ?? "—"],
    ["30d total", data ? `${data.summary.revenue_30d} KES` : "—"],
  ]

  return (
    <HQPage
      title="Billing status"
      description="Owner-only view of plan state, account billing status and aggregate revenue signals."
    >
      {error ? (
        <div
          role="alert"
          style={{
            color: C.red,
            border: `1px solid ${C.red}`,
            borderRadius: 10,
            marginBottom: 12,
            padding: 14,
          }}
        >
          <strong>Billing data unavailable.</strong>
          <div style={{ marginTop: 4, fontSize: 12 }}>{error}</div>
        </div>
      ) : null}

      <section
        aria-label="Billing summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {metrics.map(([label, value]) => (
          <HQPanel key={label} title={label}>
            <div style={{ padding: 14, fontSize: 24, fontWeight: 900 }}>{value}</div>
          </HQPanel>
        ))}
      </section>

      <HQPanel title="Account billing status">
        {error ? (
          <div style={{ padding: 14, color: C.muted }}>
            Account billing records could not be loaded. Refresh after the service recovers.
          </div>
        ) : data === null ? (
          <div aria-live="polite" style={{ padding: 14, color: C.muted }}>
            Loading account billing records…
          </div>
        ) : data.subscriptions.length > 0 ? (
          data.subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              style={{
                padding: "12px 14px",
                borderTop: `1px solid ${C.border}`,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
                gap: 10,
                fontSize: 12,
              }}
            >
              <div>
                <b>{subscription.full_name || subscription.profile_id}</b>
                <div style={{ color: C.muted, fontSize: 10 }}>{subscription.plan_key}</div>
              </div>
              <div style={{ color: subscription.status === "active" ? C.green : C.amber }}>
                {subscription.status}
              </div>
              <div>
                {subscription.amount} {subscription.currency}/{subscription.billing_interval}
              </div>
              <div>
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : "—"}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 14, color: C.muted }}>No account billing records.</div>
        )}
      </HQPanel>
    </HQPage>
  )
}
