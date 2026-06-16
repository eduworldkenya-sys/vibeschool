"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ExamResultsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/exam/session") }, [router])
  return (
    <div style={{ minHeight: "100vh", background: "#05050F" }} />
  )
}
