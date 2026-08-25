import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { absolute: "Kenya Education Hub | VibeSchool" },
  description: "Practical Kenyan education news, revision guidance, examination support and career pathways for learners, teachers and families.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "VibeSchool Kenya Education Hub",
    description: "Understand education and take the next useful learning step.",
    type: "website",
    url: "/blog",
  },
}

export default function BlogLayout({children}:{children:React.ReactNode}){return children}
