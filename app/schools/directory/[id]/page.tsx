import { notFound, permanentRedirect } from 'next/navigation'
import { resolveSchoolAddress } from '@/lib/school-urls-server'
import { schoolUrl } from '@/lib/school-urls'
export const dynamic = 'force-dynamic'
export default async function LegacySchool(props:{params: Promise<{id:string}>}) {
 const params = await props.params;
 const school=await resolveSchoolAddress('directory',params.id)
 if(!school)notFound()
 permanentRedirect(schoolUrl(school.slug))
}
