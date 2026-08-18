"use client"
import { useEffect } from "react"
import { PortalError } from "@/components/shared/PortalState"
export default function Error({error,reset}:{error:Error&{digest?:string};reset:()=>void}){ useEffect(()=>{console.error("Admin workspace render failure",error)},[error]); return <PortalError role="School Admin" error={error} reset={reset} homeHref="/admin" signInHref="/?role=admin"/> }
