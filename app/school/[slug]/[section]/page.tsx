import { notFound, permanentRedirect } from 'next/navigation'
import SchoolSection from '@/app/schools/components/SchoolSection'
import DirectorySchool from '@/app/schools/components/DirectorySchool'
import { resolveSchoolAddress } from '@/lib/school-urls-server'
import { schoolUrl, SCHOOL_SECTIONS } from '@/lib/school-urls'
export const dynamic = 'force-dynamic'
export async function generateMetadata({params}:{params:{slug:string;section:string}}){
 const school=await resolveSchoolAddress('slug',params.slug)
 return school?{title:params.section+' · '+school.school_name+' | VibeSchool',alternates:{canonical:'https://vibeschool.co.ke'+schoolUrl(school.slug)+'/'+params.section}}:{}
}
export default async function PublicSchoolSection({params}:{params:{slug:string;section:string}}){
 if(!SCHOOL_SECTIONS.some(s=>s===params.section))notFound()
 const school=await resolveSchoolAddress('slug',params.slug)
 if(!school)notFound()
 if(params.slug!==school.slug)permanentRedirect(schoolUrl(school.slug)+'/'+params.section)
 return school.source_kind==='canonical'?<SchoolSection schoolIdOverride={school.source_id} schoolBaseOverride={schoolUrl(school.slug)}/>:<DirectorySchool school={school} section={params.section}/>
}
