export type SearchItem={id:string;label:string;category:string;keywords?:string};
export function matchItems(items:SearchItem[],query:string){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 if(!words.length)return items;
 return items.map(item=>{const label=item.label.toLowerCase(),hay=[label,item.category,item.keywords??""].join(" ").toLowerCase();let score=0;for(const word of words){if(label===word)score+=8;else if(label.startsWith(word))score+=5;else if(label.includes(word))score+=3;else if(hay.includes(word))score+=1;else return {item,score:-1}}return {item,score}}).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.item)
}
export function moveItem<T>(items:T[],from:number,to:number):T[]{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=items.length||to>=items.length||from===to)return items;
 const copy=[...items];const [item]=copy.splice(from,1);copy.splice(to,0,item);return copy;
}
export function rememberSearch(previous:string[],value:string,max=5){const text=value.trim();return text?[text,...previous.filter(x=>x.toLowerCase()!==text.toLowerCase())].slice(0,max):previous}
export type FilterRecord={grade:string;subject:string;status:string};
export type FilterValue={grade:string;subjects:string[];status:string;sort:"asc"|"desc"};
export const initialFilter:FilterValue={grade:"all",subjects:[],status:"all",sort:"asc"};
export function activeFilterCount(v:FilterValue){return Number(v.grade!=="all")+v.subjects.length+Number(v.status!=="all")+Number(v.sort!=="asc")}
export function filterRecords<T extends FilterRecord&{label:string}>(records:T[],value:FilterValue){return records.filter(r=>(value.grade==="all"||r.grade===value.grade)&&(!value.subjects.length||value.subjects.includes(r.subject))&&(value.status==="all"||r.status===value.status)).sort((a,b)=>value.sort==="asc"?a.label.localeCompare(b.label):b.label.localeCompare(a.label))}
export function monthDays(year:number,month:number){const offset=new Date(year,month,1).getDay();const count=new Date(year,month+1,0).getDate();return [...Array.from({length:offset},()=>null),...Array.from({length:count},(_,i)=>i+1)]}
