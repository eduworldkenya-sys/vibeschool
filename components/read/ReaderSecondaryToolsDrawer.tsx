"use client";

import { useEffect, useRef, useState } from "react";

type ToolKey = "study" | "learn" | "test" | "materials" | "create";
type ReaderMode = "read" | "study" | "revise";
type ToolDefinition = { key: ToolKey; label: string; description: string; sourceLabel: string; modes: ReaderMode[] };

const TOOLS: ToolDefinition[] = [
  { key:"study", label:"Study workspace", description:"Open your saved vocabulary, formulas and study notes.", sourceLabel:"Open study tools", modes:["study"] },
  { key:"learn", label:"Learn this unit", description:"Open guided learning support for the current unit.", sourceLabel:"Learn with this unit", modes:["study","revise"] },
  { key:"test", label:"Test myself", description:"Start a grounded check from this unit.", sourceLabel:"Test me on this unit", modes:["revise"] },
  { key:"materials", label:"Teacher materials", description:"Create homework, notes or a project from this unit.", sourceLabel:"Create homework notes or project from this unit", modes:["study"] },
  { key:"create", label:"Create teaching material", description:"Derive a teaching resource from this unit.", sourceLabel:"Create teaching material from this unit", modes:["study"] },
];

export function ReaderSecondaryToolsDrawer() {
  const [open,setOpen]=useState(false); const [available,setAvailable]=useState<ToolKey[]>([]); const [mode,setMode]=useState<ReaderMode>("read");
  const sourceButtons=useRef(new Map<ToolKey,HTMLButtonElement>());

  useEffect(()=>{
    function sync(){ const next:ToolKey[]=[]; for(const tool of TOOLS){ const button=document.querySelector<HTMLButtonElement>(`button[aria-label="${tool.sourceLabel}"]`); if(!button) continue; button.style.setProperty("display","none","important"); sourceButtons.current.set(tool.key,button); next.push(tool.key); } setAvailable((current)=>current.join("|")===next.join("|")?current:next); }
    function onMode(raw:Event){ const event=raw as CustomEvent<{mode?:ReaderMode}>; if(event.detail?.mode){setMode(event.detail.mode);setOpen(false);} }
    function onKeyDown(event:KeyboardEvent){if(event.key==="Escape")setOpen(false);}
    sync(); const observer=new MutationObserver(sync); observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("vibe:reader-mode",onMode); window.addEventListener("keydown",onKeyDown);
    return()=>{observer.disconnect();window.removeEventListener("vibe:reader-mode",onMode);window.removeEventListener("keydown",onKeyDown);sourceButtons.current.forEach((button)=>button.style.removeProperty("display"));};
  },[]);

  const visible=TOOLS.filter((tool)=>available.includes(tool.key)&&tool.modes.includes(mode));
  if(mode==="read"||visible.length===0)return null;
  function launch(key:ToolKey){setOpen(false);sourceButtons.current.get(key)?.click();}

  return <>
    <style jsx global>{`
      .reader-secondary-tools-button{position:fixed;top:62px;right:12px;z-index:91;min-height:38px;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:10px;background:color-mix(in srgb,var(--reader-surface,#fffaf0) 94%,transparent);color:var(--reader-text,#27231f);padding:7px 11px;font-size:12px;font-weight:850;backdrop-filter:blur(12px);cursor:pointer}
      .reader-secondary-tools-backdrop{position:fixed;inset:0;z-index:118;display:flex;align-items:flex-end;justify-content:center;padding:12px;background:rgba(0,0,0,.5)}
      .reader-secondary-tools-drawer{width:min(560px,100%);max-height:min(72dvh,640px);overflow-y:auto;box-sizing:border-box;padding:16px;border-radius:18px;border:1px solid var(--reader-border,rgba(0,0,0,.14));background:var(--reader-surface,#fffaf0);color:var(--reader-text,#27231f);box-shadow:0 20px 60px rgba(0,0,0,.35)}
      .reader-secondary-tool{width:100%;display:block;margin-top:8px;padding:12px;text-align:left;border:1px solid var(--reader-border,rgba(0,0,0,.14));border-radius:12px;background:var(--reader-bg,#f7f1e5);color:var(--reader-text,#27231f);cursor:pointer}.reader-secondary-tool strong,.reader-secondary-tool span{display:block}.reader-secondary-tool span{margin-top:3px;color:var(--reader-muted,#625d55);font-size:12px;line-height:1.45}
    `}</style>
    <button type="button" className="reader-secondary-tools-button" onClick={()=>setOpen(true)} aria-expanded={open} aria-label="Open secondary reader tools">{mode==="revise"?"Revise tools":"Study tools"}</button>
    {open?<div className="reader-secondary-tools-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target)setOpen(false)}}><div className="reader-secondary-tools-drawer" role="dialog" aria-modal="true" aria-label={`${mode} tools`}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><strong style={{fontSize:18}}>{mode==="revise"?"Revision tools":"Study tools"}</strong><div style={{marginTop:3,fontSize:12,color:"var(--reader-muted,#625d55)"}}>{mode==="revise"?"Check understanding without cluttering the reading page.":"Use a tool only when it helps you understand or remember."}</div></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close tools">×</button></div>
      {visible.map((tool)=><button key={tool.key} type="button" className="reader-secondary-tool" onClick={()=>launch(tool.key)}><strong>{tool.label}</strong><span>{tool.description}</span></button>)}
    </div></div>:null}
  </>;
}
