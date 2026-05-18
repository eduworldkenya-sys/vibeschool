"use client"
import { useRouter } from "next/navigation"
export default function ParentMessages() {
  const router = useRouter()
  return (
    <div style={{ padding: 24 }}>
      <h1>Messages</h1>
      <button onClick={() => router.push("/parent")}>← Back</button>
    </div>
  )
}
