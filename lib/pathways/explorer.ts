export type Pathway = { id:string; slug:string; name:string }
export type Track = { id:string; pathway_id:string; slug:string; name:string }
export type Combination = { id:string; pathway_id:string; track_id:string|null; slug:string; display_name:string }
export type Subject = { combination_id:string; subject_name:string; subject_order:number }
export type Career = { id:string; slug:string; name:string; summary:string|null }
export type CareerLink = { career_id:string; pathway_id:string; track_id:string|null; explanation:string|null }
export type Catalogue = { pathways:Pathway[]; tracks:Track[]; combinations:Combination[]; subjects:Subject[]; careers:Career[]; links:CareerLink[] }
export const EMPTY_CATALOGUE:Catalogue={pathways:[],tracks:[],combinations:[],subjects:[],careers:[],links:[]}
export const PATHWAYS=[{slug:'stem',name:'STEM',tone:'stem'},{slug:'social-sciences',name:'Social Sciences',tone:'social'},{slug:'arts-and-sports-science',name:'Arts & Sports',tone:'arts'}] as const
export function exploreTrack(data:Catalogue,pathway:Pathway,track:Track){
 const combinations=data.combinations.filter(c=>c.pathway_id===pathway.id&&c.track_id===track.id)
 const ids=new Set(combinations.map(c=>c.id))
 const subjects=Array.from(new Set(data.subjects.filter(s=>ids.has(s.combination_id)).sort((a,b)=>a.subject_order-b.subject_order).map(s=>s.subject_name)))
 const links=data.links.filter(l=>l.pathway_id===pathway.id&&(!l.track_id||l.track_id===track.id))
 const careers=data.careers.flatMap(c=>{const link=links.find(l=>l.career_id===c.id);return link?[{...c,explanation:link.explanation,pathwayOnly:!link.track_id}]:[]})
 return {combinations,subjects,careers}
}
export function schoolFilters(pathway:Pathway,combination?:Combination){return {p_query:null,p_county:null,p_pathway_slug:pathway.slug,p_combination_slug:combination?.slug??null,p_limit:30}}
