"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { HQPage, HQPanel } from "@/components/hq/HQShell"
import { supabase } from "@/lib/supabase"

type GeoItem = { id:string; name:string; country_id?:string; county_id?:string; subcounty_id?:string; verification_state?:string }
type Hierarchy = { countries:GeoItem[]; counties:GeoItem[]; subcounties:GeoItem[]; wards:GeoItem[] }
type Summary = {
  scope: Record<string, unknown>
  schools: { total:number; verified_geography:number; unresolved_geography:number; conflicting_geography:number; mapped_coordinates:number }
  users: { school_memberships:number; teachers:number; school_admins:number; learners:number; parents:number }
  activity: { events:number; active_schools:number; evidence:string }
  support: { open_cases:number; incidents:number }
  freshness: { generated_at:string; activity_window_days:number }
}
type Quality = { total_schools:number; without_mapping:number; without_county:number; without_subcounty:number; without_ward:number; without_coordinates:number; conflicting:number; unresolved:number; legacy_text_county_only:number; generated_at:string }
type Breakdown = { id:string; name:string; school_count:number; verified_school_count:number; active_school_count:number }

const emptySummary: Summary = {
  scope:{}, schools:{total:0,verified_geography:0,unresolved_geography:0,conflicting_geography:0,mapped_coordinates:0},
  users:{school_memberships:0,teachers:0,school_admins:0,learners:0,parents:0}, activity:{events:0,active_schools:0,evidence:"insufficient_evidence"},
  support:{open_cases:0,incidents:0}, freshness:{generated_at:"",activity_window_days:30},
}

function Metric({label,value,note}:{label:string;value:number|string;note?:string}) {
  return <div className="geo-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>
}

function Field({label,value,onChange,items,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;items:GeoItem[];disabled?:boolean}) {
  return <label className="geo-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}><option value="">All / national</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
}

export default function HQGeographyPage(){
  const [hierarchy,setHierarchy]=useState<Hierarchy>({countries:[],counties:[],subcounties:[],wards:[]})
  const [summary,setSummary]=useState<Summary>(emptySummary)
  const [quality,setQuality]=useState<Quality|null>(null)
  const [breakdown,setBreakdown]=useState<Breakdown[]>([])
  const [country,setCountry]=useState("")
  const [county,setCounty]=useState("")
  const [subcounty,setSubcounty]=useState("")
  const [ward,setWard]=useState("")
  const [days,setDays]=useState("30")
  const [error,setError]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)

  const counties=useMemo(()=>hierarchy.counties.filter(x=>!country||x.country_id===country),[hierarchy.counties,country])
  const subcounties=useMemo(()=>hierarchy.subcounties.filter(x=>!county||x.county_id===county),[hierarchy.subcounties,county])
  const wards=useMemo(()=>hierarchy.wards.filter(x=>!subcounty||x.subcounty_id===subcounty),[hierarchy.wards,subcounty])

  const load=useCallback(async()=>{
    setLoading(true); setError(null)
    const [{data:h,error:he},{data:q,error:qe},{data:s,error:se}]=await Promise.all([
      supabase.rpc("hq_geography_hierarchy"),
      supabase.rpc("hq_geographic_data_quality"),
      supabase.rpc("hq_geography_summary",{p_country_id:country||null,p_county_id:county||null,p_subcounty_id:subcounty||null,p_ward_id:ward||null,p_school_id:null,p_days:Number(days)}),
    ])
    if(he||qe||se){setError("Geographic intelligence is unavailable. No fallback data is being shown.");setLoading(false);return}
    setHierarchy((h??{countries:[],counties:[],subcounties:[],wards:[]}) as Hierarchy)
    setQuality(q as Quality)
    setSummary((s??emptySummary) as Summary)

    const parentType=ward?null:subcounty?"subcounty":county?"county":"country"
    const parentId=subcounty||county||country||null
    if(parentType){
      const {data:b,error:be}=await supabase.rpc("hq_geography_region_breakdown",{p_parent_type:parentType,p_parent_id:parentId,p_days:Number(days)})
      if(!be) setBreakdown((b??[]) as Breakdown[])
    } else setBreakdown([])
    setLoading(false)
  },[country,county,subcounty,ward,days])

  useEffect(()=>{void load()},[load])

  const resetCounty=(v:string)=>{setCountry(v);setCounty("");setSubcounty("");setWard("")}
  const resetSubcounty=(v:string)=>{setCounty(v);setSubcounty("");setWard("")}
  const resetWard=(v:string)=>{setSubcounty(v);setWard("")}

  const geoCoverage=summary.schools.total?Math.round((summary.schools.verified_geography/summary.schools.total)*100):null
  const mapCoverage=summary.schools.total?Math.round((summary.schools.mapped_coordinates/summary.schools.total)*100):null

  return <HQPage title="Geography" description="National geographic, school and operational intelligence. Unknown evidence remains unknown.">
    <div className="geo-stack">
      <HQPanel title="Scope" description="Cascading administrative filters preserve valid hierarchy.">
        <div className="geo-filters">
          <Field label="Country" value={country} onChange={resetCounty} items={hierarchy.countries}/>
          <Field label="County" value={county} onChange={resetSubcounty} items={counties} disabled={!country&&hierarchy.countries.length>0}/>
          <Field label="Sub-County" value={subcounty} onChange={resetWard} items={subcounties} disabled={!county}/>
          <Field label="Ward" value={ward} onChange={setWard} items={wards} disabled={!subcounty}/>
          <label className="geo-field"><span>Activity window</span><select value={days} onChange={e=>setDays(e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
        </div>
      </HQPanel>

      {error&&<div role="alert" className="geo-alert">{error}</div>}
      {loading?<div className="geo-loading">Loading owner-authorized evidence…</div>:<>
        <section className="geo-metrics" aria-label="Geographic summary metrics">
          <Metric label="Canonical schools" value={summary.schools.total}/>
          <Metric label="Verified geography" value={summary.schools.verified_geography} note={geoCoverage===null?"Coverage unavailable":`${geoCoverage}% of scoped schools`}/>
          <Metric label="Unresolved geography" value={summary.schools.unresolved_geography}/>
          <Metric label="Mapped schools" value={summary.schools.mapped_coordinates} note={mapCoverage===null?"Coverage unavailable":`${mapCoverage}% of scoped schools`}/>
          <Metric label="Teachers" value={summary.users.teachers}/>
          <Metric label="Learners" value={summary.users.learners}/>
          <Metric label="Parents" value={summary.users.parents}/>
          <Metric label="School admins" value={summary.users.school_admins}/>
          <Metric label="Active schools" value={summary.activity.evidence==="available"?summary.activity.active_schools:"Unknown"} note={`Evidence: ${summary.activity.evidence.replaceAll("_"," ")}`}/>
          <Metric label="Open support cases" value={summary.support.open_cases}/>
        </section>

        <div className="geo-grid">
          <HQPanel title="Regional breakdown" description="Counts reconcile to canonical school-geography mappings; unknown geography is not forced into a region.">
            {breakdown.length===0?<div className="geo-empty">No verified administrative breakdown is available at this scope.</div>:<div className="geo-table-wrap"><table className="geo-table"><thead><tr><th>Region</th><th>Schools</th><th>Verified</th><th>Active</th></tr></thead><tbody>{breakdown.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.school_count}</td><td>{row.verified_school_count}</td><td>{row.active_school_count}</td></tr>)}</tbody></table></div>}
          </HQPanel>

          <HQPanel title="Data quality" description="Coverage gaps are operational evidence, not hidden zeros.">
            {quality?<div className="geo-quality"><Metric label="Without governed mapping" value={quality.without_mapping}/><Metric label="Without county" value={quality.without_county}/><Metric label="Without sub-county" value={quality.without_subcounty}/><Metric label="Without ward" value={quality.without_ward}/><Metric label="Without coordinates" value={quality.without_coordinates}/><Metric label="Conflicting" value={quality.conflicting}/></div>:<div className="geo-empty">Quality evidence unavailable.</div>}
          </HQPanel>
        </div>

        <HQPanel title="Kenya heat map & school locator" description="Map rendering remains intentionally unavailable until governed geographic coverage and coordinates exist. The sortable regional breakdown above is the accessible canonical alternative.">
          <div className="geo-map-hold"><strong>Map evidence not ready</strong><p>Heat-map precision would be misleading while geographic coverage is incomplete. This surface will activate only from governed county mappings; school locator points require eligible stored coordinates.</p></div>
        </HQPanel>
      </>}
    </div>
    <style jsx global>{`
      .geo-stack{display:grid;gap:14px}.geo-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:14px}.geo-field{display:grid;gap:6px}.geo-field span{font-size:11px;font-weight:850;color:#8fa2ba;text-transform:uppercase;letter-spacing:.04em}.geo-field select{min-height:44px;border-radius:10px;border:1px solid rgba(148,163,184,.18);background:#091727;color:#f8fafc;padding:0 10px}.geo-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.geo-metric{min-width:0;border:1px solid rgba(148,163,184,.13);border-radius:13px;background:#0b1728;padding:14px}.geo-metric span{display:block;color:#8fa2ba;font-size:11px;font-weight:800}.geo-metric strong{display:block;margin-top:5px;font-size:22px}.geo-metric small{display:block;margin-top:5px;color:#8fa2ba;font-size:10px;line-height:1.35}.geo-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}.geo-table-wrap{overflow:auto}.geo-table{width:100%;border-collapse:collapse;font-size:12px}.geo-table th,.geo-table td{padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.1);text-align:left}.geo-table th{color:#8fa2ba;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.geo-quality{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px}.geo-empty,.geo-loading{padding:24px;color:#8fa2ba;font-size:13px}.geo-alert{border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);color:#fde68a;padding:12px 14px;border-radius:12px}.geo-map-hold{padding:22px}.geo-map-hold strong{display:block;font-size:15px}.geo-map-hold p{margin:7px 0 0;color:#8fa2ba;line-height:1.55;font-size:12px}
      @media(max-width:1100px){.geo-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.geo-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:720px){.geo-filters{grid-template-columns:1fr 1fr}.geo-metrics{grid-template-columns:1fr 1fr}.geo-grid{grid-template-columns:1fr}.geo-quality{grid-template-columns:1fr 1fr}.geo-table th,.geo-table td{padding:11px 10px}}
      @media(max-width:390px){.geo-filters{grid-template-columns:1fr}.geo-metrics{grid-template-columns:1fr 1fr}.geo-metric strong{font-size:19px}}
    `}</style>
  </HQPage>
}
