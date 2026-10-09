'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { teacherTabs, teacherTools, teacherTabForPath, type TeacherTab } from './navigation'

export default function TeacherNavigation() {
  const pathname = usePathname()
  const active = teacherTabForPath(pathname)
  const [open, setOpen] = useState<TeacherTab | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  useEffect(() => setOpen(null), [pathname])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(null)
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      trigger.current?.focus()
    }
  }, [open])

  const currentLink = (href: string) => {
    const candidates = Object.values(teacherTools).flat().filter(tool => pathname === tool.href || pathname.startsWith(tool.href + '/'))
    return candidates.sort((a,b) => b.href.length-a.href.length)[0]?.href === href
  }
  return <>
    <aside className="teacher-sidebar" aria-label="Teacher workspace">
      <Link className="teacher-sidebar__brand" href="/teacher/pulse"><span className="teacher-brand-mark">V</span><span>VibeSchool<small>Teacher workspace</small></span></Link>
      <nav aria-label="Desktop Teacher navigation">
        <section className="teacher-sidebar__primary">
          {teacherTabs.map(tab => <Link key={tab.id} href={tab.href} className="teacher-sidebar__link" data-active={active === tab.id}><tab.icon size={19} aria-hidden="true"/><span>{tab.label === 'Me' ? 'My workspace' : tab.label}</span></Link>)}
        </section>
        <section>
          <h2>{active === 'me' ? 'My workspace' : teacherTabs.find(tab=>tab.id===active)?.label} tools</h2>
          {teacherTools[active].map(tool => <Link key={tool.href} href={tool.href} className="teacher-sidebar__link" aria-current={currentLink(tool.href) ? 'page' : undefined}><tool.icon size={18} aria-hidden="true"/><span>{tool.label}</span></Link>)}
        </section>
        {active !== 'me' && <section className="teacher-sidebar__footer"><Link href="/teacher/more" className="teacher-sidebar__link">All tools<ArrowUpRight size={15} aria-hidden="true"/></Link><Link href="/teacher/help" className="teacher-sidebar__link">Help & support<ArrowUpRight size={15} aria-hidden="true"/></Link></section>}
      </nav>
    </aside>
    {open && <div className="teacher-nav-overlay" onClick={() => setOpen(null)}>
      <div ref={dialog} className="teacher-nav-sheet" role="dialog" aria-modal="true" aria-labelledby="teacher-tools-title" onClick={event => event.stopPropagation()}>
        <div className="teacher-nav-sheet__handle" aria-hidden="true"/>
        <header><div><p className="teacher-eyebrow">Your workspace</p><h2 id="teacher-tools-title">{open === 'me' ? 'My tools' : teacherTabs.find(tab => tab.id === open)?.label}</h2></div><button type="button" className="teacher-icon-button" aria-label="Close tools" onClick={() => setOpen(null)}><X size={20}/></button></header>
        <div className="teacher-nav-sheet__tools">
          {teacherTools[open].map(tool => <Link key={tool.href} href={tool.href} onClick={() => setOpen(null)} aria-current={currentLink(tool.href) ? 'page' : undefined}><tool.icon size={22} aria-hidden="true"/><span>{tool.label}</span><ArrowUpRight className="teacher-tool-arrow" size={15} aria-hidden="true"/></Link>)}
        </div>
      </div>
    </div>}
    <nav className="teacher-bottom-nav" aria-label="Teacher navigation">
      {teacherTabs.map(tab => tab.id === 'today' ? <Link key={tab.id} href={tab.href} aria-current={active === tab.id ? 'page' : undefined}><tab.icon size={22} aria-hidden="true"/><span>{tab.label}</span></Link> : <button key={tab.id} type="button" aria-label={`Open ${tab.label} tools`} aria-expanded={open === tab.id} aria-haspopup="dialog" data-active={active === tab.id || open === tab.id} onClick={event => { trigger.current = event.currentTarget; setOpen(previous => previous === tab.id ? null : tab.id) }}><tab.icon size={22} aria-hidden="true"/><span>{tab.label}</span></button>)}
    </nav>
  </>
}
