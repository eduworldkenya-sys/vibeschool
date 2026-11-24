/** Presentation projection for the 19 imported Grade 4 Social Studies units.
 * The public shell may contain historic rows. Never delete those rows or infer
 * source authority from a display name. Stable ids are from the approved import.
 */
import type { CurriculumOutlineRow } from './textbookOutline'
const UNITS = [
  {
    "id": "e1e01829-0177-46a7-ad89-168683ea59c4",
    "code": "1.1"
  },
  {
    "id": "2ca9a681-4046-4470-a0dc-6e9e996ece12",
    "code": "1.2"
  },
  {
    "id": "77ee883c-c107-442a-90f2-335b36907029",
    "code": "1.3"
  },
  {
    "id": "418d7015-0486-40ca-9aac-33e8f99ba6ac",
    "code": "1.4"
  },
  {
    "id": "3329bb07-16c6-4998-b34e-69862d1e78c1",
    "code": "1.5"
  },
  {
    "id": "9d7e569a-4786-466e-96c4-5ec80f369187",
    "code": "2.1"
  },
  {
    "id": "a11c3af2-d144-4489-8a5e-3442b7e63529",
    "code": "2.2"
  },
  {
    "id": "893a8f48-2f9d-410c-a70b-52d48aecb244",
    "code": "3.1"
  },
  {
    "id": "01d94439-c82d-4834-ac3a-5616ee7f1acb",
    "code": "3.2"
  },
  {
    "id": "f3535c15-fa99-4664-b975-2e3666f4c27f",
    "code": "4.1"
  },
  {
    "id": "a3c5c6b4-5b14-45f9-a2a2-259a6b0222d1",
    "code": "4.2"
  },
  {
    "id": "2cd19ee6-03f4-4ead-90a0-88bf74d64d5d",
    "code": "4.3"
  },
  {
    "id": "5af32c0e-509d-4960-8c61-d90c1f8e322c",
    "code": "5.1"
  },
  {
    "id": "282b036e-78d6-4484-9580-af7d3ec5bcc9",
    "code": "5.2"
  },
  {
    "id": "abdee0fe-c57c-4f42-b26f-e0d54becd351",
    "code": "5.3"
  },
  {
    "id": "f9d60325-7795-41ec-99ea-085d5db16934",
    "code": "5.4"
  },
  {
    "id": "d6442483-58ca-42c2-a9bb-ecaad9da4b87",
    "code": "5.5"
  },
  {
    "id": "1786218c-d864-48ef-9e12-64d3e50daf0d",
    "code": "5.6"
  },
  {
    "id": "c686a631-390f-4ce0-b4e4-97e827aae692",
    "code": "5.7"
  }
] as const
export function projectGrade4SocialStudiesOutline(rows: readonly CurriculumOutlineRow[]): CurriculumOutlineRow[] | null {
 const byId = new Map(rows.map(row=>[row.id,row]))
 const projected: CurriculumOutlineRow[] = []
 for(const unit of UNITS){
  const row = byId.get(unit.id)
  if(!row?.name || !row.sub_strand || rows.filter(r=>r.id===unit.id).length!==1) return null
  const [strand,sub] = unit.code.split('.').map(Number)
  if(!row.sub_strand.startsWith(unit.code+' '))return null
  projected.push({...row, strand_order:strand, sub_strand_order:sub})
 }
 return projected
}
