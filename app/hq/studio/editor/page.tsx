"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"
import { PublicationEditor } from "@/components/global/publish/PublicationEditor"
import type { PublicationFormat } from "@/lib/publishTypes"

export default function HQStudioEditorPage(){
 const router=useRouter();const search=useSearchParams();const[userId,setUserId]=useState<string|null>(null)
 const raw=search.get("format");const format:PublicationFormat=raw==="ebook"?"ebook":raw==="vibepress"?"vibepress":"vibetextbook";const publicationId=search.get("publication")??undefined
 useEffect(()=>{void hqSupabase.auth.getUser().then(({data})=>{if(!data.user){router.replace("/hq/login");return}setUserId(data.user.id)})},[router])
 if(!userId)return <main style={{minHeight:"100dvh",background:"#090D16",color:"rgba(255,255,255,.5)",display:"grid",placeItems:"center"}}>Loading HQ editor…</main>
 return <PublicationEditor authorId={userId} format={format} publicationId={publicationId}/>
}