'use client'

import {useEffect,useRef} from 'react'
import {getSupabaseClient} from '@/lib/supabase'

// Private per-user invalidation. Every event reloads authorized database
// state, and reconnect/focus/poll recover dropped or unsupported broadcasts.
export function useVibeChatInboxUpdates(uid:string,onRefresh:()=>void) {
  const refreshRef=useRef(onRefresh)
  refreshRef.current=onRefresh
  useEffect(()=>{
    if(!uid) return
    const db=getSupabaseClient()
    let active=true
    let timer:ReturnType<typeof setTimeout>|undefined
    const refresh=()=>{
      if(!active || timer) return
      timer=setTimeout(()=>{timer=undefined;if(active) refreshRef.current()},180)
    }
    const channel=db.channel('vibechat-inbox:'+uid,{config:{private:true}})
      .on('broadcast',{event:'refresh'},refresh)
      .subscribe(status=>{if(status==='SUBSCRIBED') refresh()})
    const visible=()=>{if(document.visibilityState==='visible') refresh()}
    window.addEventListener('focus',refresh)
    document.addEventListener('visibilitychange',visible)
    const poll=window.setInterval(visible,15000)
    return ()=>{
      active=false
      if(timer) clearTimeout(timer)
      window.clearInterval(poll)
      window.removeEventListener('focus',refresh)
      document.removeEventListener('visibilitychange',visible)
      void db.removeChannel(channel)
    }
  },[uid])
}
