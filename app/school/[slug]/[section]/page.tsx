import { notFound } from 'next/navigation'
import SchoolSubpage from '../../../schools/[schoolId]/[section]/page'

const GILGIL_ID = 'c51ec2ae-5b70-4f69-887d-54eb9f312db7'
const SECTIONS = ['about','academics','news','contact']

export default function PublicSchoolSection({params}:{params:{slug:string;section:string}}){
 if(params.slug!=='gilgiltownship'||!SECTIONS.includes(params.section))notFound()
 return <SchoolSubpage schoolIdOverride={GILGIL_ID}/>
}
