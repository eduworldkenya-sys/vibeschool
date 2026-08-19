import Link from "next/link"

export default function IntelligenceLayout({children}:{children:React.ReactNode}){
 return <><div style={{position:"relative",zIndex:2,marginLeft:0}}><Link href="/hq/operations" style={{position:"fixed",right:18,top:76,zIndex:130,padding:"9px 12px",borderRadius:10,border:"1px solid rgba(59,130,246,.35)",background:"rgba(11,23,40,.96)",color:"#93c5fd",fontSize:11,fontWeight:900,textDecoration:"none",boxShadow:"0 10px 30px rgba(0,0,0,.22)"}}>Open canonical Operations →</Link></div>{children}</>
}
