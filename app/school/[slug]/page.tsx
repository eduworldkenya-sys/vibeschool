import { notFound } from 'next/navigation'
import SchoolProfilePage from '../../schools/[schoolId]/page'

const GILGIL_ID = 'c51ec2ae-5b70-4f69-887d-54eb9f312db7'

export default function PublicSchoolPage({params}:{params:{slug:string}}){
 if(params.slug!=='gilgiltownship')notFound()
 return <SchoolProfilePage schoolIdOverride={GILGIL_ID}/>
}
