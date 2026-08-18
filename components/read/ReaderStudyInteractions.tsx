"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type ReaderChapterEventDetail = { chapterId?: unknown };
type ReaderMode = "read" | "study" | "revise";
type Anchor = { blockId: string; startOffset: number; endOffset: number };
type SelectionState = ({ text: string; x: number; y: number } & Anchor) | null;
type StudyItem = { item_id: string; item_type: string; chapter_id: string; payload: Record<string, unknown> };

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange(); range.selectNodeContents(root); range.setEnd(node, offset); return range.toString().length;
}

function selectedTextInsideReader(): SelectionState {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement;
  const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer as Element : range.endContainer.parentElement;
  const startBlock = startElement?.closest<HTMLElement>("[data-reader-block-id]");
  const endBlock = endElement?.closest<HTMLElement>("[data-reader-block-id]");
  if (!startBlock || startBlock !== endBlock || !startBlock.closest("#reader-active-unit")) return null;
  const rawText = selection.toString(); const text = rawText.replace(/\s+/g," ").trim(); if (text.length < 2) return null;
  const startOffset = textOffset(startBlock, range.startContainer, range.startOffset);
  const endOffset = textOffset(startBlock, range.endContainer, range.endOffset);
  const rect = range.getBoundingClientRect();
  return { text:text.slice(0,2000), blockId:startBlock.dataset.readerBlockId || "", startOffset, endOffset, x:Math.max(12,Math.min(window.innerWidth-12,rect.left+rect.width/2)), y:Math.max(68,rect.top-10) };
}

function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let cursor=0; let startNode:Node|null=null,endNode:Node|null=null,startLocal=0,endLocal=0;
  while(walker.nextNode()) { const node=walker.currentNode; const length=node.textContent?.length ?? 0;
    if(!startNode && start>=cursor && start<=cursor+length){startNode=node;startLocal=start-cursor;}
    if(end>=cursor && end<=cursor+length){endNode=node;endLocal=end-cursor;break;} cursor+=length;
  }
  if(!startNode||!endNode)return null; const range=document.createRange(); range.setStart(startNode,startLocal); range.setEnd(endNode,endLocal); return range;
}

function bestEnglishVoice(): SpeechSynthesisVoice|null { if(!("speechSynthesis" in window))return null; const voices=window.speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith("en")); return voices.find(v=>/natural|neural|enhanced|premium|online|google|microsoft/i.test(`${v.name} ${v.voiceURI}`))??voices[0]??null; }

export function ReaderStudyInteractions(){
  const router=useRouter(); const supabase=useMemo(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),[]);
  const chapterIdRef=useRef<string|null>(null); const [mode,setMode]=useState<ReaderMode>("read"); const [selection,setSelection]=useState<SelectionState>(null); const [noteOpen,setNoteOpen]=useState(false); const [note,setNote]=useState(""); const [saving,setSaving]=useState(false); const [message,setMessage]=useState(""); const [items,setItems]=useState<StudyItem[]>([]); const [zoomedImage,setZoomedImage]=useState<{src:string;alt:string}|null>(null);

  async function loadAnnotations(chapterId:string){ const {data:auth}=await supabase.auth.getUser(); if(!auth.user){setItems([]);return;} const {data,error}=await supabase.rpc("get_my_study_workspace_items",{p_item_type:null}); if(error)return; setItems(((data??[]) as StudyItem[]).filter(item=>item.chapter_id===chapterId&&(item.item_type==="highlight"||item.item_type==="note"))); }

  useEffect(()=>{
    function onChapter(raw:Event){const event=raw as CustomEvent<ReaderChapterEventDetail>;const id=typeof event.detail?.chapterId==="string"?event.detail.chapterId:null;chapterIdRef.current=id;setSelection(null);setNoteOpen(false);setMessage("");if(id)window.setTimeout(()=>void loadAnnotations(id),80);}
    function onMode(raw:Event){const event=raw as CustomEvent<{mode?:ReaderMode}>;if(event.detail?.mode)setMode(event.detail.mode);setSelection(null);setNoteOpen(false);}
    function onSelectionChange(){if(mode!=="study")return setSelection(null);window.setTimeout(()=>setSelection(selectedTextInsideReader()),0);}
    function onPointerDown(event:PointerEvent){const target=event.target as HTMLElement|null;if(target?.closest(".reader-selection-toolbar,.reader-selection-note"))return;if(!target?.closest("#reader-active-unit"))setSelection(null);}
    function onImageClick(event:MouseEvent){const image=(event.target as HTMLElement|null)?.closest<HTMLImageElement>("#reader-active-unit img");if(!image?.src)return;event.preventDefault();setZoomedImage({src:image.src,alt:image.alt||"Learning diagram"});}
    function onKeyDown(event:KeyboardEvent){if(event.key==="Escape"){setZoomedImage(null);setNoteOpen(false);}}
    window.addEventListener("vibe:reader-chapter",onChapter);window.addEventListener("vibe:reader-mode",onMode);document.addEventListener("selectionchange",onSelectionChange);document.addEventListener("pointerdown",onPointerDown,true);document.addEventListener("click",onImageClick,true);window.addEventListener("keydown",onKeyDown);
    return()=>{window.removeEventListener("vibe:reader-chapter",onChapter);window.removeEventListener("vibe:reader-mode",onMode);document.removeEventListener("selectionchange",onSelectionChange);document.removeEventListener("pointerdown",onPointerDown,true);document.removeEventListener("click",onImageClick,true);window.removeEventListener("keydown",onKeyDown);};
  },[mode]);

  useEffect(()=>{
    const noteCounts=new Map<string,number>();
    for(const item of items){const p=item.payload||{};const blockId=typeof p.block_id==="string"?p.block_id:"";if(!blockId)continue;if(item.item_type==="note")noteCounts.set(blockId,(noteCounts.get(blockId)||0)+1);}
    document.querySelectorAll<HTMLElement>("#reader-active-unit [data-reader-block-id]").forEach(el=>{delete el.dataset.readerNoteCount;});
    noteCounts.forEach((count,id)=>{const el=document.querySelector<HTMLElement>(`#reader-active-unit [data-reader-block-id="${CSS.escape(id)}"]`);if(el)el.dataset.readerNoteCount=String(count);});
    const cssApi=CSS as typeof CSS & {highlights?:Map<string,unknown>}; if(!cssApi.highlights||typeof Highlight==="undefined")return;
    const ranges:Range[]=[]; for(const item of items){if(item.item_type!=="highlight")continue;const p=item.payload||{};const id=typeof p.block_id==="string"?p.block_id:"";const start=Number(p.start_offset),end=Number(p.end_offset);if(!id||!Number.isInteger(start)||!Number.isInteger(end)||end<=start)continue;const el=document.querySelector<HTMLElement>(`#reader-active-unit [data-reader-block-id="${CSS.escape(id)}"]`);if(!el)continue;const range=rangeFromOffsets(el,start,end);if(range)ranges.push(range);}
    cssApi.highlights.set("vibe-reader-highlights",new Highlight(...ranges)); return()=>{cssApi.highlights?.delete("vibe-reader-highlights");};
  },[items]);

  async function requireUser(){const{data}=await supabase.auth.getUser();if(data.user)return data.user;const redirect=`${window.location.pathname}${window.location.search}`;router.push(`/login?redirect=${encodeURIComponent(redirect)}`);return null;}
  async function saveItem(itemType:"highlight"|"note"|"vocabulary",payload:Record<string,unknown>){if(!selection?.text||!chapterIdRef.current||saving)return;if(!(await requireUser()))return;setSaving(true);setMessage("");const anchor={block_id:selection.blockId,start_offset:selection.startOffset,end_offset:selection.endOffset};const{data,error}=await supabase.rpc("upsert_study_workspace_item",{p_item_type:itemType,p_chapter_id:chapterIdRef.current,p_payload:{...payload,...(itemType==="vocabulary"?{}:anchor)},p_item_id:null});const result=data as{ok?:boolean;reason?:string|null}|null;if(error||!result?.ok){setMessage(result?.reason==="not_entitled"?"This passage is not available to save.":"Could not save this study item.");setSaving(false);return;}setMessage(itemType==="highlight"?"Highlighted":itemType==="note"?"Note saved":"Saved to vocabulary");setSaving(false);if(itemType==="note"){setNote("");setNoteOpen(false);}await loadAnnotations(chapterIdRef.current);window.setTimeout(()=>{window.getSelection()?.removeAllRanges();setSelection(null);setMessage("");},650);}
  function speak(text:string){if(!("speechSynthesis" in window)||!text)return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);const voice=bestEnglishVoice();if(voice){utterance.voice=voice;utterance.lang=voice.lang;}else utterance.lang="en-KE";utterance.rate=.9;window.speechSynthesis.speak(utterance);}
  const vocabularyEligible=Boolean(selection&&selection.text.length<=80&&selection.text.split(/\s+/).length<=8);

  return <><style jsx global>{`
    ::highlight(vibe-reader-highlights){background:rgba(255,220,80,.58);color:inherit}
    #reader-active-unit [data-reader-note-count]{position:relative;border-inline-start:3px solid color-mix(in srgb,var(--reader-accent,#466400) 55%,transparent);padding-inline-start:8px}
    #reader-active-unit [data-reader-note-count]::after{content:"Note";position:absolute;right:4px;top:4px;font-size:9px;font-weight:850;color:var(--reader-accent,#466400);opacity:.72}
    #reader-active-unit img{cursor:zoom-in}.reader-selection-toolbar{position:fixed;z-index:110;display:flex;gap:4px;padding:5px;border-radius:12px;border:1px solid var(--reader-border,rgba(0,0,0,.14));background:var(--reader-surface,#fffaf0);color:var(--reader-text,#27231f);box-shadow:0 12px 36px rgba(0,0,0,.22);transform:translate(-50%,-100%);max-width:calc(100vw - 16px);overflow-x:auto}.reader-selection-toolbar button{border:0;border-radius:8px;padding:8px 10px;background:transparent;color:inherit;font-size:12px;font-weight:850;cursor:pointer;white-space:nowrap}.reader-selection-note{position:fixed;z-index:112;left:50%;bottom:max(64px,env(safe-area-inset-bottom));width:min(560px,calc(100% - 24px));transform:translateX(-50%);padding:14px;box-sizing:border-box;border-radius:16px;border:1px solid var(--reader-border,rgba(0,0,0,.14));background:var(--reader-surface,#fffaf0);color:var(--reader-text,#27231f);box-shadow:0 18px 54px rgba(0,0,0,.3)}.reader-selection-note textarea{width:100%;min-height:90px;margin-top:8px;padding:10px;box-sizing:border-box;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:10px;background:var(--reader-bg,#f7f1e5);color:var(--reader-text,#27231f);font:inherit}.reader-image-zoom{position:fixed;inset:0;z-index:130;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.88)}.reader-image-zoom img{max-width:96vw;max-height:88dvh;object-fit:contain}.reader-image-zoom button{position:fixed;top:max(12px,env(safe-area-inset-top));right:14px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.55);color:#fff;font-size:24px}
  `}</style>
  {mode==="study"&&selection&&<div className="reader-selection-toolbar" role="toolbar" aria-label="Actions for selected text" style={{left:selection.x,top:selection.y}}><button type="button" disabled={saving} onClick={()=>void saveItem("highlight",{text:selection.text,color:"yellow",context:"reader_anchor_v1"})}>Highlight</button><button type="button" onClick={()=>setNoteOpen(true)}>Note</button>{vocabularyEligible?<button type="button" disabled={saving} onClick={()=>void saveItem("vocabulary",{text:selection.text,meaning:""})}>Vocabulary</button>:null}<button type="button" onClick={()=>speak(selection.text)}>Pronounce</button></div>}
  {noteOpen&&selection&&<div className="reader-selection-note" role="dialog" aria-label="Add note to passage"><strong>Add a note</strong><div style={{fontSize:12,opacity:.72,marginTop:4}}>“{selection.text.slice(0,140)}{selection.text.length>140?"…":""}”</div><textarea autoFocus value={note} maxLength={5000} placeholder="What do you want to remember?" onChange={e=>setNote(e.target.value)}/><div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:8}}><button type="button" onClick={()=>setNoteOpen(false)}>Cancel</button><button type="button" disabled={!note.trim()||saving} onClick={()=>void saveItem("note",{text:note.trim(),quote:selection.text})}>{saving?"Saving…":"Save note"}</button></div>{message?<div role="status" style={{marginTop:8,fontSize:12}}>{message}</div>:null}</div>}
  {zoomedImage&&<div className="reader-image-zoom" role="dialog" aria-modal="true" aria-label={zoomedImage.alt} onClick={()=>setZoomedImage(null)}><button type="button" onClick={()=>setZoomedImage(null)} aria-label="Close image">×</button><img src={zoomedImage.src} alt={zoomedImage.alt} onClick={e=>e.stopPropagation()}/></div>}</>;
}
