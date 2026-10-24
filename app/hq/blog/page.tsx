import { redirect } from "next/navigation"

// Keep one canonical VibePress editor; HQ exposes the discoverable owner entry.
export default function HQBlogEditorPage() {
  redirect("/global/create/press")
}
