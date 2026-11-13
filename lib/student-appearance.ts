import type { CSSProperties } from 'react'

/** Local learner appearance. It never changes grades, assessment state or permissions. */
export type LearnerPalette = 'jade' | 'ocean' | 'sunset' | 'midnight'
export type LearnerFont = 'modern' | 'rounded' | 'editorial'
export type LearnerWallpaper = 'sage' | 'paper' | 'sky' | 'pattern' | 'photo'
export type LearnerAppearance = {
  palette: LearnerPalette
  font: LearnerFont
  italicHeadings: boolean
  largeText: boolean
  compact: boolean
  reduceMotion: boolean
  wallpaper: LearnerWallpaper
}
export const LEARNER_APPEARANCE_EVENT = 'vibeschool:learner-appearance-changed'
export const DEFAULT_LEARNER_APPEARANCE: LearnerAppearance = {
  palette: 'jade', font: 'modern', italicHeadings: true, largeText: false,
  compact: false, reduceMotion: false, wallpaper: 'sage',
}
const palettes: readonly LearnerPalette[] = ['jade','ocean','sunset','midnight']
const fonts: readonly LearnerFont[] = ['modern','rounded','editorial']
const wallpapers: readonly LearnerWallpaper[] = ['sage','paper','sky','pattern','photo']
const appearanceKey = (studentId:string) => 'vibeschool:learner-appearance:v1:' + studentId
const imageKey = (studentId:string) => 'vibeschool:learner-wallpaper:v1:' + studentId
const oneOf = <T extends string>(value:unknown, allowed:readonly T[], fallback:T):T =>
  typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback

export function readLearnerAppearance(studentId:string|null|undefined):LearnerAppearance {
  if (!studentId || typeof window === 'undefined') return {...DEFAULT_LEARNER_APPEARANCE}
  try {
    const data = JSON.parse(localStorage.getItem(appearanceKey(studentId)) || '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {...DEFAULT_LEARNER_APPEARANCE}
    return {
      palette: oneOf(data.palette,palettes,'jade'),
      font: oneOf(data.font,fonts,'modern'),
      wallpaper: oneOf(data.wallpaper,wallpapers,'sage'),
      italicHeadings: typeof data.italicHeadings==='boolean' ? data.italicHeadings : true,
      largeText: data.largeText===true, compact:data.compact===true, reduceMotion:data.reduceMotion===true,
    }
  } catch {return {...DEFAULT_LEARNER_APPEARANCE}}
}
export function saveLearnerAppearance(studentId:string,appearance:LearnerAppearance):boolean {
  if (typeof window === 'undefined' || !studentId) return false
  try {
    localStorage.setItem(appearanceKey(studentId),JSON.stringify(appearance))
    window.dispatchEvent(new Event(LEARNER_APPEARANCE_EVENT))
    return true
  } catch {return false}
}
export function readLearnerWallpaperPhoto(studentId:string|null|undefined):string|null {
  if (!studentId || typeof window === 'undefined') return null
  try {
    const result=localStorage.getItem(imageKey(studentId))
    return result && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(result) && result.length < 620000
      ? result : null
  } catch {return null}
}
export function saveLearnerWallpaperPhoto(studentId:string,dataUrl:string|null):boolean {
  if (!studentId || typeof window==='undefined') return false
  try {
    if(dataUrl && (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl)||dataUrl.length>=620000)) return false
    if(dataUrl)localStorage.setItem(imageKey(studentId),dataUrl)
    else localStorage.removeItem(imageKey(studentId))
    window.dispatchEvent(new Event(LEARNER_APPEARANCE_EVENT))
    return true
  } catch {return false}
}
type CustomStyle = CSSProperties & Record<`--vs-${string}`,string>
const TOKENS: Record<Exclude<LearnerPalette,'jade'>,Record<string,string>> = {
  ocean: {bg:'#f4f7fc',surface:'#ffffff',border:'#dfe7f4',text:'#1c304c',muted:'#657894',accent:'#245eae','accent-soft':'#eaf2ff',success:'#187b58',warning:'#a15d1b',error:'#b93434',card:'#ffffff',soft:'#edf3fc','nav-bg':'#ffffff','nav-border':'#dfe7f4','on-accent':'#ffffff'},
  sunset:{bg:'#faf7f4',surface:'#ffffff',border:'#eaddd5',text:'#45332b',muted:'#837268',accent:'#a4563b','accent-soft':'#fff0e8',success:'#16744b',warning:'#a15d1b',error:'#b93434',card:'#ffffff',soft:'#f8eee8','nav-bg':'#ffffff','nav-border':'#eaddd5','on-accent':'#ffffff'},
  midnight:{bg:'#171d2a',surface:'#252e40',border:'#3d485e',text:'#f3f5ff',muted:'#b4bfd4',accent:'#9fb5ff','accent-soft':'#313f62',success:'#85d8a5',warning:'#ffcc86',error:'#ffaaaa',card:'#252e40',soft:'#2a3449','nav-bg':'#252e40','nav-border':'#3d485e','on-accent':'#171d2a'}
}
export function learnerAppearanceStyle(appearance:LearnerAppearance):CSSProperties {
  const tokens:Record<string,string> = appearance.palette==='jade' ? {} : TOKENS[appearance.palette]
  const result:Record<string,string|number> = {
    fontFamily: appearance.font==='editorial' ? 'Georgia, Cambria, serif'
      :appearance.font==='rounded' ? "'Nunito Sans', 'Trebuchet MS', sans-serif"
      :"'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize:appearance.largeText?'16px':'14px',
    '--vs-learner-italic':appearance.italicHeadings?'italic':'normal',
  }
  for(const [k,v] of Object.entries(tokens)) result['--vs-'+k]=v
  return result as CustomStyle
}
