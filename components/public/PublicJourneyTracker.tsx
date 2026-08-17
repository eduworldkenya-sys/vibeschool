'use client'

import { useEffect } from 'react'
import { trackPublicEvent, type PublicEventName } from '@/lib/publicTelemetry'

const eventForHref = (href:string):PublicEventName|null => {
  const path = href.split('?')[0].split('#')[0]
  if (path === '/pathways/check') return 'public_pathways_start_check'
  if (path === '/pathways/schools') return 'public_pathways_school_discovery'
  if (path === '/learn/careers') return 'public_pathways_careers'
  if (path === '/global') return 'public_home_start_learning'
  if (path.startsWith('/login')) return 'public_auth_signin'
  return null
}

export function PublicJourneyTracker(){
  useEffect(()=>{
    const click=(event:MouseEvent)=>{
      const target=event.target instanceof Element ? event.target.closest('a') : null
      if (!target || target.getAttribute('data-vs-tracked')==='true') return
      const href=target.getAttribute('href')
      if (!href || !href.startsWith('/')) return
      const mapped=eventForHref(href)
      if (mapped) trackPublicEvent(mapped)
    }
    document.addEventListener('click',click,{capture:true})
    return()=>document.removeEventListener('click',click,{capture:true})
  },[])
  return null
}
