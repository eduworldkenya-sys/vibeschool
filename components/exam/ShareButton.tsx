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
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full h-14 bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold rounded-xl text-base tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 no-underline active:scale-[0.99]"
    >
      Share Score on WhatsApp
    </a>
  )
}
