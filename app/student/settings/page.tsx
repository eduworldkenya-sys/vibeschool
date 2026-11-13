'use client'
export const dynamic = 'force-dynamic'

import {useEffect,useState,type ChangeEvent} from 'react'
import Link from 'next/link'
import {useStudent} from '@/lib/student-context'
import {DEFAULT_LEARNER_APPEARANCE,readLearnerAppearance,saveLearnerAppearance,readLearnerWallpaperPhoto,saveLearnerWallpaperPhoto,type LearnerAppearance,type LearnerFont,type LearnerPalette,type LearnerWallpaper} from '@/lib/student-appearance'
import styles from './settings.module.css'

type Section = 'appearance'|'reading'|'study'|'permissions'
const PALETTES:{id:LearnerPalette;title:string;bg:string;accent:string}[]=[
  {id:'jade',title:'Jade',bg:'#e0f1e5',accent:'#186b4c'},
  {id:'ocean',title:'Ocean',bg:'#e1efff',accent:'#245eae'},
  {id:'sunset',title:'Sunset',bg:'#fae5d8',accent:'#a4563b'},
  {id:'midnight',title:'Midnight',bg:'#252e40',accent:'#9fb5ff'}
]
const WALLPAPERS:{id:Exclude<LearnerWallpaper,'photo'>;title:string}[]=[
  {id:'sage',title:'Sage'}, {id:'paper',title:'Paper'}, {id:'sky',title:'Sky'}, {id:'pattern',title:'Pattern'}
]
function wallpaperStyle(wallpaper:LearnerWallpaper, photo:string|null):React.CSSProperties {
  if(wallpaper==='photo'&&photo) return {backgroundImage:`url("${photo}")`}
  if(wallpaper==='paper')return {background:'linear-gradient(135deg,#f6e9d9,#e9ddd0)'}
  if(wallpaper==='sky')return {background:'linear-gradient(145deg,#d0e9ff,#a2bbec)'}
  if(wallpaper==='pattern')return {backgroundColor:'#cfe9dc',backgroundImage:'radial-gradient(#7db69b 1px,transparent 1px)',backgroundSize:'18px 18px'}
  return {background:'linear-gradient(135deg,#dcefe5,#c7e9dd)'}
}
async function compressWallpaper(file:File):Promise<string> {
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Choose a JPEG, PNG or WebP photo.')
  if(file.size>5*1024*1024)throw new Error('The photo must be smaller than 5 MB.')
  const url=URL.createObjectURL(file)
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image()
      img.onload=()=>resolve(img); img.onerror=()=>reject(new Error('This image cannot be opened.'));img.src=url
    })
    const scale=Math.min(1,960/Math.max(image.naturalWidth,image.naturalHeight))
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale))
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
    const ctx=canvas.getContext('2d')
    if(!ctx)throw new Error('Image processing is unavailable on this device.')
    ctx.drawImage(image,0,0,canvas.width,canvas.height)
    for(const quality of [0.78,0.62,0.46]){
      const data=canvas.toDataURL('image/jpeg',quality)
      if(data.length<620000)return data
    }
    throw new Error('This photo could not be compressed enough for device storage.')
  }finally{URL.revokeObjectURL(url)}
}
export default function LearnerSettingsPage(){
  const {identity,loading}=useStudent()
  const [tab,setTab]=useState<Section>('appearance')
  const [value,setValue]=useState<LearnerAppearance>(DEFAULT_LEARNER_APPEARANCE)
  const [photo,setPhoto]=useState<string|null>(null)
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [notifications,setNotifications]=useState('unsupported')
  useEffect(()=>{
    if(!identity?.studentId)return
    setValue(readLearnerAppearance(identity.studentId))
    setPhoto(readLearnerWallpaperPhoto(identity.studentId))
    setNotifications(typeof window!=='undefined'&&'Notification'in window?Notification.permission:'unsupported')
    const section=new URLSearchParams(window.location.search).get('section')
    if(section==='appearance'||section==='reading'||section==='study'||section==='permissions')setTab(section)
  },[identity?.studentId])
  function change(patch:Partial<LearnerAppearance>){
    if(!identity?.studentId)return
    const next={...value,...patch}
    if(!saveLearnerAppearance(identity.studentId,next)){setNotice('Preferences could not be stored on this device.');return}
    setValue(next);setNotice('')
  }
  async function upload(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value=''
    if(!file||!identity?.studentId)return
    setBusy(true);setNotice('')
    try{
      const encoded=await compressWallpaper(file)
      if(!saveLearnerWallpaperPhoto(identity.studentId,encoded))throw new Error('This browser could not store your image.')
      setPhoto(encoded);change({wallpaper:'photo'});setNotice('Workspace photo saved on this device only.')
    }catch(error){setNotice(error instanceof Error?error.message:'Could not use this photo.')}
    finally{setBusy(false)}
  }
  async function enableNotifications(){
    if(typeof window==='undefined'||!('Notification'in window)){setNotice('Browser notifications are not supported here.');return}
    try{
      const permission=await Notification.requestPermission()
      setNotifications(permission)
      setNotice(permission==='granted'?'Browser notifications enabled.':'Permission was not granted. You can change it in your browser settings.')
    }catch{setNotice('Permission request failed. Check your browser settings.')}
  }
  if(loading||!identity)return <div className={styles.page} role="status">Opening learner settings…</div>
  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.eyebrow}>Personalisation</span><h1 className={styles.title}>Make VibeSchool yours.</h1>
      <p className={styles.muted}>Change how the app looks and feels. Your lessons, tasks and exams stay exactly where they are.</p></header>
    <nav className={styles.tabs} aria-label="Learner settings sections">
      {([['appearance','Themes'],['reading','Reading'],['study','Study Mode'],['permissions','Permissions']] as const).map(([id,label])=>
        <button type="button" role="tab" aria-selected={tab===id} key={id} onClick={()=>setTab(id)}>{label}</button>)}
    </nav>
    {tab==='appearance'&&<>
      <section className={styles.card}><h2>Choose your colour theme</h2><p className={styles.muted}>Consistent colours across your learner workspace. Exam questions keep a distraction-free background.</p>
        <div className={styles.grid}>{PALETTES.map(p=><button key={p.id} type="button" className={styles.swatch} aria-pressed={value.palette===p.id} onClick={()=>change({palette:p.id})}>
          <div className={styles.color} style={{background:p.bg}}><span style={{background:p.accent}}/></div>{p.title}
        </button>)}</div>
        <div className={styles.row}><div><strong>Brightness</strong><p>Light, dark or follow your device. Every colour preset now supports both.</p></div>
          <select aria-label="Learner colour brightness" value={value.displayMode} onChange={e=>change({displayMode:e.target.value as 'light'|'dark'|'auto'})} className={styles.choice}>
            <option value="light">Light</option><option value="dark">Dark</option><option value="auto">Follow device</option>
          </select></div>
      </section>
      <section className={styles.card}><h2>Backgrounds and photos</h2><div className={styles.wall} style={wallpaperStyle(value.wallpaper,photo)}><strong>Your personal study corner</strong></div>
        <div className={styles.wallChoices}>{WALLPAPERS.map(w=><button key={w.id} className={styles.choice} aria-pressed={value.wallpaper===w.id} onClick={()=>change({wallpaper:w.id})}>{w.title}</button>)}
          {photo&&<button className={styles.choice} aria-pressed={value.wallpaper==='photo'} onClick={()=>change({wallpaper:'photo'})}>My photo</button>}</div>
        <div className={styles.row}><div><strong>Background placement</strong><p>Keep content cards solid, and exam answers distraction-free.</p></div>
          <select aria-label="Background placement" value={value.wallpaperPlacement} onChange={e=>change({wallpaperPlacement:e.target.value as 'workspace'|'home-workspace'})} className={styles.choice}>
            <option value="workspace">Workspace only</option><option value="home-workspace">Home + Workspace</option>
          </select></div>
        <label className={styles.field}>Add a background image (JPEG, PNG or WebP; 5 MB max)
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy}/></label>
        {photo&&<button className={styles.choice} type="button" onClick={()=>{if(saveLearnerWallpaperPhoto(identity.studentId,null)){setPhoto(null);change({wallpaper:'sage'});setNotice('Background photo removed from this browser.')}}}>Remove saved photo</button>}
        <div className={styles.notice}>Personal photos are compressed and stored in this browser, scoped to this learner identity. They are not uploaded to VibeSchool. Avoid personal photos on a shared device. Backgrounds never cover assessment answers.</div>
      </section>
    </>}
    {tab==='reading'&&<>
      <section className={styles.card}><h2>Fonts and reading</h2><div className={styles.wallChoices}>{([['modern','Modern'],['rounded','Friendly'],['editorial','Editorial']] as const).map(([font,label])=>
        <button className={styles.choice} aria-pressed={value.font===font} key={font} onClick={()=>change({font:font as LearnerFont})}>{label}</button>)}</div>
        <div className={styles.row}><div><strong>Expressive italic headings</strong><p>Gentle italics on selected headings, never whole examination questions.</p></div><button className={styles.toggle} aria-pressed={value.italicHeadings} onClick={()=>change({italicHeadings:!value.italicHeadings})}>{value.italicHeadings?'On':'Off'}</button></div>
        <div className={styles.row}><div><strong>Larger text</strong><p>Increase text for comfortable reading.</p></div><button className={styles.toggle} aria-pressed={value.largeText} onClick={()=>change({largeText:!value.largeText})}>{value.largeText?'On':'Off'}</button></div>
        <div className={styles.preview}><strong>Reading preview</strong><p>Every good question is a chance to learn something new.</p></div>
      </section>
      <section className={styles.card}><h2>Accessibility and motion</h2>
        <div className={styles.row}><div><strong>Compact layout</strong><p>Show more tools on wider screens.</p></div><button className={styles.toggle} aria-pressed={value.compact} onClick={()=>change({compact:!value.compact})}>{value.compact?'On':'Off'}</button></div>
        <div className={styles.row}><div><strong>Reduce animation</strong><p>Respect motion sensitivity in addition to device settings.</p></div><button className={styles.toggle} aria-pressed={value.reduceMotion} onClick={()=>change({reduceMotion:!value.reduceMotion})}>{value.reduceMotion?'On':'Off'}</button></div>
      </section>
    </>}
    {tab==='study'&&<>
      <section className={styles.card}><h2>Study modes</h2><p className={styles.muted}>Focus can also be turned on with one tap in the learner top bar. Your core navigation and work are always accessible.</p>
        <div className={styles.modeGrid}>{([
          ['normal','Everyday','Normal navigation and study reminders'],
          ['focus','Do Not Disturb','Quiet alerts and fewer social distractions'],
          ['reading','Reading Mode','Comfortable line spacing and distraction-free reading'],
        ] as const).map(([id,label,description])=>
          <button type="button" className={styles.modeChoice} key={id} aria-pressed={value.studyMode===id} onClick={()=>change({studyMode:id})}>
            <strong>{label}</strong><span>{description}</span><em>{value.studyMode===id?'Selected':'Choose'}</em>
          </button>)}</div>
        <div className={styles.row}><div><strong>Pause social links during study</strong><p>Pause links to common social websites within learner screens when Focus or Reading Mode is active.</p></div>
          <button className={styles.toggle} aria-pressed={value.pauseSocialLinks} onClick={()=>change({pauseSocialLinks:!value.pauseSocialLinks})}>{value.pauseSocialLinks?'On':'Off'}</button></div>
        <div className={styles.notice}>VibeSchool cannot block social-media apps, other browser tabs or device notifications. Use device Focus/Screen Time or parental controls for device-wide restrictions.</div>
      </section>
      <Link href="/student/study" className={styles.link}>Open my learning desk <span aria-hidden="true">›</span></Link>
    </>}
    {tab==='permissions'&&<>
      <section className={styles.card}><h2>Notifications and reminders</h2>
        <div className={styles.row}><div><strong>In-app study reminders</strong><p>See your due activities while VibeSchool is open, except in Focus or Reading Mode.</p></div><button className={styles.toggle} aria-pressed={value.remindersEnabled} onClick={()=>change({remindersEnabled:!value.remindersEnabled})}>{value.remindersEnabled?'On':'Off'}</button></div>
        <div className={styles.row}><div><strong>Browser notifications</strong><p>Current status: {notifications}. Only ask for permission when you choose to enable this.</p></div>
          {notifications==='default'?<button className={styles.button} onClick={()=>void enableNotifications()}>Enable</button>:<span className={styles.muted}>{notifications==='granted'?'Allowed':notifications==='denied'?'Blocked in browser':'Unavailable'}</span>}</div>
        <div className={styles.notice}>Focus and Reading Mode pause in-app reminders and VibeSchool browser reminders. Other apps are controlled in device settings.</div>
      </section>
      <section className={styles.card}><h2>Camera, microphone and privacy</h2>
        <div className={styles.row}><div><strong>Camera and photos</strong><p>Requested only if you choose to attach an image to work.</p></div><span className={styles.muted}>On demand</span></div>
        <div className={styles.row}><div><strong>Microphone</strong><p>Requested only when you start a speaking activity.</p></div><span className={styles.muted}>On demand</span></div>
        <div className={styles.row}><div><strong>School connection</strong><p>Optional. Your learner identity remains yours.</p></div><Link href="/student/claim" className={styles.link}>Connect</Link></div>
        <Link href="/student/guardian-consent" className={styles.link}>Guardian and email verification <span aria-hidden="true">›</span></Link>
      </section>
    </>}
    {notice&&<div role="status" className={notice.startsWith('Could')||notice.startsWith('This browser')?styles.error:styles.success}>{notice}</div>}
    <Link href="/student/workspace" className={styles.link}>Open my Workspace <span aria-hidden="true">›</span></Link>
  </main>
}
