'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from '@/app/schools/schools.module.css'

type Location = { latitude:number; longitude:number }

/** Approximate source coordinates are deliberately not presented as verified entrances. */
export function SchoolMap({kind,sourceId,name}:{kind:'canonical'|'directory';sourceId:string;name:string}) {
 const [point,setPoint]=useState<Location|null>(null)
 useEffect(()=>{
  let active=true
  setPoint(null)
  void supabase.rpc('schools_public_approx_location_v1',{p_kind:kind,p_source_id:sourceId}).then(({data,error})=>{
   if(!active||error)return
   const row=(data as Location[]|null)?.[0]
   if(row && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
    && row.latitude>=-5 && row.latitude<=5 && row.longitude>=33 && row.longitude<=42) setPoint(row)
  })
  return()=>{active=false}
 },[kind,sourceId])
 if(!point)return null
 const {latitude:lat,longitude:lng}=point
 const bbox=[lng-0.012,lat-0.012,lng+0.012,lat+0.012].join(',')
 const embed='https://www.openstreetmap.org/export/embed.html?'+new URLSearchParams({bbox,layer:'mapnik',marker:lat+','+lng})
 const open='https://www.openstreetmap.org/?'+new URLSearchParams({mlat:String(lat),mlon:String(lng)})+'#map=15/'+lat+'/'+lng
 return <div className={styles.schoolApproxMap}>
  <p>Approximate directory map position. This marker may not be the current school entrance.</p>
  <iframe className={styles.schoolApproxMapFrame} title={'Approximate location of '+name}
   loading="lazy" referrerPolicy="no-referrer" src={embed}/>
  <div className={styles.schoolApproxMapLinks}>
   <a href={open} target="_blank" rel="noopener noreferrer">View larger map</a>
  </div>
 </div>
}
