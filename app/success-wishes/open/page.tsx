'use client'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import ReceiverAccount from '@/components/success-wishes/ReceiverAccount'
export default function OpenWishes(){
 const router=useRouter(),[checking,setChecking]=useState(true)
 useEffect(()=>{const controller=new AbortController();void fetch('/api/success-wishes/receiver/account',{cache:'no-store',signal:controller.signal}).then(response=>{if(response.ok){router.replace('/success-wishes/inbox')}else{setChecking(false)}}).catch(()=>{if(!controller.signal.aborted)setChecking(false)});return()=>controller.abort()},[router])
 return <main style={{padding:'24px 16px 32px'}}>{checking?<p role="status">Opening your wishes…</p>:<ReceiverAccount/>}</main>
}
