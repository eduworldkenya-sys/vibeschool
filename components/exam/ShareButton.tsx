"use client"

interface ShareButtonProps {
  score:   number
  total:   number
  subject: string
  topic:   string
}

export default function ShareButton({ score, total, subject, topic }: ShareButtonProps) {
  const message = `I scored ${score}/${total} on KCSE ${subject} (${topic}) on VibeExam! Try it free at vibeschool.co.ke/exam 🎯`
  const waUrl   = `https://wa.me/?text=${encodeURIComponent(message)}`
  return (
    <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ width: "100%", height: 56, background: "#25D366", color: "#fff", fontWeight: 800, borderRadius: 12, fontSize: 15, letterSpacing: "0.03em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}>
      Share Score on WhatsApp
    </a>
  )
}
