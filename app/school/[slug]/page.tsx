import { notFound, permanentRedirect } from 'next/navigation'
import SchoolProfile from '@/app/schools/components/SchoolProfile'
import DirectorySchool from '@/app/schools/components/DirectorySchool'
import { resolveSchoolAddress } from '@/lib/school-urls-server'
import { schoolUrl } from '@/lib/school-urls'
export const dynamic = 'force-dynamic'
export async function generateMetadata({params}:{params:{slug:string}}){
 const school=await resolveSchoolAddress('slug',params.slug)
 return school?{title:school.school_name+' | VibeSchool',alternates:{canonical:'https://vibeschool.co.ke'+schoolUrl(school.slug)}}:{}
}
export default async function PublicSchoolPage({params}:{params:{slug:string}}){
 const school=await resolveSchoolAddress('slug',params.slug)
 if(!school)notFound()
 if(params.slug!==school.slug)permanentRedirect(schoolUrl(school.slug))
 return school.source_kind==='canonical'?<SchoolProfile schoolIdOverride={school.source_id} schoolBaseOverride={schoolUrl(school.slug)}/>:<DirectorySchool school={school}/>
}
