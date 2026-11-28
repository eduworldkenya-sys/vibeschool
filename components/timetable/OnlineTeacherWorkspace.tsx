'use client'

import {useEffect,useState,type ReactNode} from 'react'
import Link from 'next/link'
import {ArrowLeft,ArrowRight,BookOpen,CalendarDays,ChevronLeft,ChevronRight,ClipboardList,House,Lock,MessageCircle,Presentation,UserRound,Users,Video,Wallet,ChartNoAxesColumn} from 'lucide-react'
import {tuitionLocalDate,tuitionLocalTime,tuitionLessonsBetween,useTuitionTimetable,type TuitionTimetableLesson} from './TuitionTimetable'
import {tuitionLessonState} from '@/lib/vibetutor/lessonLifecycle'
import styles from './OnlineTeacherWorkspace.module.css'

const dates=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short'})
const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const scheduleHref='/teacher/tutoring/students?tool=lessons'
const availabilityHref='/vibetutor/availability'
const home='/onlineteacherv1'
function dayAt(date:string,offset:number){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function monday(date:string){return dayAt(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7))}
function label(date:string){return dates.format(new Date(date+'T00:00:00Z'))}
function LessonItem({lesson,now}:{lesson:TuitionTimetableLesson;now:number}){
 const state=tuitionLessonState(lesson,now)
 const text={upcoming:'Scheduled',joinable:'Ready to join',ended:'Ended',cancelled:'Cancelled',completed:'Completed',unavailable:'Unavailable'}[state]
 const url=state==='joinable'?'/tuition/lessons/'+encodeURIComponent(lesson.id):scheduleHref
 return <Link className={styles.booking} data-state={state} href={url} aria-label={lesson.title+', '+tuitionLocalTime(lesson.starts_at)+', '+text}>
   <time dateTime={lesson.starts_at}>{tuitionLocalTime(lesson.starts_at)}–{tuitionLocalTime(lesson.ends_at)}</time>
   <strong>{lesson.title}</strong><small>{text}{state==='joinable'?' · Join':''}</small>
 </Link>
}

export default function OnlineTeacherWorkspace({children,back='/teacher/pulse',scheduleOnly=false}:{children?:ReactNode;back?:string;scheduleOnly?:boolean}){
 const {lessons,error,loading,refresh}=useTuitionTimetable()
 const [now,setNow]=useState(()=>Date.now())
 const [offset,setOffset]=useState(0)
 useEffect(()=>{const tick=()=>setNow(Date.now());const timer=window.setInterval(tick,30_000);const wake=()=>{tick();refresh()};window.addEventListener('focus',wake);window.addEventListener('online',wake);return()=>{window.clearInterval(timer);window.removeEventListener('focus',wake);window.removeEventListener('online',wake)}},[refresh])
 const today=tuitionLocalDate(new Date(now).toISOString())
 const start=dayAt(monday(today),7*offset)
 const days=Array.from({length:7},(_,i)=>dayAt(start,i))
 const week=tuitionLessonsBetween(lessons,start,days[6])
 const upcoming=lessons.filter(l=>['upcoming','joinable'].includes(tuitionLessonState(l,now))).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))
 const next=upcoming[0]
 const ready=!loading&&!error
 const completed=week.filter(l=>tuitionLessonState(l,now)==='completed').length
 return <main id="workspace-home" className={styles.workspace}>
  <header className={styles.header}><Link className={styles.back} href={scheduleOnly?home:back}><ArrowLeft size={18}/><span>{scheduleOnly?'Home':'Teacher workspace'}</span></Link><div className={styles.brand}><span>VibeSchool</span><h1>{scheduleOnly?'My schedule':'Online teaching'}</h1></div><Link className={styles.profile} href="/vibetutor/become-tutor" aria-label="Tutor profile"><UserRound size={22}/></Link></header>
  {!scheduleOnly&&<section className={styles.hero} id="teach" aria-label="Teaching controls"><div><small>YOUR TEACHING WORKSPACE</small><h2>Ready to teach?</h2><p>Start an instant class or prepare your next lesson.</p></div><div className={styles.heroActions}>{children}</div></section>}
  {!scheduleOnly&&<section className={styles.summary} aria-label="Schedule insights" id="insights">
    <div><span>Upcoming lessons</span><strong>{ready?upcoming.length:'—'}</strong></div>
    <div><span>This week</span><strong>{ready?week.filter(l=>l.status==='scheduled').length:'—'}</strong></div>
    <div><span>Completed this week</span><strong>{ready?completed:'—'}</strong></div>
  </section>}
  {!scheduleOnly&&ready&&next&&<section className={styles.next} aria-label="Next scheduled lesson"><div><small>NEXT SCHEDULED LESSON</small><h2>{next.title}</h2><p>{label(tuitionLocalDate(next.starts_at))} · {tuitionLocalTime(next.starts_at)}–{tuitionLocalTime(next.ends_at)} EAT</p></div><Link className={styles.action} href={tuitionLessonState(next,now)==='joinable'?'/tuition/lessons/'+encodeURIComponent(next.id):scheduleHref}>{tuitionLessonState(next,now)==='joinable'?'Join lesson':'Lesson details'}<ArrowRight size={16}/></Link></section>}
  <section className={styles.calendar} id="schedule" aria-label="My teaching schedule">
   <div className={styles.calendarHead}><div><h2>My teaching schedule</h2><p>East Africa Time (EAT)</p></div><div className={styles.weekControls}><button type="button" aria-label="Previous week" onClick={()=>setOffset(v=>v-1)}><ChevronLeft size={19}/></button><strong>{label(start)} – {label(days[6])} {days[6].slice(0,4)}</strong><button type="button" aria-label="Next week" onClick={()=>setOffset(v=>v+1)}><ChevronRight size={19}/></button><button type="button" onClick={()=>setOffset(0)}>Today</button></div></div>
   <div className={styles.calendarActions}><Link className={styles.action} href={scheduleHref}>Schedule lesson</Link><Link className={styles.secondary} href={availabilityHref}>Set availability</Link><button type="button" onClick={refresh} disabled={loading}>Refresh</button></div>
   {loading?<p role="status" className={styles.notice}>Loading your lessons…</p>:error?<div role="alert" className={styles.notice}>Could not load your schedule. <button type="button" onClick={refresh}>Retry schedule</button></div>:<div className={styles.week}>
    {days.map((date,i)=>{const entries=week.filter(l=>tuitionLocalDate(l.starts_at)===date);return <section key={date} className={styles.day} data-today={date===today} aria-label={weekdays[i]+' '+label(date)}>
      <header><span>{weekdays[i]}</span><strong>{date.slice(-2).replace(/^0/,'')}</strong><small>{label(date)}</small></header>
      {entries.length?entries.map(l=><LessonItem key={l.id} lesson={l} now={now}/>):<div className={styles.empty}>No lessons</div>}
    </section>})}
   </div>}
   <footer className={styles.legend}><span><i/>Scheduled</span><span><i/>No lesson booked</span><small>Unbooked time is not confirmed availability.</small></footer>
  </section>
  {!scheduleOnly&&<section aria-label="Teaching tools" className={styles.tools}><h2>Workspace</h2><div className={styles.tiles}>
    {[
      {name:'Schedule',detail:'Weekly bookings',icon:CalendarDays,href:'#schedule'},
      {name:'My learners',detail:'Learners and groups',icon:Users,href:'/teacher/tutoring/students'},
      {name:'Live Studio',detail:'Prepare and rehearse',icon:Presentation,href:'#teach'},
      {name:'Earnings',detail:'Not enabled yet',icon:Wallet,href:null},
      {name:'VibeChat',detail:'Messages',icon:MessageCircle,href:'/vibechat'},
      {name:'Resources',detail:'Teaching library',icon:BookOpen,href:'/teacher/resources'},
      {name:'Insights',detail:'Schedule overview',icon:ChartNoAxesColumn,href:'#insights'},
      {name:'Tutor profile',detail:'Subjects and rates',icon:UserRound,href:'/vibetutor/become-tutor'},
      {name:'Assignments',detail:'Tasks and feedback',icon:ClipboardList,href:'/teacher/tutoring/students?tool=tasks'}
    ].map(({name,detail,icon:Icon,href})=>href?<Link key={name} className={styles.tile} href={href}><Icon size={21}/><strong>{name}</strong><small>{detail}</small></Link>:<div key={name} className={styles.tile} aria-disabled="true"><Wallet size={21}/><strong>{name} <Lock size={13}/></strong><small>{detail}</small></div>)}
  </div></section>}
  <nav className={styles.nav} aria-label="Online teacher navigation">
    <Link href={scheduleOnly?home:'#workspace-home'} aria-current={!scheduleOnly?'page':undefined}><House size={20}/>Home</Link>
    <Link href={scheduleOnly?'#schedule':'#schedule'} aria-current={scheduleOnly?'page':undefined}><CalendarDays size={20}/>Schedule</Link>
    <Link href={scheduleOnly?home+'#teach':'#teach'}><Video size={20}/>Teach</Link>
    <Link href="/vibechat"><MessageCircle size={20}/>Chat</Link>
    <Link href="/vibetutor/become-tutor"><UserRound size={20}/>Profile</Link>
  </nav>
 </main>
}
