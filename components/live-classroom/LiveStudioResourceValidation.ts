'use client'
import {supabase} from '@/lib/supabase'
import {LIVE_LEARNER_ASSET_KINDS,LIVE_SCHOOL_GRADE_LABELS,liveResourcePages,readableLiveResourceText} from '@/lib/live/resourcePresentation'
import {studioResource,type LiveSlide} from './LiveSlideProtocol'

// This is a client readiness check, not a replacement for server access policies.
export async function validateStudioResources(slides:readonly LiveSlide[]):Promise<void>{
 for(const slide of slides){
  const ref=studioResource(slide)
  if(!ref)continue
  const root=await supabase.from('learning_resources').select('id,title').eq('id',ref.id).eq('status','active').eq('visibility','public').in('asset_kind',[...LIVE_LEARNER_ASSET_KINDS]).in('grade',LIVE_SCHOOL_GRADE_LABELS).maybeSingle()
  if(root.error||!root.data)throw Error('A prepared resource is no longer released. Remove and replace it before teaching.')
  const version=await supabase.from('learning_resource_versions').select('id,payload').eq('id',ref.version).eq('resource_id',ref.id).eq('lifecycle_status','certified').in('rights_status',['cleared','not_applicable']).not('certified_at','is',null).maybeSingle()
  if(version.error||!version.data)throw Error('A prepared resource version is unavailable. Add the approved resource again.')
  const raw=liveResourcePages(root.data.title,readableLiveResourceText(version.data.payload))[ref.page]
  if(!raw||slide.body!=='Resource page\n\n'+raw)throw Error('A prepared resource page has changed. Remove it and add the approved page again.')
 }
}
