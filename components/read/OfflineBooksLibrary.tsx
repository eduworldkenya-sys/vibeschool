'use client'
import { useEffect, useState } from 'react'
import type { OfflineBook } from '@/lib/read/offlinePublicBooks'
import { deleteOfflineBook, listOfflineBooks } from '@/lib/read/offlinePublicBooks'
import { ContentBlockEditor } from '@/components/global/publish/ContentBlockEditor'

const card:React.CSSProperties={border:'1px solid #344053',background:'#121c2c',borderRadius:16,padding:16}
const button:React.CSSProperties={border:'1px solid #4e667c',background:'#20324a',color:'#fff',padding:'10px 12px',borderRadius:10,minHeight:42,cursor:'pointer'}
export default function OfflineBooksLibrary(){
  const [books,setBooks]=useState<OfflineBook[]>([])
  const [selected,setSelected]=useState<string|null>(null)
  const [chapterIndex,setChapterIndex]=useState(0)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const refresh=async()=>{
    try{setBooks(await listOfflineBooks());setError('')}catch(e){setError(e instanceof Error?e.message:'Offline storage unavailable.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void refresh()},[])
  const book=books.find(item=>item.id===selected)
  const chapter=book?.chapters[chapterIndex]
  const remove=async(id:string)=>{
    try{await deleteOfflineBook(id);if(selected===id)setSelected(null);await refresh()}
    catch(e){setError(e instanceof Error?e.message:'Could not remove saved book.')}
  }
  return <main style={{minHeight:'100dvh',background:'#0b101c',color:'#f7fbff',padding:'max(20px,env(safe-area-inset-top)) 16px 80px',fontFamily:'system-ui, sans-serif'}}>
    <div style={{maxWidth:760,margin:'0 auto'}}>
      <header style={{display:'flex',alignItems:'center',gap:12,justifyContent:'space-between',flexWrap:'wrap',marginBottom:22}}>
        <div><div style={{fontSize:11,color:'#93e9d5',fontWeight:800,letterSpacing:'.14em'}}>VIBESCHOOL</div><h1 style={{fontSize:24,margin:'4px 0'}}>My Offline Books</h1></div>
        <a href="/student/study" style={{color:'#9eeede'}}>Back to learning (online)</a>
      </header>
      <p style={{fontSize:13,color:'#b5c5d5'}}>Books downloaded on this device can be read without internet. The offline library currently contains only publicly readable free chapters. New books and online learning tools require a connection.</p>
      {error&&<p role="alert" style={{color:'#ffa5a5'}}>{error}</p>}
      {loading?<p>Loading saved books…</p>:!book?<>
        {!books.length?<section style={card}><h2 style={{fontSize:18}}>No books downloaded yet</h2><p>While online, open a VibeSchool textbook and select “Download for offline”. Then return here to read it without data.</p></section>:null}
        <div style={{display:'grid',gap:12,marginTop:16}}>{books.map(item=><section style={card} key={item.id}>
          <h2 style={{fontSize:18,margin:'0 0 6px'}}>{item.title}</h2>
          <p style={{color:'#b5c5d5',fontSize:12,margin:'0 0 12px'}}>{item.chapters.length} downloaded chapters · Stored on this device</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button style={button} onClick={()=>{setSelected(item.id);setChapterIndex(0)}}>Read offline</button>
            <button style={button} onClick={()=>void remove(item.id)}>Remove download</button>
          </div>
        </section>)}</div>
      </>:<>
        <button style={button} onClick={()=>setSelected(null)}>← Library</button>
        <h2 style={{fontSize:23,margin:'22px 0 6px'}}>{book.title}</h2>
        <label htmlFor="offline-chapters" style={{color:'#a5e9ce',fontSize:13}}>Chapter</label>
        <select id="offline-chapters" value={chapterIndex} onChange={e=>setChapterIndex(Number(e.target.value))} style={{display:'block',width:'100%',padding:12,margin:'8px 0 24px',background:'#172538',color:'#fff',border:'1px solid #344053',borderRadius:10}}>
          {book.chapters.map((c,i)=><option key={c.id} value={i}>{c.number}. {c.title}</option>)}
        </select>
        {chapter?<article>
          <h3 style={{fontSize:25,lineHeight:1.2,marginBottom:24}}>{chapter.title}</h3>
          {chapter.blocks.map(block=><div key={block.id} style={{margin:'0 0 15px'}}>
            <ContentBlockEditor block={block} format={book.format} readOnly isFocused={false} onUpdate={()=>{}} onFocus={()=>{}} onDelete={()=>{}} onMoveUp={()=>{}} onMoveDown={()=>{}}/>
          </div>)}
          <nav aria-label="Offline chapter navigation" style={{display:'flex',gap:8,justifyContent:'space-between',marginTop:28}}>
            <button style={button} disabled={chapterIndex===0} onClick={()=>{setChapterIndex(i=>i-1);window.scrollTo(0,0)}}>← Previous</button>
            <button style={button} disabled={chapterIndex===book.chapters.length-1} onClick={()=>{setChapterIndex(i=>i+1);window.scrollTo(0,0)}}>Next →</button>
          </nav>
        </article>:<p>This chapter is not available offline.</p>}
      </>}
    </div>
  </main>
}
