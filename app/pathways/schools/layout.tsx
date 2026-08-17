import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = { title:'Senior School Discovery', description:'Search canonical Kenyan schools and see pathway-offering evidence only where VibeSchool has verified support for the claim.', alternates:{canonical:'/pathways/schools'} }
export default function Layout({children}:{children:React.ReactNode}){return <><PublicHeader product="Pathways"/><div id="main-content">{children}</div><PublicFooter/></>}
