import Link from 'next/link'

type CatalogueMode = 'topics' | 'sets'

export default function PracticeCatalogueNav({mode,subject='',topic=''}:{mode:CatalogueMode;subject?:string;topic?:string}) {
  const query=new URLSearchParams()
  if(subject.trim())query.set('subject',subject.trim())
  if(topic.trim())query.set('topic',topic.trim())
  const suffix=query.size?'?'+query.toString():''
  const destinations=[
    {mode:'topics',label:'Topics',href:'/student/vibelearn/topic-practice'+suffix},
    {mode:'sets',label:'Practice sets',href:'/student/vibelearn/practice'+suffix},
  ] as const
  return <nav aria-label="Practice catalogue" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',flexShrink:0,margin:'0 0 12px'}}>
    {destinations.map(destination=><Link key={destination.mode} href={destination.href}
      aria-current={mode===destination.mode?'page':undefined}
      style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:40,padding:'6px 12px',borderRadius:10,border:'1px solid var(--vs-border)',fontWeight:750,fontSize:13,textDecoration:'none',color:mode===destination.mode?'var(--vs-accent)':'var(--vs-text)',background:mode===destination.mode?'var(--vs-accent-soft)':'var(--vs-card)'}}>{destination.label}</Link>)}
    <Link href="/student/study" style={{display:'inline-flex',alignItems:'center',minHeight:40,padding:'6px 8px',fontSize:13,fontWeight:750,color:'var(--vs-accent)'}}>Read &amp; practise</Link>
  </nav>
}
