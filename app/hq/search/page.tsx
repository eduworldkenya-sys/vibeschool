"use client"
import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { HQPage, HQPanel, HQ_THEME as C, hqButtonStyle } from "@/components/hq/HQShell"
import { searchHQ, searchHQPages, searchHQWorkforceNames, type HQSearchResult } from "@/lib/hq/search"

function localResults(query: string): HQSearchResult[] {
  return [...searchHQWorkforceNames(query), ...searchHQPages(query)]
}

export default function HQSearchPage() {
  const params = useSearchParams()
  const router = useRouter()
  const initial = params.get("q")?.trim() ?? ""
  const [q, setQ] = useState(initial)
  const [remote, setRemote] = useState<HQSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recordError, setRecordError] = useState(false)
  const normalized = q.trim()
  const local = useMemo(() => normalized.length >= 2 ? localResults(normalized) : [], [normalized])
  const results = useMemo(() => {
    const seen = new Set<string>()
    return [...local, ...remote].filter(item => {
      const key = item.result_type + ":" + item.result_id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [local, remote])

  useEffect(() => { setQ(initial) }, [initial])
  useEffect(() => {
    if (normalized.length < 2) {
      setRemote([])
      setLoading(false)
      setRecordError(false)
      return
    }
    let active = true
    setRemote([])
    setRecordError(false)
    setLoading(true)
    const timer = window.setTimeout(() => {
      searchHQ(normalized, 80)
        .then(items => { if (active) setRemote(items) })
        .catch(() => { if (active) setRecordError(true) })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [normalized])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (normalized.length >= 2) router.replace("/hq/search?q=" + encodeURIComponent(normalized))
  }

  return <HQPage title="Search HQ" description="Search named workers, company records, schools and features as you type.">
    <form onSubmit={submit} role="search" style={{display:"flex",gap:8,marginBottom:14}}>
      <input autoComplete="off" value={q} onChange={event=>setQ(event.target.value)}
        placeholder="Search people, features and records…" aria-label="Search HQ"
        style={{flex:1,minWidth:0,minHeight:46,padding:"0 12px",border:`1px solid ${C.border}`,borderRadius:11,background:C.panelSoft,color:C.text}}/>
      <button type="submit" style={hqButtonStyle}>Search</button>
    </form>
    {recordError && <p role="status" style={{color:C.amber,fontSize:12}}>
      Database records could not be loaded. Workforce identities and navigation are still available.
    </p>}
    <HQPanel title={normalized.length >= 2 ? `Results for “${normalized}”` : "Search VibeSchool"}>
      {normalized.length < 2
        ? <div style={{padding:24,color:C.muted}}>Type at least two characters. Suggestions appear automatically.</div>
        : <>
          <div role="status" aria-live="polite" style={{padding:"8px 14px",color:C.muted,fontSize:11}}>
            {loading ? "Searching records…" : `${results.length} result${results.length===1?"":"s"}`}
          </div>
          {results.length === 0 && !loading && <div style={{padding:24,color:C.muted}}>
            {recordError ? "No matching local results; database search is unavailable." : "No matching results."}
          </div>}
          {results.map(item => <Link key={item.result_type+":"+item.result_id} href={item.route}
            style={{display:"block",padding:14,borderTop:`1px solid ${C.border}`,textDecoration:"none",color:C.text}}>
            <strong>{item.title}</strong>
            <div style={{marginTop:4,fontSize:11,color:C.muted}}>
              {item.result_type==="worker" && item.result_id.startsWith("named:") ? "HQ named workforce" : item.result_type.replaceAll("_"," ")}
              {item.subtitle ? ` · ${item.subtitle}` : ""}
            </div>
          </Link>)}
        </>}
    </HQPanel>
  </HQPage>
}
