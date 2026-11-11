import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import PathwaysExplorer from '@/components/pathways/PathwaysExplorer'
export const metadata:Metadata={title:'Pathways Kenya | VibeSchool',description:'Choose a pathway. Explore subjects, careers and schools.',alternates:{canonical:'https://www.vibeschool.co.ke/pathways'}}
export default function PathwaysPage(){return <div style={{minHeight:'100dvh',background:'#fff',color:'#080e27'}}>
 <PublicHeader product="Pathways" compact/>
 <main id="main-content"><PathwaysExplorer/>
  <details style={{maxWidth:1120,margin:'0 auto',padding:'0 20px 20px',fontSize:12,color:'#596273'}}><summary style={{minHeight:44,padding:'12px 0',cursor:'pointer'}}>About this guidance</summary><p>Guidance, not placement.</p><p>Your interests can change. The Quick Check shows uncertainty when answers are close.</p><p>Verified education information comes from published records. Career links explain possible directions, not admission guarantees.</p></details>
 </main><PublicFooter compact/>
 </div>}
