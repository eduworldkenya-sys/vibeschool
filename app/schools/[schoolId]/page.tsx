import { notFound, permanentRedirect } from 'next/navigation'
import { resolveSchoolAddress } from '@/lib/school-urls-server'
import { schoolUrl } from '@/lib/school-urls'
export const dynamic = 'force-dynamic'
export default async function LegacySchool(props:{params: Promise<{schoolId:string}>}) {
 const params = await props.params;
 const school=await resolveSchoolAddress('school',params.schoolId)
 if(!school)notFound()
 permanentRedirect(schoolUrl(school.slug))
}
