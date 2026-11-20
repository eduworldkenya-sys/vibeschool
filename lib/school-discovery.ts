export type FilterOption = { option_kind: 'county'|'sub_county'|'level'; option_value: string }

export function normalizeSchoolQuery(value: string) {
 return value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
}

function oneEdit(a: string,b: string) {
 if(Math.abs(a.length-b.length)>1)return false
 if(a.length>b.length)return oneEdit(b,a)
 let i=0,j=0,edits=0
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue}
  if(++edits>1)return false
  if(a.length===b.length)i++
  j++
 }
 return edits+(j<b.length?1:0)<=1
}

export function locationSuggestions(query: string, options: FilterOption[], county: string) {
 const q=normalizeSchoolQuery(query)
 if(q.length<2)return []
 return options.filter(o=>o.option_kind==='county'&&!county||o.option_kind==='sub_county'&&!!county)
  .map(o=>{const v=normalizeSchoolQuery(o.option_value);return { ...o,rank:v===q?0:v.startsWith(q)?1:q.length>=5&&oneEdit(q,v)?2:3 }})
  .filter(o=>o.rank<3)
  .sort((a,b)=>a.rank-b.rank||a.option_value.localeCompare(b.option_value))
  .slice(0,4)
}

export function locationSearchCandidate(matches: ReturnType<typeof locationSuggestions>,query:string){
 if(normalizeSchoolQuery(query).length<3)return null
 const exact=matches.filter(m=>m.rank===0)
 if(exact.length===1)return exact[0]
 const prefixes=matches.filter(m=>m.rank===1)
 return prefixes.length===1?prefixes[0]:null
}

export function mergeSchoolMatches<T extends {slug:string}>(names:T[],locations:T[],limit:number){
 return [...new Map([...names,...locations].map(s=>[s.slug,s])).values()].slice(0,limit)
}
