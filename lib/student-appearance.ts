import type {CSSProperties} from 'react'

/** Local preferences, never used for grading, authority or curriculum decisions. */
export type LearnerPalette='jade'|'ocean'|'sunset'|'midnight'
export type LearnerFont='modern'|'rounded'|'editorial'
export type LearnerWallpaper='sage'|'paper'|'sky'|'pattern'|'photo'
export type LearnerDisplayMode='light'|'dark'|'auto'
export type LearnerStudyMode='normal'|'focus'|'reading'
export type LearnerWallpaperPlacement='workspace'|'home-workspace'
export type LearnerAppearance={
  palette:LearnerPalette
  displayMode:LearnerDisplayMode
  font:LearnerFont
  italicHeadings:boolean
  largeText:boolean
  compact:boolean
  reduceMotion:boolean
  wallpaper:LearnerWallpaper
  wallpaperPlacement:LearnerWallpaperPlacement
  studyMode:LearnerStudyMode
  pauseSocialLinks:boolean
  remindersEnabled:boolean
}
export const LEARNER_APPEARANCE_EVENT='vibeschool:learner-appearance-changed'
export const DEFAULT_LEARNER_APPEARANCE:LearnerAppearance={
  palette:'jade',displayMode:'light',font:'modern',italicHeadings:true,largeText:false,
  compact:false,reduceMotion:false,wallpaper:'sage',wallpaperPlacement:'workspace',
  studyMode:'normal',pauseSocialLinks:true,remindersEnabled:true
}
const palettes:readonly LearnerPalette[]=['jade','ocean','sunset','midnight']
const fonts:readonly LearnerFont[]=['modern','rounded','editorial']
const wallpapers:readonly LearnerWallpaper[]=['sage','paper','sky','pattern','photo']
const displayModes:readonly LearnerDisplayMode[]=['light','dark','auto']
const studyModes:readonly LearnerStudyMode[]=['normal','focus','reading']
const placements:readonly LearnerWallpaperPlacement[]=['workspace','home-workspace']
const appearanceKey=(studentId:string)=>'vibeschool:learner-appearance:v1:'+studentId
const imageKey=(studentId:string)=>'vibeschool:learner-wallpaper:v1:'+studentId
const legacyRemindersKey=(studentId:string)=>'vibeschool:learner-reminders:v1:'+studentId
const oneOf=<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T=>
  typeof value==='string'&&allowed.includes(value as T)?value as T:fallback

export function readLearnerAppearance(studentId:string|null|undefined):LearnerAppearance{
  if(!studentId||typeof window==='undefined')return {...DEFAULT_LEARNER_APPEARANCE}
  try {
    const data=JSON.parse(localStorage.getItem(appearanceKey(studentId))||'{}')
    if(!data||typeof data!=='object'||Array.isArray(data))return {...DEFAULT_LEARNER_APPEARANCE}
    return {
      palette:oneOf(data.palette,palettes,'jade'),
      displayMode:oneOf(data.displayMode,displayModes,'light'),
      font:oneOf(data.font,fonts,'modern'),
      wallpaper:oneOf(data.wallpaper,wallpapers,'sage'),
      wallpaperPlacement:oneOf(data.wallpaperPlacement,placements,'workspace'),
      studyMode:oneOf(data.studyMode,studyModes,'normal'),
      italicHeadings:typeof data.italicHeadings==='boolean'?data.italicHeadings:true,
      largeText:data.largeText===true,compact:data.compact===true,reduceMotion:data.reduceMotion===true,
      pauseSocialLinks:data.pauseSocialLinks!==false,
      remindersEnabled:typeof data.remindersEnabled==='boolean'
        ?data.remindersEnabled
        :localStorage.getItem(legacyRemindersKey(studentId))!=='off',
    }
  }catch{return {...DEFAULT_LEARNER_APPEARANCE}}
}
export function saveLearnerAppearance(studentId:string,appearance:LearnerAppearance):boolean{
  if(typeof window==='undefined'||!studentId)return false
  try{
    localStorage.setItem(appearanceKey(studentId),JSON.stringify(appearance))
    window.dispatchEvent(new Event(LEARNER_APPEARANCE_EVENT))
    return true
  }catch{return false}
}
export function readLearnerWallpaperPhoto(studentId:string|null|undefined):string|null{
  if(!studentId||typeof window==='undefined')return null
  try{
    const result=localStorage.getItem(imageKey(studentId))
    return result&&/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(result)&&result.length<620000?result:null
  }catch{return null}
}
export function saveLearnerWallpaperPhoto(studentId:string,dataUrl:string|null):boolean{
  if(!studentId||typeof window==='undefined')return false
  try{
    if(dataUrl&&(!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl)||dataUrl.length>=620000))return false
    if(dataUrl)localStorage.setItem(imageKey(studentId),dataUrl)
    else localStorage.removeItem(imageKey(studentId))
    window.dispatchEvent(new Event(LEARNER_APPEARANCE_EVENT))
    return true
  }catch{return false}
}

type PaletteTokens=Record<string,string>
const COLORS:Record<LearnerPalette,Record<'light'|'dark',PaletteTokens>>={
  jade:{
    light:{bg:'#f5f8f6',surface:'#ffffff',card:'#ffffff',soft:'#f0f5f1',border:'#dce9de',text:'#1b4030',muted:'#597563',accent:'#166d49','accent-soft':'#eef7f0','on-accent':'#ffffff',success:'#168153',warning:'#a45a11',error:'#b93434'},
    dark:{bg:'#101d16',surface:'#1b2c21',card:'#1b2c21',soft:'#213629',border:'#355542',text:'#ebf6ee',muted:'#b1cfba',accent:'#79dbaa','accent-soft':'#254332','on-accent':'#101d16',success:'#79dbaa',warning:'#fbbf74',error:'#ff9c9c'}
  },
  ocean:{
    light:{bg:'#f4f7fc',surface:'#ffffff',card:'#ffffff',soft:'#edf3fc',border:'#dfe7f4',text:'#1c304c',muted:'#657894',accent:'#245eae','accent-soft':'#eaf2ff','on-accent':'#ffffff',success:'#187b58',warning:'#a15d1b',error:'#b93434'},
    dark:{bg:'#111e31',surface:'#1c2d45',card:'#1c2d45',soft:'#233854',border:'#344a66',text:'#eff6ff',muted:'#b5c8e2',accent:'#9ac4ff','accent-soft':'#244568','on-accent':'#111e31',success:'#82e3ad',warning:'#fbc588',error:'#ffa9a9'}
  },
  sunset:{
    light:{bg:'#faf7f4',surface:'#ffffff',card:'#ffffff',soft:'#f8eee8',border:'#eaddd5',text:'#45332b',muted:'#837268',accent:'#a4563b','accent-soft':'#fff0e8','on-accent':'#ffffff',success:'#16744b',warning:'#a15d1b',error:'#b93434'},
    dark:{bg:'#281b20',surface:'#392830',card:'#392830',soft:'#49323c',border:'#62444a',text:'#fff3ee',muted:'#ddc1be',accent:'#ffb49d','accent-soft':'#603c41','on-accent':'#281b20',success:'#8be0ab',warning:'#ffcd91',error:'#ffaaaa'}
  },
  midnight:{
    light:{bg:'#eaeefe',surface:'#ffffff',card:'#ffffff',soft:'#e3e9fa',border:'#d4dcee',text:'#252a4a',muted:'#5c668b',accent:'#4b52a7','accent-soft':'#e9e9ff','on-accent':'#ffffff',success:'#18744f',warning:'#a15d1b',error:'#b93434'},
    dark:{bg:'#171d2a',surface:'#252e40',card:'#252e40',soft:'#2a3449',border:'#3d485e',text:'#f3f5ff',muted:'#b4bfd4',accent:'#9fb5ff','accent-soft':'#313f62','on-accent':'#171d2a',success:'#85d8a5',warning:'#ffcc86',error:'#ffaaaa'}
  }
}
export function resolvedLearnerDisplayMode(mode:LearnerDisplayMode,systemDark=false):'light'|'dark'{
  return mode==='auto'?(systemDark?'dark':'light'):mode
}
export function learnerAppearanceStyle(appearance:LearnerAppearance,systemDark=false):CSSProperties{
  const tokens=COLORS[appearance.palette][resolvedLearnerDisplayMode(appearance.displayMode,systemDark)]
  const result:Record<string,string>={
    fontFamily:appearance.font==='editorial'?'Georgia,Cambria,serif'
      :appearance.font==='rounded'?"'Nunito Sans','Trebuchet MS',sans-serif"
      :"'Plus Jakarta Sans',system-ui,sans-serif",
    fontSize:appearance.largeText?'16px':'14px',
    '--vs-learner-italic':appearance.italicHeadings?'italic':'normal'
  }
  for(const [key,value] of Object.entries(tokens))result['--vs-'+key]=value
  result['--vs-surface']=tokens.surface
  result['--vs-nav-bg']=tokens.surface
  result['--vs-nav-border']=tokens.border
  return result as CSSProperties
}
export function learnerWallpaperBackground(wallpaper:LearnerWallpaper,photo:string|null,mode:'light'|'dark'):CSSProperties{
  const overlay=mode==='dark'?'rgba(16,24,35,.79)':'rgba(247,250,248,.78)'
  const base=wallpaper==='photo'&&photo?'url("'+photo+'")'
    :wallpaper==='paper'?'linear-gradient(130deg,#e6d6bc,#f9efe3)'
    :wallpaper==='sky'?'linear-gradient(135deg,#c4e6fb,#9fb5ec)'
    :wallpaper==='pattern'?'radial-gradient(#78b69a 1px,transparent 1px)'
    :'linear-gradient(130deg,#c9e9dc,#a8d5bf)'
  return {
    backgroundImage:'linear-gradient('+overlay+','+overlay+'),'+base,
    backgroundSize:wallpaper==='pattern'?'auto,18px 18px':'cover',
    backgroundPosition:'center',backgroundRepeat:wallpaper==='pattern'?'repeat':'no-repeat'
  }
}
export function isSocialDestination(url:string):boolean{
  try{
    const host=new URL(url).hostname.toLowerCase()
    return ['instagram.com','tiktok.com','facebook.com','fb.com','x.com','twitter.com','snapchat.com','threads.net','reddit.com']
      .some(domain=>host===domain||host.endsWith('.'+domain))
  }catch{return false}
}
