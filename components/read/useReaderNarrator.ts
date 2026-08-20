"use client"

import { useCallback,useEffect,useMemo,useRef,useState } from "react"
import { chooseNarrationVoice,chunkNarrationText,normalizeNarrationText } from "@/lib/read/readerNarration"

type NarrationStatus='idle'|'playing'|'paused'|'unavailable'|'error'
type Segment={text:string;elementId:string|null}

export interface ReaderNarratorController {
  status:NarrationStatus
  rate:number
  voiceName:string|null
  voices:SpeechSynthesisVoice[]
  activeSegment:number
  segmentCount:number
  start:()=>void
  startAtElementId:(elementId:string)=>void
  pause:()=>void
  resume:()=>void
  stop:()=>void
  next:()=>void
  previous:()=>void
  setRate:(rate:number)=>void
  setVoiceName:(name:string|null)=>void
}

function collectSegments(rootId:string):Segment[]{
  const root=document.getElementById(rootId)
  if(!root)return[]
  const title=root.querySelector('h1')?.textContent?.trim()
  const content=[...root.querySelectorAll<HTMLElement>('[data-reader-block-id]')]
  const segments:Segment[]=[]
  if(title)segments.push({text:normalizeNarrationText(title),elementId:null})
  for(const element of content){
    const text=normalizeNarrationText(element.innerText||element.textContent||'')
    if(!text)continue
    const id=element.id||null
    for(const chunk of chunkNarrationText(text))segments.push({text:chunk,elementId:id})
  }
  return segments.filter(segment=>segment.text)
}

export function useReaderNarrator(rootId:string,chapterKey:string):ReaderNarratorController{
  const[status,setStatus]=useState<NarrationStatus>('idle')
  const[rateState,setRateState]=useState(.95)
  const[voiceName,setVoiceNameState]=useState<string|null>(null)
  const[voices,setVoices]=useState<SpeechSynthesisVoice[]>([])
  const[activeSegment,setActiveSegment]=useState(0)
  const[segmentCount,setSegmentCount]=useState(0)
  const segmentsRef=useRef<Segment[]>([])
  const indexRef=useRef(0)
  const utteranceRef=useRef<SpeechSynthesisUtterance|null>(null)
  const playRef=useRef<(index:number)=>void>(()=>undefined)

  useEffect(()=>{
    try{
      const savedRate=Number(localStorage.getItem('vibe.reader.narration.rate'))
      if(Number.isFinite(savedRate)&&savedRate>=.7&&savedRate<=1.5)setRateState(savedRate)
      const savedVoice=localStorage.getItem('vibe.reader.narration.voice')
      if(savedVoice)setVoiceNameState(savedVoice)
    }catch{}
  },[])

  useEffect(()=>{
    if(!('speechSynthesis'in window)){setStatus('unavailable');return}
    const load=()=>setVoices(window.speechSynthesis.getVoices())
    load();window.speechSynthesis.addEventListener('voiceschanged',load)
    return()=>window.speechSynthesis.removeEventListener('voiceschanged',load)
  },[])

  const clearHighlight=useCallback(()=>{
    document.querySelectorAll<HTMLElement>('[data-reader-speaking="true"]').forEach(el=>delete el.dataset.readerSpeaking)
  },[])
  const highlight=useCallback((elementId:string|null)=>{
    clearHighlight();if(!elementId)return
    const element=document.getElementById(elementId);if(!element)return
    element.dataset.readerSpeaking='true'
    element.scrollIntoView({block:'center',behavior:'smooth'})
  },[clearHighlight])

  const stop=useCallback(()=>{
    if('speechSynthesis'in window)window.speechSynthesis.cancel()
    utteranceRef.current=null;clearHighlight();indexRef.current=0;setActiveSegment(0);setStatus('idle')
  },[clearHighlight])

  const play=useCallback((index:number)=>{
    if(!('speechSynthesis'in window)){setStatus('unavailable');return}
    const segments=segmentsRef.current
    if(!segments.length){setStatus('error');return}
    if(index<0||index>=segments.length){stop();return}
    indexRef.current=index;setActiveSegment(index)
    const segment=segments[index];highlight(segment.elementId)
    const utterance=new SpeechSynthesisUtterance(segment.text)
    utterance.lang='en-KE';utterance.rate=rateState
    const voice=chooseNarrationVoice(voices,voiceName)
    if(voice)utterance.voice=voice
    utterance.onstart=()=>setStatus('playing')
    utterance.onend=()=>{if(utteranceRef.current===utterance)playRef.current(index+1)}
    utterance.onerror=()=>{if(utteranceRef.current!==utterance)return;clearHighlight();setStatus('error')}
    utteranceRef.current=utterance
    window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance)
  },[clearHighlight,highlight,rateState,stop,voiceName,voices])
  useEffect(()=>{playRef.current=play},[play])

  const prepare=useCallback(()=>{
    const segments=collectSegments(rootId)
    segmentsRef.current=segments;setSegmentCount(segments.length)
    return segments
  },[rootId])
  const start=useCallback(()=>{if(!('speechSynthesis'in window)){setStatus('unavailable');return}prepare();indexRef.current=0;setActiveSegment(0);playRef.current(0)},[prepare])
  const startAtElementId=useCallback((elementId:string)=>{if(!('speechSynthesis'in window)){setStatus('unavailable');return}const segments=prepare();const index=segments.findIndex(segment=>segment.elementId===elementId);const target=index>=0?index:0;indexRef.current=target;setActiveSegment(target);playRef.current(target)},[prepare])
  const pause=useCallback(()=>{if('speechSynthesis'in window&&status==='playing'){window.speechSynthesis.pause();setStatus('paused')}},[status])
  const resume=useCallback(()=>{if('speechSynthesis'in window&&status==='paused'){window.speechSynthesis.resume();setStatus('playing')}},[status])
  const next=useCallback(()=>{if(!segmentsRef.current.length)prepare();if(!segmentsRef.current.length)return;playRef.current(Math.min(segmentsRef.current.length-1,indexRef.current+1))},[prepare])
  const previous=useCallback(()=>{if(!segmentsRef.current.length)prepare();if(!segmentsRef.current.length)return;playRef.current(Math.max(0,indexRef.current-1))},[prepare])
  const setRate=useCallback((rate:number)=>{const nextRate=Math.max(.7,Math.min(1.5,rate));setRateState(nextRate);try{localStorage.setItem('vibe.reader.narration.rate',String(nextRate))}catch{};if(status==='playing'||status==='paused')window.setTimeout(()=>playRef.current(indexRef.current),0)},[status])
  const setVoiceName=useCallback((name:string|null)=>{setVoiceNameState(name);try{name?localStorage.setItem('vibe.reader.narration.voice',name):localStorage.removeItem('vibe.reader.narration.voice')}catch{};if(status==='playing'||status==='paused')window.setTimeout(()=>playRef.current(indexRef.current),0)},[status])

  useEffect(()=>{stop();segmentsRef.current=[];setSegmentCount(0)},[chapterKey,stop])
  useEffect(()=>()=>stop(),[stop])

  return useMemo(()=>({status,rate:rateState,voiceName,voices,activeSegment,segmentCount,start,startAtElementId,pause,resume,stop,next,previous,setRate,setVoiceName}),[activeSegment,next,pause,previous,rateState,resume,segmentCount,setRate,setVoiceName,start,startAtElementId,status,stop,voiceName,voices])
}
