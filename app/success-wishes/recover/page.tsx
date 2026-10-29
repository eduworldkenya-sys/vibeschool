'use client'
import {useEffect,useState} from 'react'
import ReceiverAccount from '@/components/success-wishes/ReceiverAccount'
import LegacyReceiverRecovery from '@/components/success-wishes/LegacyReceiverRecovery'
import LostRecoveryLink from '@/components/success-wishes/LostRecoveryLink'
export default function RecoverWishes(){const [legacy,setLegacy]=useState(false);useEffect(()=>setLegacy(new URLSearchParams(location.search).get('legacy')==='1'),[]);return <main style={{padding:'24px 16px 100px'}}>{legacy?<LegacyReceiverRecovery/>:<><ReceiverAccount initialMode="recover"/><LostRecoveryLink/></>}</main>}
