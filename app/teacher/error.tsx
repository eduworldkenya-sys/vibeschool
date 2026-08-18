"use client"
import { useEffect } from "react"
import { PortalError } from "@/components/shared/PortalState"
export default function Error({error,reset}:{error:Error&{digest?:string};reset:()=>void}){ useEffect(()=>{console.error("Teacher workspace render failure",error)},[error]); return <PortalError role="Teacher" error={error} reset={reset} homeHref="/teacher/pulse" signInHref="/?role=teacher"/> }
