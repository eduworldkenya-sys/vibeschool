"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { HQPage, HQPanel } from "@/components/hq/HQShell"
import { supabase } from "@/lib/supabase"

type GeoItem={id:string;name:string;country_id?:string;county_id?:string;subcounty_id?:string;verification_state?:string}
type Hierarchy={countries:GeoItem[];counties:GeoItem[];subcounties:GeoItem[];wards:GeoItem[]}
type Summary={scope:Record<string,unknown>;schools:{total:number;verified_geography:number;unresolved_geography:number;conflicting_geography:number;mapped_coordinates:number};users:{school_memberships:number;teachers:number;school_admins:number;learners:number;parents:number};activity:{events:number;active_schools:number;evidence:string};support:{open_cases:number;incidents:number};freshness:{generated_at:string;activity_window_days:number}}
type Quality={total_schools:number;without_mapping:number;without_county:number;without_subcounty:number;without_ward:number;without_coordinates:number;conflicting:number;unresolved:number;legacy_text_county_only:number;generated_at:string}
type Breakdown={id:string;name:string;school_count:number;verified_school_count:number;active_school_count:number}
type Growth={window_days:number;institution_linked_unique_people:number;new_linked_users:number;active_users:number;returning_users:number;new_schools:number;measurement:{certified_from:string|null;session_kernel_available:boolean;retention_state:string};semantics:{people:string;activity:string;residential_geography_inferred:boolean};generated_at:string}
type Opportunity={signal_type:string;school_id:string;school_name:string;county:string|null;subcounty:string|null;ward:string|null;state:string;evidence:Record<string,unknown>;recommended_investigation:string}
type SchoolRow={id:string;name:string;school_type:string|null;school_category:string|null;knec_code:string|null;nemis_code:string|null;status:string|null;geography_state:string;county:string|null;subcounty:string|null;ward:string|null;has_coordinates:boolean;learners:number;teachers:number;active_users:number;open_support_cases:number}
type School360={identity:{id:string;name:string;knec_code:string|null;nemis_code:string|null;moe_registration_no:string|null;status:string|null;school_type:string|null;school_category:string|null;directory_source:string|null;directory_source_ref:string|null;last_verified_at:string|null;aliases:Array<{alias:string;verified:boolean;source:string|null}>};geography:{country:string|null;county:string|null;subcounty:string|null;ward:string|null;latitude:number|null;longitude:number|null;location_precision:string|null;verification_state:string;source_key:string|null;source_ref:string|null;last_verified_at:string|null};community:{students:number;teachers:number;parents:number;admins:number;membership_rows:number};engagement:{window_days:number;event_count:number;active_users:number;active_teachers:number;evidence:string};operations:{open_support_cases:number;open_identity_reviews:number;open_incidents:number};privacy:{mode:string;residential_geography_inferred:boolean};freshness:{generated_at:string}}

const emptySummary:Summary={scope:{},schools:{total:0,verified_geography:0,unresolved_geography:0,conflicting_geography:0,mapped_coordinates:0},users:{school_memberships:0,teachers:0,school_admins:0,learners:0,parents:0},activity:{events:0,active_schools:0,evidence:"insufficient_evidence"},support:{open_cases:0,incidents:0},freshness:{generated_at:"",activity_window_days:30}}
const emptyGrowth:Growth={window_days:30,institution_linked_unique_people:0,new_linked_users:0,active_users:0,returning_users:0,new_schools:0,measurement:{certified_from:null,session_kernel_available:false,retention_state:"not_calculated_here"},semantics:{people:"",activity:"",residential_geography_inferred:false},generated_at:""}

function Metric({label,value,note}:{label:string;value:number|string;note?:string}){return <div className="geo-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>}
function Field({label,value,onChange,items,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;items:GeoItem[];disabled?:boolean}){return <label className="geo-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}><option value="">All / national</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
function evidenceText(value:string){return value.replaceAll("_"," ")}

export default function HQGeographyPage(){
  const [hierarchy,setHierarchy]=useState<Hierarchy>({countries:[],counties:[],subcounties:[],wards:[]})
  const [summary,setSummary]=useState<Summary>(emptySummary)
  const [quality,setQuality]=useState<Quality|null>(null)
  const [growth,setGrowth]=useState<Growth>(emptyGrowth)
  const [breakdown,setBreakdown]=useState<Breakdown[]>([])
  const [opportunities,setOpportunities]=useState<Opportunity[]>([])
  const [schools,setSchools]=useState<SchoolRow[]>([])
  const [school360,setSchool360]=useState<School360|null>(null)
  const [country,setCountry]=useState("")
  const [county,setCounty]=useState("")
  const [subcounty,setSubcounty]=useState("")
  const [ward,setWard]=useState("")
  const [days,setDays]=useState("30")
  const [schoolLevel,setSchoolLevel]=useState("")
  const [search,setSearch]=useState("")
  const [error,setError]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [schoolLoading,setSchoolLoading]=useState(false)

  const counties=useMemo(()=>hierarchy.counties.filter(x=>!country||x.country_id===country),[hierarchy.counties,country])
  const subcounties=useMemo(()=>hierarchy.subcounties.filter(x=>!county||x.county_id===county),[hierarchy.subcounties,county])
  const wards=useMemo(()=>hierarchy.wards.filter(x=>!subcounty||x.subcounty_id===subcounty),[hierarchy.wards,subcounty])
  const maxBreakdown=useMemo(()=>Math.max(1,...breakdown.map(row=>Number(row.school_count)||0)),[breakdown])

  const load=useCallback(async()=>{
    setLoading(true);setError(null);setSchool360(null)
    const scope={p_country_id:country||null,p_county_id:county||null,p_subcounty_id:subcounty||null,p_ward_id:ward||null}
    const [{data:h,error:he},{data:q,error:qe},{data:s,error:se},{data:g,error:ge},{data:o,error:oe},{data:sl,error:sle}]=await Promise.all([
      supabase.rpc("hq_geography_hierarchy"),
      supabase.rpc("hq_geographic_data_quality"),
      supabase.rpc("hq_geography_summary",{...scope,p_school_id:null,p_days:Number(days)}),
      supabase.rpc("hq_growth_intelligence",{...scope,p_days:Number(days)}),
      supabase.rpc("hq_geographic_opportunities",{...scope,p_days:Number(days),p_limit:100}),
      supabase.rpc("hq_school_explorer_list",{...scope,p_school_level:schoolLevel||null,p_search:search||null,p_days:Number(days),p_limit:200}),
    ])
    if(he||qe||se||ge||oe||sle){setError("National intelligence is unavailable. No fallback data is being shown.");setLoading(false);return}
    setHierarchy((h??{countries:[],counties:[],subcounties:[],wards:[]}) as Hierarchy)
    setQuality(q as Quality);setSummary((s??emptySummary) as Summary);setGrowth((g??emptyGrowth) as Growth)
    setOpportunities((o??[]) as Opportunity[]);setSchools((sl??[]) as SchoolRow[])
    const parentType=ward?null:subcounty?"subcounty":county?"county":"country"
    const parentId=subcounty||county||country||null
    if(parentType){const {data:b,error:be}=await supabase.rpc("hq_geography_region_breakdown",{p_parent_type:parentType,p_parent_id:parentId,p_days:Number(days)});setBreakdown(be?[]:(b??[]) as Breakdown[])}else setBreakdown([])
    setLoading(false)
  },[country,county,subcounty,ward,days,schoolLevel,search])

  useEffect(()=>{void load()},[load])

  const openSchool=async(id:string)=>{setSchoolLoading(true);const {data,error:schoolError}=await supabase.rpc("hq_school_360",{p_school_id:id,p_days:Number(days)});if(schoolError){setError("School 360 is unavailable for this school.");setSchool360(null)}else setSchool360(data as School360);setSchoolLoading(false)}
  const resetCounty=(v:string)=>{setCountry(v);setCounty("");setSubcounty("");setWard("")}
  const resetSubcounty=(v:string)=>{setCounty(v);setSubcounty("");setWard("")}
  const resetWard=(v:string)=>{setSubcounty(v);setWard("")}
  const geoCoverage=summary.schools.total?Math.round((summary.schools.verified_geography/summary.schools.total)*100):null
  const mapCoverage=summary.schools.total?Math.round((summary.schools.mapped_coordinates/summary.schools.total)*100):null

  return <HQPage title="National Intelligence" description="Where VibeSchool exists, who uses it, what is changing, and what requires Founder investigation. Unknown evidence remains unknown.">
    <div className="geo-stack">
      <HQPanel title="Scope" description="One canonical geographic scope drives schools, users, growth, activity and opportunities.">
        <div className="geo-filters">
          <Field label="Country" value={country} onChange={resetCounty} items={hierarchy.countries}/>
          <Field label="County" value={county} onChange={resetSubcounty} items={counties} disabled={!country&&hierarchy.countries.length>0}/>
          <Field label="Sub-County" value={subcounty} onChange={resetWard} items={subcounties} disabled={!county}/>
          <Field label="Ward" value={ward} onChange={setWard} items={wards} disabled={!subcounty}/>
          <label className="geo-field"><span>Period</span><select value={days} onChange={e=>setDays(e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
          <label className="geo-field"><span>School level</span><select value={schoolLevel} onChange={e=>setSchoolLevel(e.target.value)}><option value="">All / Unknown included</option><option value="Primary">Primary</option><option value="Junior School">Junior School</option><option value="Secondary">Secondary</option><option value="Unknown">Unknown</option></select></label>
          <label className="geo-field geo-search"><span>School / alias / code</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search canonical schools"/></label>
        </div>
      </HQPanel>

      {error&&<div role="alert" className="geo-alert">{error}</div>}
      {loading?<div className="geo-loading">Loading owner-authorized evidence…</div>:<>
        <section className="geo-band" aria-labelledby="now-heading"><div className="geo-band-title"><strong id="now-heading">NOW</strong><span>What requires attention</span></div><div className="geo-metrics"><Metric label="Unresolved geography" value={summary.schools.unresolved_geography}/><Metric label="Conflicting geography" value={summary.schools.conflicting_geography}/><Metric label="Open support" value={summary.support.open_cases}/><Metric label="Incidents" value={summary.support.incidents}/><Metric label="Opportunity signals" value={opportunities.length} note="Deterministic evidence rules"}/></div></section>

        <section className="geo-band" aria-labelledby="where-heading"><div className="geo-band-title"><strong id="where-heading">WHERE</strong><span>Institutional geography, not residential location</span></div><div className="geo-metrics"><Metric label="Canonical schools" value={summary.schools.total}/><Metric label="Verified geography" value={summary.schools.verified_geography} note={geoCoverage===null?"Coverage unavailable":`${geoCoverage}% of scoped schools`}/><Metric label="Mapped coordinates" value={summary.schools.mapped_coordinates} note={mapCoverage===null?"Coverage unavailable":`${mapCoverage}% of scoped schools`}/><Metric label="Active schools" value={summary.activity.evidence==="available"?summary.activity.active_schools:"Unknown"} note={`Evidence: ${evidenceText(summary.activity.evidence)}`}/><Metric label="Membership rows" value={summary.users.school_memberships} note="Not unique people"}/></div></section>

        <section className="geo-band" aria-labelledby="trend-heading"><div className="geo-band-title"><strong id="trend-heading">TREND</strong><span>Current selected period</span></div><div className="geo-metrics"><Metric label="Linked unique people" value={growth.institution_linked_unique_people}/><Metric label="New linked users" value={growth.new_linked_users}/><Metric label="Active users" value={growth.active_users}/><Metric label="Returning users" value={growth.returning_users}/><Metric label="New schools" value={growth.new_schools} note={growth.measurement.certified_from?`Measurement certified from ${new Date(growth.measurement.certified_from).toLocaleDateString()}`:"Measurement certification unavailable"}/></div><p className="geo-note">Retention is intentionally not calculated in this read model. Certified Measurement Kernel retention must be consumed separately rather than reconstructed from incomplete history.</p></section>

        <div className="geo-grid">
          <HQPanel title="Regional intelligence" description="School counts are aggregated independently from event rows to prevent activity fan-out from inflating totals.">
            {breakdown.length===0?<div className="geo-empty">No governed administrative breakdown is available at this scope.</div>:<div className="geo-region-list" role="list">{breakdown.map(row=><div className="geo-region" role="listitem" key={row.id}><div><strong>{row.name}</strong><span>{row.school_count} schools · {row.verified_school_count} verified · {row.active_school_count} active</span></div><div className="geo-bar" aria-label={`${row.name}: ${row.school_count} schools`}><i style={{width:`${Math.max(2,Math.round((row.school_count/maxBreakdown)*100))}%`}}/></div></div>)}</div>}
          </HQPanel>

          <HQPanel title="Data quality" description="Coverage is evidence quality, separate from business performance.">
            {quality?<div className="geo-quality"><Metric label="Without governed mapping" value={quality.without_mapping}/><Metric label="Without county" value={quality.without_county}/><Metric label="Without sub-county" value={quality.without_subcounty}/><Metric label="Without ward" value={quality.without_ward}/><Metric label="Without coordinates" value={quality.without_coordinates}/><Metric label="Conflicting" value={quality.conflicting}/></div>:<div className="geo-empty">Quality evidence unavailable.</div>}
          </HQPanel>
        </div>

        <HQPanel title="Founder opportunities" description="Deterministic evidence → scope → recommended investigation. These signals do not authorize consequential action.">
          {opportunities.length===0?<div className="geo-empty">No supported opportunity signals at this scope, or evidence is insufficient.</div>:<div className="geo-opportunities">{opportunities.slice(0,20).map((op,index)=><button key={`${op.signal_type}-${op.school_id}-${index}`} className="geo-opportunity" onClick={()=>void openSchool(op.school_id)}><span className="geo-chip">{evidenceText(op.signal_type)}</span><strong>{op.school_name}</strong><span>{[op.ward,op.subcounty,op.county].filter(Boolean).join(" · ")||"Geography unresolved"}</span><small>{op.recommended_investigation}</small></button>)}</div>}
        </HQPanel>

        <HQPanel title="School explorer" description="Canonical schools only. Search may match a canonical alias or official identifier without merging identity.">
          {schools.length===0?<div className="geo-empty">No canonical schools match the current scope and filters.</div>:<div className="geo-table-wrap"><table className="geo-table"><thead><tr><th>School</th><th>Level</th><th>Geography</th><th>Learners</th><th>Teachers</th><th>Active users</th><th>Support</th><th></th></tr></thead><tbody>{schools.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.knec_code||row.nemis_code||"No official code shown"}</small></td><td>{row.school_type||"Unknown"}</td><td>{row.ward||row.subcounty||row.county||"Unknown"}<small>{evidenceText(row.geography_state)}</small></td><td>{row.learners}</td><td>{row.teachers}</td><td>{row.active_users}</td><td>{row.open_support_cases}</td><td><button className="geo-open" onClick={()=>void openSchool(row.id)}>School 360</button></td></tr>)}</tbody></table></div>}
        </HQPanel>

        {(schoolLoading||school360)&&<HQPanel title="School 360" description="Aggregate-first institutional intelligence. No residential geography or unrestricted child records.">
          {schoolLoading?<div className="geo-loading">Loading School 360…</div>:school360&&<div className="geo-360"><div className="geo-360-head"><div><span className="geo-chip">{school360.identity.status||"Unknown status"}</span><h2>{school360.identity.name}</h2><p>{school360.identity.school_type||"Unknown level"} · {school360.identity.school_category||"Unknown category"}</p></div><button className="geo-open" onClick={()=>setSchool360(null)}>Close</button></div><div className="geo-metrics"><Metric label="Students" value={school360.community.students}/><Metric label="Teachers" value={school360.community.teachers}/><Metric label="Parents" value={school360.community.parents}/><Metric label="Admins" value={school360.community.admins}/><Metric label="Active users" value={school360.engagement.evidence==="available"?school360.engagement.active_users:"Unknown"}/></div><div className="geo-360-grid"><section><h3>Identity</h3><p>Canonical ID: <code>{school360.identity.id}</code></p><p>KNEC: {school360.identity.knec_code||"Unknown"}</p><p>NEMIS: {school360.identity.nemis_code||"Unknown"}</p><p>Aliases: {school360.identity.aliases.length?school360.identity.aliases.map(a=>a.alias).join(", "):"None recorded"}</p></section><section><h3>Geography</h3><p>{[school360.geography.ward,school360.geography.subcounty,school360.geography.county,school360.geography.country].filter(Boolean).join(" · ")||"Unknown"}</p><p>State: {evidenceText(school360.geography.verification_state)}</p><p>Coordinates: {school360.geography.latitude!==null&&school360.geography.longitude!==null?`${school360.geography.latitude}, ${school360.geography.longitude}`:"Unavailable"}</p></section><section><h3>Operations</h3><p>Support cases: {school360.operations.open_support_cases}</p><p>Identity reviews: {school360.operations.open_identity_reviews}</p><p>Incidents: {school360.operations.open_incidents}</p></section><section><h3>Engagement evidence</h3><p>Events: {school360.engagement.event_count}</p><p>Active teachers: {school360.engagement.evidence==="available"?school360.engagement.active_teachers:"Unknown"}</p><p>Evidence: {evidenceText(school360.engagement.evidence)}</p></section></div></div>}
        </HQPanel>}

        <HQPanel title="Kenya heat map & school locator" description="Map evidence is governed separately from the table/list alternative and must never imply precision that the data does not support.">
          {summary.schools.mapped_coordinates===0?<div className="geo-map-hold"><strong>Map evidence not ready</strong><p>No eligible scoped school coordinates are available. Schools remain visible in non-map analysis; no coordinates are fabricated.</p></div>:<div className="geo-map-hold"><strong>Partial map coverage: {mapCoverage}%</strong><p>{summary.schools.mapped_coordinates} of {summary.schools.total} scoped schools have eligible coordinates. The locator map remains held until its lazy-loaded map primitive is certified; the school explorer above remains the accessible canonical alternative.</p></div>}
        </HQPanel>
      </>}
    </div>
    <style jsx global>{`
      .geo-stack{display:grid;gap:14px}.geo-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:14px}.geo-field{display:grid;gap:6px}.geo-field span{font-size:11px;font-weight:850;color:#8fa2ba;text-transform:uppercase;letter-spacing:.04em}.geo-field select,.geo-field input{min-height:44px;border-radius:10px;border:1px solid rgba(148,163,184,.18);background:#091727;color:#f8fafc;padding:0 10px}.geo-search{grid-column:span 2}.geo-band{display:grid;gap:9px}.geo-band-title{display:flex;align-items:baseline;gap:9px}.geo-band-title strong{font-size:11px;letter-spacing:.12em}.geo-band-title span,.geo-note{color:#8fa2ba;font-size:11px}.geo-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.geo-metric{min-width:0;border:1px solid rgba(148,163,184,.13);border-radius:13px;background:#0b1728;padding:14px}.geo-metric span{display:block;color:#8fa2ba;font-size:11px;font-weight:800}.geo-metric strong{display:block;margin-top:5px;font-size:22px}.geo-metric small{display:block;margin-top:5px;color:#8fa2ba;font-size:10px;line-height:1.35}.geo-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}.geo-table-wrap{overflow:auto}.geo-table{width:100%;border-collapse:collapse;font-size:12px}.geo-table th,.geo-table td{padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.1);text-align:left;vertical-align:top}.geo-table th{color:#8fa2ba;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.geo-table td small{display:block;color:#8fa2ba;margin-top:4px}.geo-quality{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px}.geo-empty,.geo-loading{padding:24px;color:#8fa2ba;font-size:13px}.geo-alert{border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);color:#fde68a;padding:12px 14px;border-radius:12px}.geo-map-hold{padding:22px}.geo-map-hold strong{display:block;font-size:15px}.geo-map-hold p{margin:7px 0 0;color:#8fa2ba;line-height:1.55;font-size:12px}.geo-region-list{display:grid}.geo-region{display:grid;grid-template-columns:minmax(160px,1fr) minmax(100px,1.1fr);gap:16px;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.1)}.geo-region strong,.geo-region span{display:block}.geo-region span{color:#8fa2ba;font-size:11px;margin-top:3px}.geo-bar{height:8px;border-radius:999px;background:rgba(148,163,184,.1);overflow:hidden}.geo-bar i{display:block;height:100%;background:currentColor;border-radius:999px}.geo-opportunities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}.geo-opportunity{display:grid;gap:5px;text-align:left;padding:14px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:#0b1728;color:#f8fafc;min-height:44px}.geo-opportunity span,.geo-opportunity small{color:#8fa2ba}.geo-chip{width:max-content;border:1px solid rgba(148,163,184,.2);border-radius:999px;padding:3px 7px;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.geo-open{min-height:40px;border-radius:9px;border:1px solid rgba(148,163,184,.2);background:#102137;color:#f8fafc;padding:0 11px}.geo-360{display:grid;gap:14px;padding:14px}.geo-360-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.geo-360-head h2{margin:7px 0 2px}.geo-360-head p{margin:0;color:#8fa2ba}.geo-360-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.geo-360-grid section{border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:13px}.geo-360-grid h3{margin:0 0 8px;font-size:12px}.geo-360-grid p{margin:5px 0;color:#c8d5e4;font-size:11px;overflow-wrap:anywhere}.geo-360-grid code{font-size:10px}
      @media(max-width:1100px){.geo-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.geo-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:720px){.geo-filters{grid-template-columns:1fr 1fr}.geo-search{grid-column:span 2}.geo-metrics{grid-template-columns:1fr 1fr}.geo-grid{grid-template-columns:1fr}.geo-quality{grid-template-columns:1fr 1fr}.geo-table th,.geo-table td{padding:11px 10px}.geo-opportunities{grid-template-columns:1fr}.geo-region{grid-template-columns:1fr}.geo-360-grid{grid-template-columns:1fr}}
      @media(max-width:390px){.geo-filters{grid-template-columns:1fr}.geo-search{grid-column:auto}.geo-metrics{grid-template-columns:1fr 1fr}.geo-metric strong{font-size:19px}.geo-360-head{display:grid}}
    `}</style>
  </HQPage>
}
