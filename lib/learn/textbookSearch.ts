export type SearchHit = {publicationId:string;chapterId:string;blockId:string;chapterTitle:string;bookTitle:string;label:string;snippet:string;score:number}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const labels:Record<string,string>={paragraph:'Explanation',content:'Explanation',definition:'Definition',workedExample:'Worked example',example:'Example',summary:'Summary',keyPoints:'Key points',callout:'Key idea',heading3:'Concept',bulletList:'Explanation',numberedList:'Explanation'}
function text(v:string){return v.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()}
function normalize(v:string){return v.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
export function searchReadableBook(payload:unknown,publicationId:string,query:string):SearchHit[]{
  const root=record(payload),pub=record(root.publication)
  const phrase=normalize(query.slice(0,100)),words=[...new Set(phrase.split(' ').filter(Boolean))]
  if(root.ok!==true||pub.id!==publicationId||pub.status!=='published'||!Array.isArray(root.chapters)||phrase.length<2||!words.length)return []
  const hits:SearchHit[]=[]
  for(const raw of root.chapters){
    const chapter=record(raw)
    if(chapter.status!=='published'||chapter.can_read!==true||typeof chapter.id!=='string'||!Array.isArray(chapter.blocks))continue
    for(const rawBlock of chapter.blocks){
      const block=record(rawBlock),meta=record(block.meta)
      if(typeof block.id!=='string'||typeof block.type!=='string'||!Object.hasOwn(labels,block.type)||typeof block.content!=='string'||block.is_teacher_only===true||meta.is_teacher_only===true||meta.teacherOnly===true)continue
      // Only learner-readable prose. No question blocks or answer-key snippets.
      const body=text(block.content)
      if(!body||/\banswer\s*:/i.test(body)&&block.type!=='workedExample'&&block.type!=='example')continue
      const normalized=normalize(body),bodyWords=new Set(normalized.split(' '))
      const exact=normalized.includes(phrase),matched=words.filter(word=>bodyWords.has(word)||normalized.includes(word))
      if(!exact&&matched.length!==words.length)continue
      const position=Math.max(0,body.toLocaleLowerCase().indexOf(words[0]))
      const start=Math.max(0,position-40),end=Math.min(body.length,start+180)
      hits.push({publicationId,chapterId:chapter.id,blockId:block.id,chapterTitle:typeof chapter.title==='string'?chapter.title:'Chapter',bookTitle:typeof pub.title==='string'?pub.title:'Textbook',label:labels[block.type],snippet:(start?'…':'')+body.slice(start,end)+(end<body.length?'…':''),score:(exact?100:50)+matched.length*5+(block.type==='definition'||block.type==='workedExample'?8:0)})
    }
  }
  return hits
}
export function rankSearchHits(hits:SearchHit[]):SearchHit[]{
  const unique=new Map<string,SearchHit>()
  for(const hit of hits){const key=hit.publicationId+':'+hit.chapterId+':'+hit.blockId;if(!unique.has(key))unique.set(key,hit)}
  return [...unique.values()].sort((a,b)=>b.score-a.score||a.bookTitle.localeCompare(b.bookTitle)||a.chapterTitle.localeCompare(b.chapterTitle)||a.blockId.localeCompare(b.blockId))
}
