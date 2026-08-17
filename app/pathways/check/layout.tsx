import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = { title:'Pathways Quick Check', description:'Use six short prompts to get an explainable early direction signal for Kenya Senior School Pathways.', alternates:{canonical:'/pathways/check'} }
export default function Layout({children}:{children:React.ReactNode}){return <><PublicHeader product="Pathways"/><div id="main-content">{children}</div><PublicFooter/></>}
