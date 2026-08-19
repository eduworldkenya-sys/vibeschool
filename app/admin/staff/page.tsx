"use client"
export const dynamic = "force-dynamic"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminStaffCompatibilityPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/teachers")
  }, [router])

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Opening teacher management…</h1>
      <p style={{ color: "#64748b", lineHeight: 1.5 }}>
        School teaching staff are managed through canonical school membership and class/subject assignments.
      </p>
    </main>
  )
}
