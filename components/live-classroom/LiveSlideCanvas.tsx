'use client'
import styles from './LiveClassroom.module.css'

export const SLIDE_DIAGRAMS = ['none','fraction-circle','fraction-bars','number-line','ruler','protractor','coordinate-grid','counters','base-ten','clock','money','solids','handwriting','music'] as const
export const SLIDE_THEMES = ['paper','ocean','forest','night'] as const
export type SlideDiagram = typeof SLIDE_DIAGRAMS[number]
export type SlideTheme = typeof SLIDE_THEMES[number]
export type LiveSlide = {title:string;body:string;diagram?:SlideDiagram;theme?:SlideTheme;layout?:'wide'|'portrait';font?:'normal'|'large';notes?:string}
export type PublishedSlide = Omit<LiveSlide,'notes'> & {number:number;total:number}
const prefix='VSLIDE1:'
export function validSlide(s:unknown):s is LiveSlide {
 if(!s||typeof s!=='object')return false
 const x=s as LiveSlide
 return typeof x.title==='string'&&x.title.length<=120&&typeof x.body==='string'&&x.body.length<=3878
 &&(x.diagram===undefined||SLIDE_DIAGRAMS.includes(x.diagram))&&(x.theme===undefined||SLIDE_THEMES.includes(x.theme))
 &&(x.layout===undefined||x.layout==='wide'||x.layout==='portrait')&&(x.font===undefined||x.font==='normal'||x.font==='large')
 &&(x.notes===undefined||(typeof x.notes==='string'&&x.notes.length<=2000))
}
export function encodeSlide(s:LiveSlide,number:number,total:number):string {
 if(!validSlide(s)||!Number.isInteger(number)||!Number.isInteger(total)||number<1||number>total||total>30||(!s.title.trim()&&!s.body.trim()&&(!s.diagram||s.diagram==='none')))return ''
 // Construct an explicit public projection. Private presenter notes never enter the RPC.
 const body=prefix+JSON.stringify({title:s.title.trim(),body:s.body.trim(),diagram:s.diagram??'none',theme:s.theme??'paper',layout:s.layout??'wide',font:s.font??'normal',number,total})
 return body.length<=4000?body:''
}
export function decodeSlide(body:string):PublishedSlide|null {
 if(!body.startsWith(prefix)||body.length>4000)return null
 try{
  const raw:unknown=JSON.parse(body.slice(prefix.length))
  if(!validSlide(raw)||raw.notes!==undefined)return null
  const x=raw as PublishedSlide
  if(!Number.isInteger(x.number)||!Number.isInteger(x.total)||x.number<1||x.total>30||x.number>x.total)return null
  return {title:x.title,body:x.body,diagram:x.diagram,theme:x.theme,layout:x.layout,font:x.font,number:x.number,total:x.total}
 }catch{return null}
}
export function diagramLabel(d:SlideDiagram){return d==='none'?'Text only':d.replaceAll('-',' ').replace(/^./,s=>s.toUpperCase())}
export function TeachingDiagram({diagram}:{diagram:SlideDiagram}){
 if(diagram==='none')return null
 const stroke='#2466a4',fill='#70b9ea',ink='#183a56'
 const tick=(x:number,y:number,n:number)=> <g key={n}><path d={`M${x} ${y}v12`} stroke={ink}/><text x={x} y={y+26} textAnchor="middle" fontSize="11" fill={ink}>{n}</text></g>
 return <svg className={styles.slideDiagram} viewBox="0 0 320 180" role="img" aria-label={diagramLabel(diagram)}>
  {diagram==='fraction-circle'&&<><circle cx="160" cy="82" r="63" fill="white" stroke={stroke} strokeWidth="2"/><path d="M160 19 A63 63 0 0 1 160 145 Z" fill={fill}/><path d="M160 19V145M97 82H223" stroke={stroke} strokeWidth="2"/><text x="160" y="170" textAnchor="middle" fill={ink}>2/4 = 1/2</text></>}
  {diagram==='fraction-bars'&&<>{[2,4,8].map((n,j)=><g key={n}>{Array.from({length:n},(_,i)=><rect key={i} x={32+i*256/n} y={15+j*48} width={256/n} height="30" fill={i<n/2?fill:'white'} stroke={stroke}/>)}<text x="160" y={58+j*48} fontSize="12" textAnchor="middle" fill={ink}>{n/2}/{n}</text></g>)}</>}
  {diagram==='number-line'&&<><path d="M16 80H304M16 80l9 -5M16 80l9 5M304 80l-9 -5M304 80l-9 5" stroke={ink} strokeWidth="2"/>{Array.from({length:11},(_,i)=>tick(30+i*26,74,i-5))}<circle cx="160" cy="80" r="6" fill={stroke}/></>}
  {diagram==='ruler'&&<><rect x="15" y="42" width="290" height="76" rx="4" fill="#fff4bd" stroke={ink}/>{Array.from({length:101},(_,i)=><path key={i} d={`M${25+i*2.7} 43v${i%10===0?30:i%5===0?20:10}`} stroke={ink}/>)}{Array.from({length:11},(_,i)=><text key={i} x={25+i*27} y="88" textAnchor="middle" fontSize="11" fill={ink}>{i}</text>)}<text x="160" y="105" textAnchor="middle" fontSize="13" fill={ink}>cm</text></>}
  {diagram==='protractor'&&<><path d="M30 148 A130 130 0 0 1 290 148Z" fill="#e8f4fb" stroke={stroke} strokeWidth="2"/>{Array.from({length:19},(_,i)=>{const a=i*Math.PI/18;return <g key={i}><path d={`M${160+130*Math.cos(a)} ${148-130*Math.sin(a)}L${160+115*Math.cos(a)} ${148-115*Math.sin(a)}`} stroke={ink}/><text x={160+100*Math.cos(a)} y={152-100*Math.sin(a)} fontSize="9" textAnchor="middle" fill={ink}>{i*10}</text></g>})}<path d="M160 148H280M160 148L220 44" stroke="#bf4d21" strokeWidth="2.5"/><text x="180" y="130" fill={ink} fontSize="12">60°</text></>}
  {diagram==='coordinate-grid'&&<>{Array.from({length:9},(_,i)=><g key={i}><path d={`M${96+i*16} 18v144M88 ${26+i*16}h144`} stroke="#bfd4e6"/></g>)}<path d="M160 10V170M80 90H240" stroke={ink} strokeWidth="2"/><text x="165" y="16" fill={ink} fontSize="12">y</text><text x="244" y="94" fill={ink} fontSize="12">x</text><path d="M96 138L224 42" stroke={stroke} strokeWidth="3"/></>}
  {diagram==='counters'&&<>{Array.from({length:20},(_,i)=><circle key={i} cx={50+(i%5)*55} cy={28+Math.floor(i/5)*40} r="14" fill={i<10?fill:'#f9d477'} stroke={ink}/>)}</>}
  {diagram==='base-ten'&&<><rect x="22" y="35" width="100" height="100" fill={fill} stroke={ink}/>{Array.from({length:9},(_,i)=><path key={i} d={`M${32+i*10} 35v100M22 ${45+i*10}h100`} stroke={ink}/>)}{[0,1,2].map(i=><g key={i}><rect x={150+i*22} y="35" width="10" height="100" fill="#f9d477" stroke={ink}/>{Array.from({length:9},(_,j)=><path key={j} d={`M${150+i*22} ${45+j*10}h10`} stroke={ink}/>)}</g>)}{[0,1,2,3].map(i=><rect key={i} x={236+(i%2)*20} y={70+Math.floor(i/2)*20} width="10" height="10" fill={fill} stroke={ink}/>)}<text x="160" y="158" textAnchor="middle" fill={ink}>100 + 30 + 4 = 134</text></>}
  {diagram==='clock'&&<><circle cx="160" cy="90" r="72" fill="white" stroke={stroke} strokeWidth="2"/>{Array.from({length:12},(_,i)=><text key={i} x={160+57*Math.sin(i*Math.PI/6)} y={94-57*Math.cos(i*Math.PI/6)} textAnchor="middle" fill={ink} fontSize="13">{i||12}</text>)}<path d="M160 90L128 72M160 90V143" stroke={ink} strokeWidth="4" strokeLinecap="round"/><circle cx="160" cy="90" r="4" fill={ink}/></>}
  {diagram==='money'&&<>{[1,5,10,20].map((n,i)=><g key={n}><circle cx={53+i*71} cy="86" r="30" fill={i%2?'#ebd393':'#dbe1e5'} stroke={ink} strokeWidth="2"/><text x={53+i*71} y="90" textAnchor="middle" fontSize="13" fill={ink}>KSh {n}</text></g>)}<text x="160" y="142" textAnchor="middle" fill={ink} fontSize="12">Illustrative coin values</text></>}
  {diagram==='solids'&&<><path d="M25 65l28 -24h72v74l-28 24H25ZM25 65h72l28 -24M97 65v74" fill={fill} fillOpacity=".6" stroke={stroke} strokeWidth="2"/><path d="M180 58v73a44 17 0 0 0 88 0V58" fill={fill} fillOpacity=".55" stroke={stroke} strokeWidth="2"/><ellipse cx="224" cy="58" rx="44" ry="17" fill="#e8f4fb" stroke={stroke} strokeWidth="2"/><text x="74" y="162" textAnchor="middle" fill={ink}>Cuboid</text><text x="224" y="162" textAnchor="middle" fill={ink}>Cylinder</text></>}
  {diagram==='handwriting'&&<>{[30,60,90,120,150].map(y=><path key={y} d={`M15 ${y}H305`} stroke={y===60||y===120?'#9ab6cd':stroke} strokeDasharray={y===60||y===120?'5 5':undefined}/>)}</>}
  {diagram==='music'&&<>{[45,60,75,90,105].map(y=><path key={y} d={`M20 ${y}H300`} stroke={ink}/>)}{[105,90,75,60].map((y,i)=><g key={i}><ellipse cx={62+i*60} cy={y} rx="8" ry="5" fill={ink} transform={`rotate(-15 ${62+i*60} ${y})`}/><path d={`M${69+i*60} ${y}v-35`} stroke={ink} strokeWidth="2"/></g>)}</>}
 </svg>
}
export function SlideCanvas({slide,number,total,mini=false}:{slide:LiveSlide;number:number;total:number;mini?:boolean}){
 return <div className={styles.presentationCanvas} data-theme={slide.theme??'paper'} data-layout={slide.layout??'wide'} data-font={slide.font??'normal'} data-mini={mini}>
  <div className={styles.presentationKicker}><span>VibeSchool · Slides</span><span>{number} / {total}</span></div>
  <div className={styles.presentationBody}><h2>{slide.title||'Untitled slide'}</h2>{slide.diagram&&slide.diagram!=='none'&&<TeachingDiagram diagram={slide.diagram}/>}<p>{slide.body}</p></div>
 </div>
}
