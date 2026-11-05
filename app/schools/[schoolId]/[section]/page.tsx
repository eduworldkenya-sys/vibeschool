import { notFound, permanentRedirect } from 'next/navigation'
import { resolveSchoolAddress } from '@/lib/school-urls-server'
import { schoolUrl, SCHOOL_SECTIONS } from '@/lib/school-urls'
export const dynamic = 'force-dynamic'
export default async function LegacySchool({params}:{params:{schoolId:string;section:string}}){
 if(!SCHOOL_SECTIONS.some(s=>s===params.section))notFound()
 const school=await resolveSchoolAddress('school',params.schoolId)
 if(!school)notFound()
 permanentRedirect(schoolUrl(school.slug)+'/'+params.section)
}
