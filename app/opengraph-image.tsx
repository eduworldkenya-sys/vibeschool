import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'VibeSchool — connected education for Kenya'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#07111f',color:'#fff',padding:'72px',fontFamily:'Arial, sans-serif'}}>
      <div style={{display:'flex',alignItems:'center',gap:18,fontSize:28,fontWeight:800}}><span style={{display:'inline-flex',width:42,height:42,borderRadius:12,background:'#d0b154'}}/>VibeSchool</div>
      <div style={{display:'flex',flexDirection:'column',gap:20,maxWidth:980}}><div style={{fontSize:66,fontWeight:800,lineHeight:1.03,letterSpacing:'-2px'}}>Learning, teaching and future direction — connected.</div><div style={{fontSize:28,color:'#c8d0da'}}>Built around the Kenyan education journey.</div></div>
      <div style={{display:'flex',gap:24,fontSize:22,color:'#d0b154'}}>Learn <span>→</span> Evidence <span>→</span> Pathways <span>→</span> Next step</div>
    </div>,
    size,
  )
}