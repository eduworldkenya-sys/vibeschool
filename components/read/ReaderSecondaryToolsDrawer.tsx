"use client";

import { useEffect, useRef, useState } from "react";

type ToolKey="learn"|"test";
type ToolDefinition={key:ToolKey;label:string;description:string;sourceLabel:string};
const TOOLS:ToolDefinition[]=[
  {key:"learn",label:"Help me learn this",description:"Get a simpler explanation, examples and guided help for this topic.",sourceLabel:"Learn with this unit"},
  {key:"test",label:"Check myself",description:"Try questions based on what you are reading.",sourceLabel:"Test me on this unit"},
];

export function ReaderSecondaryToolsDrawer(){
  const [open,setOpen]=useState(false); const [available,setAvailable]=useState<ToolKey[]>([]); const sourceButtons=useRef(new Map<ToolKey,HTMLButtonElement>());
  useEffect(()=>{
    function sync(){const next:ToolKey[]=[];for(const tool of TOOLS){const button=document.querySelector<HTMLButtonElement>(`button[aria-label="${tool.sourceLabel}"]`);if(!button)continue;button.style.setProperty("display","none","important");sourceButtons.current.set(tool.key,button);next.push(tool.key);}setAvailable(current=>current.join("|")===next.join("|")?current:next);}
    function close(){setOpen(false)} function onKeyDown(e:KeyboardEvent){if(e.key==="Escape")close()}
    sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener("keydown",onKeyDown);window.addEventListener("vibe:reader-secondary-open",close);
    return()=>{observer.disconnect();window.removeEventListener("keydown",onKeyDown);window.removeEventListener("vibe:reader-secondary-open",close);sourceButtons.current.forEach(button=>button.style.removeProperty("display"));};
  },[]);
  if(available.length===0)return null;
  function launch(key:ToolKey){setOpen(false);sourceButtons.current.get(key)?.click()}
  function show(){window.dispatchEvent(new CustomEvent("vibe:reader-secondary-open"));setOpen(true)}
  return <>
    <style jsx global>{`
      .reader-practice-button{position:fixed;top:62px;right:12px;z-index:91;min-height:40px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:999px;background:color-mix(in srgb,var(--reader-surface,#fffaf0) 96%,transparent);color:var(--reader-text,#27231f);padding:8px 13px;font-size:12px;font-weight:850;backdrop-filter:blur(12px);cursor:pointer}
      .reader-practice-backdrop{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:flex-end;justify-content:center;padding:12px;background:rgba(0,0,0,.52)}
      .reader-practice-sheet{width:min(560px,100%);max-height:min(62dvh,560px);overflow:auto;padding:16px;border-radius:20px;border:1px solid var(--reader-border,rgba(0,0,0,.14));background:var(--reader-surface,#fffaf0);color:var(--reader-text,#27231f);box-shadow:0 20px 60px rgba(0,0,0,.35)}
      .reader-practice-option{width:100%;display:block;margin-top:8px;padding:13px;text-align:left;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:13px;background:var(--reader-bg,#f7f1e5);color:var(--reader-text,#27231f);cursor:pointer}.reader-practice-option strong,.reader-practice-option span{display:block}.reader-practice-option span{margin-top:4px;color:var(--reader-muted,#625d55);font-size:12px;line-height:1.45}
      #vibetextbook-reader-shell[data-reader-focus="true"] .reader-practice-button{display:none!important}
    `}</style>
    <button type="button" className="reader-practice-button" onClick={show} aria-expanded={open} aria-label="Practice this topic">Practice</button>
    {open?<div className="reader-practice-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><div className="reader-practice-sheet" role="dialog" aria-modal="true" aria-label="Practice this topic">
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><strong style={{fontSize:18}}>Practice this topic</strong><div style={{marginTop:4,fontSize:12,color:"var(--reader-muted,#625d55)"}}>Choose what would help you now.</div></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close practice">×</button></div>
      {TOOLS.filter(tool=>available.includes(tool.key)).map(tool=><button key={tool.key} type="button" className="reader-practice-option" onClick={()=>launch(tool.key)}><strong>{tool.label}</strong><span>{tool.description}</span></button>)}
    </div></div>:null}
  </>;
}