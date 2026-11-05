import { notFound, permanentRedirect } from 'next/navigation'
import { resolveSchoolAddress } from '@/lib/school-urls-server'
import { schoolUrl } from '@/lib/school-urls'
export const dynamic = 'force-dynamic'
export default async function LegacySchool({params}:{params:{id:string}}){
 const school=await resolveSchoolAddress('directory',params.id)
 if(!school)notFound()
 permanentRedirect(schoolUrl(school.slug))
}
