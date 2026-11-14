'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from './marketing-studio.module.css'

type Group='all'|'selection'|'challenge'|'arcade'
type Tool={id:string;name:string;subtitle:string;group:Exclude<Group,'all'>;href:string;symbol:string;count:string;description:string;features:string[];theme:string}
const TOOLS:Tool[]=[
 {id:'spin',name:'VibeSpin',subtitle:'THE WHEEL STUDIO',group:'selection',href:'/spin-studio',symbol:'◉',count:'Multi-outcome',description:'Build a branded spinning wheel with custom entries, photographs, sound, countdown, reveals and filming controls.',features:['Drag & rotate','Editable segments','Popup Director','Record videos'],theme:'mint'},
 {id:'sphere',name:'VibeSphere',subtitle:'THE ORB STUDIO',group:'selection',href:'/pendulum-studio',symbol:'◍',count:'Two outcomes',description:'Rotate an illuminated sphere around two axes, set opposite faces and let a fixed pointer reveal the selection.',features:['Two-axis movement','Logo faces','Studio themes','Cinematic spin'],theme:'blue'},
 {id:'coin',name:'VibeCoin',subtitle:'THE TOSS STUDIO',group:'selection',href:'/coin-studio',symbol:'◎',count:'Two faces',description:'Stage a two-sided toss with distinctive face designs, launch and reveal effects, and camera-ready presentation.',features:['Two-sided toss','Custom identities','Motion effects','Capture'],theme:'gold'},
 {id:'games',name:'VibeGames',subtitle:'QUIZ + ARCADE STUDIO',group:'challenge',href:'/games-studio',symbol:'▦',count:'14 formats',description:'One game creator with six quiz and reveal formats plus eight independent arcade mini-games.',features:['Quiz & reveal','Scratch & pick','Marble Race','Plinko & more'],theme:'violet'}
]
const FILTERS:{id:Group;label:string}[]=[{id:'all',label:'All tools'},{id:'selection',label:'Selection games'},{id:'challenge',label:'Quiz & arcade'}]
const STORE='vibeschool.marketing.studio.last-tool.v1'
export default function MarketingStudio(){
 const [filter,setFilter]=useState<Group>('all')
 const [recent,setRecent]=useState<string>('')
 useEffect(()=>{try{setRecent(localStorage.getItem(STORE)||'')}catch{/* private browser */}},[])
 const opened=(id:string)=>{setRecent(id);try{localStorage.setItem(STORE,id)}catch{/* private browser */}}
 const tool=TOOLS.find(x=>x.id===recent)
 return <main className={styles.page}>
  <div className={styles.wrap}>
   <header className={styles.top}>
    <Link href="/" className={styles.identity}><span className={styles.mark}>V</span><span><strong>VIBESCHOOL</strong><small>ORIGINALS</small></span></Link>
    <div className={styles.topRight}><span className={styles.unlisted}>CREATOR WORKSPACE · UNLISTED</span><Link href="/games-studio" className={styles.topLink}>Open game creator <span aria-hidden="true">↗</span></Link></div>
   </header>
   <section className={styles.hero}>
    <div className={styles.heroCopy}>
     <span className={styles.kicker}><i/> VIBESCHOOL CREATOR SUITE</span>
     <h1>Marketing <em>Studio.</em></h1>
     <p className={styles.lead}>One home for every VibeSchool game creator. Build a challenge, stage the suspense, record the reveal and take it to your audience.</p>
     <div className={styles.heroActions}>
      <a href="#tools" className={styles.primary}>Explore creator tools <span aria-hidden="true">↘</span></a>
      {tool&&<Link href={tool.href} onClick={()=>opened(tool.id)} className={styles.secondary}>Continue {tool.name} <span aria-hidden="true">↗</span></Link>}
     </div>
     <div className={styles.metrics}><span><strong>4</strong> Creator suites</span><span><strong>14</strong> Quiz & arcade formats</span><span><strong>1</strong> Unified workspace</span></div>
    </div>
    <div className={styles.visual} aria-hidden="true">
     <div className={styles.orbitRing}/>
     <div className={styles.orbitRingTwo}/>
     <span className={styles.orbitCoin}>A<span>↻</span>B</span>
     <span className={styles.orbitOrb}>◍</span>
     <span className={styles.orbitWheel}>✳</span>
     <span className={styles.orbitCard}>◈</span>
     <span className={styles.visualLabel}>CREATE · PLAY · RECORD · SHARE</span>
    </div>
   </section>
   <section id="tools" className={styles.toolsSection}>
    <div className={styles.sectionTitle}><div><span className={styles.kicker}>THE TOOL LIBRARY</span><h2>Choose your game.</h2><p>Each tool keeps its existing settings and browser-saved projects. No duplicate editors and no extra setup.</p></div><span className={styles.total}>04 ORIGINAL TOOLS</span></div>
    <div className={styles.filters} role="group" aria-label="Filter marketing games">
     {FILTERS.map(x=><button type="button" key={x.id} aria-pressed={filter===x.id} className={filter===x.id?styles.activeFilter:''} onClick={()=>setFilter(x.id)}>{x.label}</button>)}
    </div>
    <div className={styles.grid}>
     {TOOLS.filter(x=>filter==='all'||x.group===filter||(filter==='arcade'&&x.id==='games')).map(x=><article key={x.id} className={[styles.toolCard,styles[x.theme]].join(' ')}>
       <div className={styles.cardArt}><span className={styles.cardSymbol}>{x.symbol}</span><span className={styles.artNumber}>0{TOOLS.findIndex(t=>t.id===x.id)+1}</span><span className={styles.artGrid}/></div>
       <div className={styles.cardBody}>
        <div className={styles.cardEyebrow}><span>{x.subtitle}</span><span>{x.count}</span></div>
        <h3>{x.name}</h3><p>{x.description}</p>
        <div className={styles.chips}>{x.features.map(f=><span key={f}>{f}</span>)}</div>
        <Link className={styles.openTool} href={x.href} onClick={()=>opened(x.id)}>Open {x.name} <span aria-hidden="true">↗</span></Link>
       </div>
      </article>)}
    </div>
   </section>
   <section className={styles.bottomPanel}><div><span className={styles.kicker}>WORKFLOW</span><h2>One studio. Separate engines.</h2><p>Open a creator, customise the game, launch its show mode and capture a video. Return here to switch tools. Existing browser storage stays in the original creator, not in a new duplicate.</p></div><div className={styles.steps}><span><b>01</b> Choose a game</span><span><b>02</b> Make it yours</span><span><b>03</b> Play or record</span><span><b>04</b> Publish your content</span></div></section>
   <footer className={styles.footer}><span>VIBESCHOOL ORIGINALS · MARKETING STUDIO</span><span>Chance-based results are entertainment, not real-world forecasts. Projects are stored locally in their respective creators.</span></footer>
  </div>
 </main>
}
