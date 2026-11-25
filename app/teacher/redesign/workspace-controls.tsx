"use client";
import {useEffect,useId,useRef,useState,type ReactNode,type CSSProperties} from "react";
import {ChevronLeft,ChevronRight,Search,X,Maximize,Minimize} from "lucide-react";
import {ActionButton,CheckField} from "./ui";
import {AdaptiveOverlay,SmartSearch} from "./controls";
import type {SearchItem} from "./component-logic";
import s from "./redesign.module.css";

export function ContextToolbar({label,children}:{label:string;children:ReactNode}){
 return <div role="group" aria-label={label} className={s.contextToolbar}>{children}</div>;
}
export function SplitWorkspace({primary,secondary,primaryLabel,secondaryLabel,width,onWidthChange,collapsed,onCollapsedChange}:{primary:ReactNode;secondary:ReactNode;primaryLabel:string;secondaryLabel:string;width:number;onWidthChange:(v:number)=>void;collapsed:boolean;onCollapsedChange:(v:boolean)=>void}){
 const [mobilePanel,setMobilePanel]=useState<"primary"|"secondary">("primary");
 const id=useId();const container=useRef<HTMLDivElement>(null);const pointer=useRef<number|null>(null);
 const bounded=Math.max(30,Math.min(65,width));
 function resize(value:number){onWidthChange(Math.max(30,Math.min(65,value)))}
 return <div className={s.componentStack}>
 <div className={s.splitMobile}><ActionButton variant={mobilePanel==="primary"?"primary":"outline"} aria-pressed={mobilePanel==="primary"} onClick={()=>setMobilePanel("primary")}>{primaryLabel}</ActionButton><ActionButton variant={mobilePanel==="secondary"?"primary":"outline"} aria-pressed={mobilePanel==="secondary"} onClick={()=>setMobilePanel("secondary")}>{secondaryLabel}</ActionButton></div>
 <div className={s.splitDesktopControls}><ActionButton variant="outline" aria-expanded={!collapsed} aria-controls={id} onClick={()=>onCollapsedChange(!collapsed)}>{collapsed?"Show":"Hide"} {secondaryLabel}</ActionButton>{!collapsed&&<><ActionButton variant="ghost" iconOnly aria-label="Narrow side panel" disabled={bounded<=30} icon={<ChevronRight size={18}/>} onClick={()=>resize(bounded-5)}/><ActionButton variant="ghost" iconOnly aria-label="Widen side panel" disabled={bounded>=65} icon={<ChevronLeft size={18}/>} onClick={()=>resize(bounded+5)}/><ActionButton variant="ghost" onClick={()=>resize(40)}>Reset width</ActionButton></>}</div>
 <div ref={container} className={s.splitWorkspace} data-collapsed={collapsed} data-mobile-panel={mobilePanel} style={{"--split-columns":collapsed?"minmax(0,1fr)":"minmax(0,"+(100-bounded)+"fr) 16px minmax(0,"+bounded+"fr)"} as CSSProperties}>
 <section className={s.splitPrimary} aria-label={primaryLabel}>{primary}</section>
 {!collapsed&&<div role="separator" aria-label="Resize side panel" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={65} aria-valuenow={bounded} tabIndex={0} className={s.resizeHandle} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();resize(bounded+(e.key==="ArrowLeft"?5:-5))}}} onPointerDown={e=>{if(e.button!==0)return;pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const rect=container.current?.getBoundingClientRect();if(pointer.current===e.pointerId&&rect?.width)resize(Math.round((rect.right-e.clientX)/rect.width*100))}} onPointerUp={()=>{pointer.current=null}} onPointerCancel={()=>{pointer.current=null}} onLostPointerCapture={()=>{pointer.current=null}}/>}
 <section id={id} className={s.splitSecondary} aria-label={secondaryLabel}>{secondary}</section>
 </div></div>
}
export function CommandPalette({items,onSelect,label="Find an action"}:{items:SearchItem[];onSelect:(item:SearchItem)=>void;label?:string}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{function key(e:KeyboardEvent){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"&&!e.repeat){e.preventDefault();setOpen(v=>!v)}}window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[]);
 return <><ActionButton variant="outline" icon={<Search size={18}/>} onClick={()=>setOpen(true)}>{label} <small>Ctrl/⌘ K</small></ActionButton><AdaptiveOverlay open={open} mode="center" onClose={()=>setOpen(false)} title={label}><SmartSearch label={label} items={items} onSelect={item=>{setOpen(false);onSelect(item)}}/></AdaptiveOverlay></>
}
export function ContextPopover({label,children}:{label:string;children:ReactNode}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),id=useId();
 useEffect(()=>{if(!open)return;const dismiss=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener("pointerdown",dismiss);return()=>document.removeEventListener("pointerdown",dismiss)},[open]);
 function close(){setOpen(false);root.current?.querySelector("button")?.focus()}
 return <div ref={root} className={s.popoverAnchor} onKeyDown={e=>{if(e.key==="Escape"&&open){e.preventDefault();e.stopPropagation();close()}}}><ActionButton variant="outline" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>{label}</ActionButton>{open&&<div id={id} className={s.popover} role="region" aria-label={label}>{children}<ActionButton variant="ghost" icon={<X size={16}/>} onClick={close}>Close</ActionButton></div>}</div>
}
export function BulkSelection({items,selected,onChange,action}:{items:{id:string;label:string}[];selected:string[];onChange:(ids:string[])=>void;action:{label:string;run:(ids:string[])=>void}}){
 const scope=items.map(i=>i.id),visible=scope.filter(id=>selected.includes(id)),all=scope.length>0&&visible.length===scope.length;
 return <div className={s.componentStack}><ContextToolbar label="Selection actions"><CheckField label="Select all shown" checked={all} disabled={!scope.length} onChange={e=>onChange(e.target.checked?[...new Set([...selected,...scope])]:selected.filter(id=>!scope.includes(id)))}/><span role="status">{visible.length} of {scope.length} selected</span><ActionButton disabled={!visible.length} onClick={()=>action.run(visible)}>{action.label}</ActionButton><ActionButton variant="ghost" disabled={!selected.length} onClick={()=>onChange([])}>Clear</ActionButton></ContextToolbar>{items.map(item=><CheckField key={item.id} label={item.label} checked={selected.includes(item.id)} onChange={e=>onChange(e.target.checked?[...new Set([...selected,item.id])]:selected.filter(id=>id!==item.id))}/>)}</div>
}
export function ExpandableWorkspace({label,children}:{label:string;children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <><ActionButton variant="outline" icon={<Maximize size={18}/>} onClick={()=>setOpen(true)}>Expand {label}</ActionButton><AdaptiveOverlay open={open} mode="fullscreen" title={label} onClose={()=>setOpen(false)}><ContextToolbar label="Workspace actions"><ActionButton variant="outline" icon={<Minimize size={18}/>} onClick={()=>setOpen(false)}>Exit fullscreen view</ActionButton></ContextToolbar>{children}</AdaptiveOverlay></>
}
export function FileField({label,accept,files,onChange,multiple=false}:{label:string;accept?:string;files:File[];onChange:(files:File[])=>void;multiple?:boolean}){
 const id=useId();const ref=useRef<HTMLInputElement>(null);
 return <div className={s.componentStack}><label className={s.field} htmlFor={id}>{label}<input ref={ref} type="file" id={id} accept={accept} multiple={multiple} onChange={e=>{onChange(Array.from(e.target.files??[]));e.target.value=""}}/></label>{files.map((file,i)=><div className={s.row} key={file.name+"-"+i}><span>{file.name} · {Math.max(1,Math.round(file.size/1024))} KB</span><ActionButton variant="ghost" iconOnly aria-label={"Remove "+file.name} icon={<X size={18}/>} onClick={()=>onChange(files.filter((_,index)=>index!==i))}/></div>)}<small>Selected locally; not uploaded.</small></div>
}
