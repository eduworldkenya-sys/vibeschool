import Link from "next/link"

export default function OperationsLayout({children}:{children:React.ReactNode}){
 return <><Link href="/hq/operations/emergency-stop" style={{position:"fixed",right:16,bottom:88,zIndex:140,padding:"10px 13px",borderRadius:12,border:"1px solid rgba(239,68,68,.45)",background:"rgba(69,10,10,.96)",color:"#fecaca",fontSize:11,fontWeight:950,textDecoration:"none",boxShadow:"0 10px 30px rgba(0,0,0,.28)"}}>Global Stop</Link>{children}</>
}
