'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { palette, templates, type Template } from '@/components/success-wishes/card-themes'
import { SENDER_DRAFT_KEY, decodeSenderDraft } from '@/lib/success-wishes/sender-draft'

type TextKey = 'name' | 'message' | 'sender'
type Position = { x: number; y: number; size: number }
const defaults: Record<TextKey, Position> = {
  name: { x: 50, y: 25, size: 66 },
  message: { x: 50, y: 63, size: 34 },
  sender: { x: 50, y: 84, size: 30 },
}
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

export default function CardCustomiser() {
  const [theme, setTheme] = useState<Template>('heritage')
  const [name, setName] = useState('Your student')
  const [message, setMessage] = useState('Wishing you good luck & success!')
  const [sender, setSender] = useState('With love')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoScale, setPhotoScale] = useState(1)
  const [photoPosition, setPhotoPosition] = useState({x:50,y:46})
  const [positions, setPositions] = useState(defaults)
  const [activeText, setActiveText] = useState<TextKey>('name')
  const canvas = useRef<HTMLDivElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLImageElement>(null)
  const textValues = { name, message, sender }
  const themeColors = palette[theme]
  useEffect(() => {
    try {
      const draft = decodeSenderDraft(sessionStorage.getItem(SENDER_DRAFT_KEY))
      if (!draft) return
      setTheme(draft.theme)
      if (draft.candidate) setName(draft.candidate)
      if (draft.message) setMessage(draft.message)
      if (draft.sender) setSender(draft.sender)
    } catch { /* The editor works without saved form data. */ }
  }, [])
  const drag = useRef<{type:TextKey|'photo';offsetX:number;offsetY:number}|null>(null)
  useEffect(() => () => { if (photo?.startsWith('blob:')) URL.revokeObjectURL(photo) }, [photo])
  function onFile(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { alert('Choose a JPG, PNG or WebP image under 10 MB.'); return }
    setPhoto(URL.createObjectURL(file));setPhotoScale(1);setPhotoPosition({x:50,y:46})
  }
  function startDrag(e: React.PointerEvent, type:TextKey|'photo') {
    e.preventDefault()
    const rect=canvas.current?.getBoundingClientRect()
    if (!rect) return
    const pos=type==='photo'?photoPosition:positions[type]
    drag.current={type,offsetX:(e.clientX-rect.left)/rect.width*100-pos.x,offsetY:(e.clientY-rect.top)/rect.height*100-pos.y}
    if(type!=='photo') setActiveText(type)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function moveDrag(e: React.PointerEvent) {
    const current=drag.current, rect=canvas.current?.getBoundingClientRect()
    if(!current||!rect)return
    const x=clamp((e.clientX-rect.left)/rect.width*100-current.offsetX,5,95)
    const y=clamp((e.clientY-rect.top)/rect.height*100-current.offsetY,5,95)
    if(current.type==='photo')setPhotoPosition({x,y})
    else setPositions(prev=>({...prev,[current.type]:{...prev[current.type],x,y}}))
  }
  async function download() {
    const width=1080,height=1920
    const output=document.createElement('canvas');output.width=width;output.height=height
    const ctx=output.getContext('2d');if(!ctx)return
    // Wait until the uploaded file has decoded before exporting.
    if (photo && photoRef.current) {
      try { await photoRef.current.decode() } catch { alert('The photo is not ready. Try again.'); return }
    }
    const gradient=ctx.createLinearGradient(0,0,0,height)
    gradient.addColorStop(0,themeColors.top);gradient.addColorStop(1,themeColors.bottom)
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height)
    ctx.strokeStyle=themeColors.border;ctx.lineWidth=12;ctx.strokeRect(44,44,width-88,height-88)
    if(photo&&photoRef.current?.complete&&photoRef.current.naturalWidth) {
      const img=photoRef.current, cx=photoPosition.x/100*width,cy=photoPosition.y/100*height
      ctx.save();ctx.beginPath();ctx.roundRect(cx-310,cy-370,620,740,30);ctx.clip()
      const cover=Math.max(620/img.naturalWidth,740/img.naturalHeight)
      const w=img.naturalWidth*cover*photoScale,h=img.naturalHeight*cover*photoScale
      ctx.drawImage(img,cx-w/2,cy-h/2,w,h);ctx.restore()
    }
    const draw=(key:TextKey, text:string)=>{
      const p=positions[key], font=p.size*2.25
      ctx.fillStyle=themeColors.ink;ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.font=`600 ${font}px Georgia, serif`
      const words=text.split(/\s+/), lines:string[]=[];let line=''
      for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>width-160&&line){lines.push(line);line=word}else line=test}
      if(line)lines.push(line)
      const lh=font*1.18
      lines.forEach((part,i)=>ctx.fillText(part,p.x/100*width,p.y/100*height+(i-(lines.length-1)/2)*lh,width-120))
    }
    draw('name',name);draw('message',message);draw('sender',sender)
    ctx.textAlign='center';ctx.font='28px Arial';ctx.fillStyle=themeColors.ink;ctx.fillText('VIBESCHOOL • SUCCESS WISHES 2026',width/2,height-95)
    const link=document.createElement('a');link.download='vibeschool-success-card.png';link.href=output.toDataURL('image/png');link.click()
  }
  return <main style={{maxWidth:1020,margin:'0 auto',padding:'24px 16px',color:'#202938'}}>
    <Link href="/success-wishes">← Back to Success Wishes</Link>
    <h1 style={{fontSize:28,margin:'20px 0 4px'}}>Customise your Success Card</h1>
    <p style={{margin:'0 0 20px'}}>Optional design playground. Your purchase and receiver card are unchanged.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:24}}>
      <section style={{display:'grid',gap:14,alignContent:'start'}}>
        <label>Design<select value={theme} onChange={e=>setTheme(e.target.value as Template)} style={{display:'block',width:'100%',padding:10}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {([['name','Student name',name,setName],['message','Message',message,setMessage],['sender','From',sender,setSender]] as const).map(([key,label,value,setValue])=><label key={key}>{label}<input value={value} maxLength={key==='message'?140:60} onFocus={()=>setActiveText(key)} onChange={e=>setValue(e.target.value)} style={{display:'block',width:'100%',padding:10}}/></label>)}
        <label>Choose text element<select value={activeText} onChange={e=>setActiveText(e.target.value as TextKey)} style={{display:'block',padding:10,width:'100%'}}><option value="name">Name</option><option value="message">Message</option><option value="sender">Sender</option></select></label>
        <label>Text size: {positions[activeText].size}<input type="range" min="18" max="90" value={positions[activeText].size} onChange={e=>setPositions(p=>({...p,[activeText]:{...p[activeText],size:Number(e.target.value)}}))} style={{display:'block',width:'100%'}}/></label>
        <button type="button" onClick={()=>photoInput.current?.click()}>Add / Replace photo</button>
        <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>onFile(e.target.files?.[0])}/>
        {photo&&<><label>Photo zoom<input type="range" min="1" max="2.5" step=".05" value={photoScale} onChange={e=>setPhotoScale(Number(e.target.value))} style={{display:'block',width:'100%'}}/></label><button type="button" onClick={()=>setPhoto(null)}>Remove photo</button></>}
        <button type="button" onClick={()=>{setPositions(defaults);setPhotoPosition({x:50,y:46});setPhotoScale(1)}}>Reset positions</button>
        <button type="button" onClick={download} style={{padding:14,background:'#203859',color:'white',border:0,borderRadius:8}}>Download status card (PNG)</button>
      </section>
      <section>
        <p>Drag the photo or any text to reposition it.</p>
        <div ref={canvas} style={{position:'relative',width:'100%',aspectRatio:'9 / 16',overflow:'hidden',background:`linear-gradient(180deg,${themeColors.top},${themeColors.bottom})`,border:`9px double ${themeColors.border}`,borderRadius:14,touchAction:'none',containerType:'inline-size'}}>
          {photo&&<div onPointerDown={e=>startDrag(e,'photo')} onPointerMove={moveDrag} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} style={{position:'absolute',left:photoPosition.x+'%',top:photoPosition.y+'%',transform:'translate(-50%,-50%)',width:'58%',height:'39%',overflow:'hidden',borderRadius:12,cursor:'grab',touchAction:'none'}}><img ref={photoRef} src={photo} alt="Uploaded student" style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${photoScale})`,pointerEvents:'none'}}/></div>}
          {(['name','message','sender'] as TextKey[]).map(key=><div key={key} onPointerDown={e=>startDrag(e,key)} onPointerMove={moveDrag} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} style={{position:'absolute',left:positions[key].x+'%',top:positions[key].y+'%',transform:'translate(-50%,-50%)',width:'88%',textAlign:'center',color:themeColors.ink,font:`600 ${positions[key].size*0.2083}cqw Georgia,serif`,whiteSpace:'pre-wrap',overflowWrap:'anywhere',cursor:'grab',touchAction:'none',textShadow:'0 1px 5px rgba(255,255,255,.45)',outline:activeText===key?'1px dashed currentColor':'none'}}>{textValues[key]}</div>)}
          <div style={{position:'absolute',bottom:'3%',width:'100%',textAlign:'center',color:themeColors.ink,fontSize:10,pointerEvents:'none'}}>VIBESCHOOL · SUCCESS WISHES 2026</div>
        </div>
      </section>
    </div>
  </main>
}
