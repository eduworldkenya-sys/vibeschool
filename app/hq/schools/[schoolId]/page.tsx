"use client"

export const dynamic="force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPage, HQPanel, HQ_THEME as C } from "@/components/hq/HQShell"

type School360={
 identity:{id:string;name:string;status:string;knec_code:string|null;nemis_code:string|null;moe_registration_no:string|null;tsc_code:string|null;school_type:string|null;school_category:string|null;ownership_type:string|null;accommodation_type:string|null;gender_type:string|null;directory_source:string|null;directory_source_ref:string|null;last_verified_at:string|null};
 location:{country_code:string;county:string|null;sub_county:string|null;ward:string|null;latitude:number|null;longitude:number|null;precision:string|null;postal_address:string|null};
 population:{reported_students:number|null;reported_staff:number|null;linked_learners:number;linked_teachers:number;linked_admins:number;linked_parents:number;linked_profiles:number;penetration_claimable:boolean};
 activity:{window_days:number;events:number;active_users:number;last_activity:string|null};
 revenue:{currency:string;school_attributed_orders:{paid_orders:number;paid_kes:number;last_paid_at:string|null};linked_user_orders:{paid_orders:number;paid_kes:number;last_paid_at:string|null};combined_unique_attribution:{paid_orders:number;paid_kes:number;last_paid_at:string|null};institution_paid_claimable:boolean;note:string};
 entitlements:{total:number;active:number};operations:{open_support_cases:number};provenance:Record<string,string>;generated_at:string
}

function Value({label,value,note}:{label:string;value:string|number;note?:string}){return <div className="s360-value"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
function Row({label,value}:{label:string;value:string|number|null|undefined}){return <div className="s360-row"><span>{label}</span><strong>{value===null||value===undefined||value===""?"Unknown":String(value)}</strong></div>}
const money=(n:number)=>`KES ${Number(n||0).toLocaleString()}`

export default function HQSchool360Page(){
 const params=useParams<{schoolId:string}>(); const schoolId=params.schoolId
 const [days,setDays]=useState(30);const [data,setData]=useState<School360|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null)
 const load=useCallback(async()=>{setLoading(true);setError(null);const {data:d,error:e}=await hqSupabase.rpc("hq_school_network_school_360",{p_school_id:schoolId,p_days:days});if(e){setData(null);setError("School 360 is not commissioned for this environment or this school is unavailable.")}else setData(d as School360);setLoading(false)},[schoolId,days])
 useEffect(()=>{void load()},[load])
 const title=data?.identity.name||"School 360"
 return <HQPage title={title} description="Canonical institution profile: identity, location, linked people, activity, revenue attribution and operating evidence.">
  <div className="s360-stack">
   <div className="s360-top"><Link href="/hq/schools">← Schools</Link><div className="s360-period">{[7,30,90].map(d=><button key={d} className={days===d?"active":""} onClick={()=>setDays(d)}>{d}D</button>)}</div></div>
   {error&&<div className="s360-notice" role="status"><div><strong>School profile unavailable</strong><span>{error}</span></div><button onClick={()=>void load()}>Retry</button></div>}
   {loading?<div className="s360-loading">Loading School 360…</div>:data?<>
    <section className="s360-hero">
      <div><span className="s360-kicker">SCHOOL 360</span><h2>{data.identity.name}</h2><p>{[data.location.ward,data.location.sub_county,data.location.county,"Kenya"].filter(Boolean).join(" · ")}</p></div>
      <div className="s360-badges"><span>{data.identity.status}</span><span>{data.identity.last_verified_at?"Verified evidence":"Verification date unavailable"}</span></div>
    </section>

    <section className="s360-metrics">
      <Value label="Linked learners" value={data.population.linked_learners} note="Canonical current student-class relationships"/>
      <Value label="Linked teachers" value={data.population.linked_teachers} note="Teacher class / membership relationships"/>
      <Value label="Parents" value={data.population.linked_parents} note="Distinct linked parents"/>
      <Value label="Active users" value={data.activity.active_users} note={`${days} day school-scoped activity`}/>
      <Value label="Attributed revenue" value={money(data.revenue.combined_unique_attribution.paid_kes)} note="Unique paid order attribution"/>
      <Value label="Open support" value={data.operations.open_support_cases} note="Unresolved HQ support cases"/>
    </section>

    <div className="s360-grid">
      <HQPanel title="People & adoption" description="Institution population remains unknown unless an authoritative denominator exists.">
        <div className="s360-funnels">
          <div><span>Learners</span><strong>{data.population.reported_students??"Unknown"}</strong><small>reported population</small><b>→</b><strong>{data.population.linked_learners}</strong><small>linked to VibeSchool</small></div>
          <div><span>Staff</span><strong>{data.population.reported_staff??"Unknown"}</strong><small>reported population</small><b>→</b><strong>{data.population.linked_teachers}</strong><small>linked teachers</small></div>
        </div>
        {!data.population.penetration_claimable&&<div className="s360-evidence">Penetration is not calculated because a verified institution population denominator is unavailable.</div>}
      </HQPanel>
      <HQPanel title="Activity" description={`Observed school-scoped product evidence during the last ${days} days.`}>
        <div className="s360-activity"><Value label="Events" value={data.activity.events}/><Value label="Active users" value={data.activity.active_users}/><Value label="Last activity" value={data.activity.last_activity?new Date(data.activity.last_activity).toLocaleString():"Unknown"}/></div>
      </HQPanel>
    </div>

    <HQPanel title="Commercial relationship" description="Revenue is settlement/order evidence. Institutional payment is not claimed without payer evidence.">
      <div className="s360-revenue">
        <Value label="School-attributed" value={money(data.revenue.school_attributed_orders.paid_kes)} note={`${data.revenue.school_attributed_orders.paid_orders} paid orders`}/>
        <Value label="Linked-user revenue" value={money(data.revenue.linked_user_orders.paid_kes)} note={`${data.revenue.linked_user_orders.paid_orders} paid orders`}/>
        <Value label="Combined unique" value={money(data.revenue.combined_unique_attribution.paid_kes)} note={`${data.revenue.combined_unique_attribution.paid_orders} unique paid orders`}/>
        <Value label="Active entitlements" value={data.entitlements.active} note={`${data.entitlements.total} total entitlements`}/>
      </div>
      <div className="s360-evidence">{data.revenue.note}</div>
    </HQPanel>

    <div className="s360-grid">
      <HQPanel title="Identity" description="Canonical institution identity and provenance.">
       <div className="s360-rows"><Row label="KNEC" value={data.identity.knec_code}/><Row label="NEMIS" value={data.identity.nemis_code}/><Row label="MoE registration" value={data.identity.moe_registration_no}/><Row label="TSC code" value={data.identity.tsc_code}/><Row label="School type" value={data.identity.school_type}/><Row label="Category" value={data.identity.school_category}/><Row label="Ownership" value={data.identity.ownership_type}/><Row label="Accommodation" value={data.identity.accommodation_type}/><Row label="Gender" value={data.identity.gender_type}/><Row label="Source" value={data.identity.directory_source}/><Row label="Last verified" value={data.identity.last_verified_at?new Date(data.identity.last_verified_at).toLocaleString():null}/></div>
      </HQPanel>
      <HQPanel title="Location" description="Map rendering is withheld when governed coordinates are unavailable.">
       <div className="s360-rows"><Row label="Country" value={data.location.country_code}/><Row label="County" value={data.location.county}/><Row label="Sub-county" value={data.location.sub_county}/><Row label="Ward" value={data.location.ward}/><Row label="Location precision" value={data.location.precision}/><Row label="Postal address" value={data.location.postal_address}/><Row label="Latitude" value={data.location.latitude}/><Row label="Longitude" value={data.location.longitude}/></div>
       {data.location.latitude!==null&&data.location.longitude!==null?<div className="s360-map-ready">Governed coordinates available · map integration can render this school safely.</div>:<div className="s360-evidence">No governed coordinates available. A locator is not fabricated.</div>}
      </HQPanel>
    </div>

    <HQPanel title="Evidence lineage" description="The profile is a read model over existing authoritative systems, not a duplicate school database."><div className="s360-provenance">{Object.entries(data.provenance).map(([k,v])=><div key={k}><span>{k.replaceAll("_"," ")}</span><strong>{v}</strong></div>)}</div></HQPanel>
   </>:null}
  </div>
  <style jsx global>{`
   .s360-stack{display:grid;gap:14px}.s360-top{display:flex;justify-content:space-between;align-items:center}.s360-top>a{color:#93c5fd;text-decoration:none;font-size:12px;font-weight:850}.s360-period{display:flex;gap:4px}.s360-period button,.s360-notice button{min-height:40px;min-width:46px;border:1px solid ${C.border};border-radius:9px;background:rgba(255,255,255,.04);color:${C.muted};font-weight:850}.s360-period button.active{background:rgba(59,130,246,.2);color:#fff}.s360-notice{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px;border:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.07);border-radius:12px}.s360-notice strong,.s360-notice span{display:block}.s360-notice strong{font-size:12px}.s360-notice span{font-size:10px;color:${C.muted};margin-top:3px}.s360-loading{padding:18px;color:${C.muted}}
   .s360-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;padding:18px;border:1px solid ${C.border};border-radius:15px;background:linear-gradient(135deg,rgba(37,99,235,.14),rgba(34,197,94,.05)),${C.panel}.s360-kicker{font-size:9px;color:#93c5fd;font-weight:900;letter-spacing:.13em}.s360-hero h2{margin:5px 0 4px;font-size:22px}.s360-hero p{margin:0;color:${C.muted};font-size:11px}.s360-badges{display:flex;gap:6px;flex-wrap:wrap}.s360-badges span{padding:6px 8px;border:1px solid ${C.border};border-radius:999px;font-size:9px;color:#cbd5e1;background:rgba(255,255,255,.035)}
   .s360-metrics,.s360-revenue{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.s360-revenue{padding:14px;grid-template-columns:repeat(4,minmax(0,1fr))}.s360-value{min-width:0;padding:12px;border:1px solid ${C.border};border-radius:11px;background:rgba(255,255,255,.018)}.s360-value span,.s360-value small{display:block}.s360-value span{font-size:9px;color:${C.muted};font-weight:850}.s360-value strong{display:block;font-size:18px;margin:6px 0 3px;overflow-wrap:anywhere}.s360-value small{font-size:8.5px;color:#71869f;line-height:1.35}
   .s360-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.s360-funnels{padding:14px;display:grid;gap:10px}.s360-funnels>div{display:grid;grid-template-columns:70px 80px 1fr 22px 80px 1fr;gap:8px;align-items:center;padding:10px;border:1px solid ${C.border};border-radius:10px}.s360-funnels span{font-size:10px;font-weight:850}.s360-funnels strong{font-size:17px}.s360-funnels small{font-size:9px;color:${C.muted}.s360-funnels b{color:#64748b}.s360-evidence,.s360-map-ready{margin:0 14px 14px;padding:10px;border-radius:9px;background:rgba(148,163,184,.055);color:${C.muted};font-size:9.5px;line-height:1.45}.s360-map-ready{background:rgba(34,197,94,.07);color:#bbf7d0}.s360-activity{padding:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
   .s360-rows{padding:8px 14px 14px}.s360-row{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(0,1.3fr);gap:12px;padding:9px 0;border-bottom:1px solid ${C.border}.s360-row span{font-size:9px;color:${C.muted}.s360-row strong{font-size:10px;text-align:right;overflow-wrap:anywhere}.s360-provenance{padding:12px 14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.s360-provenance>div{padding:9px;border:1px solid ${C.border};border-radius:9px}.s360-provenance span,.s360-provenance strong{display:block}.s360-provenance span{font-size:8px;color:${C.muted};text-transform:uppercase}.s360-provenance strong{font-size:9px;margin-top:4px}
   @media(max-width:1180px){.s360-metrics{grid-template-columns:repeat(3,1fr)}.s360-revenue{grid-template-columns:repeat(2,1fr)}}
   @media(max-width:760px){.s360-grid{grid-template-columns:1fr}.s360-metrics{grid-template-columns:repeat(2,1fr)}.s360-hero{display:block}.s360-badges{margin-top:12px}.s360-funnels>div{grid-template-columns:1fr auto;gap:4px}.s360-funnels span{grid-column:1/-1}.s360-funnels small{display:none}.s360-funnels b{display:none}.s360-activity{grid-template-columns:1fr}.s360-provenance{grid-template-columns:1fr 1fr}}
   @media(max-width:430px){.s360-revenue{grid-template-columns:1fr 1fr}.s360-value strong{font-size:16px}.s360-row{grid-template-columns:1fr}.s360-row strong{text-align:left}.s360-provenance{grid-template-columns:1fr}}
  `}</style>
 </HQPage>
}
