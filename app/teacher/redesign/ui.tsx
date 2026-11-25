"use client";
import {useId,type ButtonHTMLAttributes,type ReactNode,type ChangeEventHandler} from "react";
import {AlertCircle,CheckCircle2,Inbox,LoaderCircle,Search,ChevronLeft,ChevronRight} from "lucide-react";
import s from "./redesign.module.css";

export function ActionButton({variant="primary",size="regular",busy=false,busyLabel="Working…",icon,iconOnly=false,className="",children,disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"outline"|"ghost"|"danger";size?:"compact"|"regular"|"large";busy?:boolean;busyLabel?:string;icon?:ReactNode;iconOnly?:boolean}) {
 return <button {...props} type={props.type??"button"} disabled={disabled||busy} aria-busy={busy||undefined} data-size={size} data-icon-only={iconOnly||undefined} className={[s.actionButton,variant==="ghost"?"":variant==="danger"?s.dangerButton:s[variant],className].filter(Boolean).join(" ")}>{busy?<LoaderCircle className={s.spinner} size={17} aria-hidden="true"/>:icon}{busy?<span>{busyLabel}</span>:children}</button>;
}
export function SearchField({label,value,onChange,placeholder="Search"}:{label:string;value:string;onChange:(value:string)=>void;placeholder?:string}){
 return <label className={s.searchField}><Search size={18} aria-hidden="true"/><input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
export function SelectField({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;disabled?:boolean}){
 const id=useId();return <label htmlFor={id} className={s.field}>{label}<select id={id} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}
export function TextField({label,value,onChange,multiline=false,required=false,error,help,type="text",disabled=false}:{label:string;value:string;onChange:(value:string)=>void;multiline?:boolean;required?:boolean;error?:string;help?:string;type?:"text"|"number"|"email"|"password"|"date"|"time";disabled?:boolean}){
 const id=useId();const details=error||help;const shared={id,value,required,disabled,"aria-invalid":!!error,"aria-describedby":details?id+"-help":undefined,onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>onChange(e.target.value)};
 return <label htmlFor={id} className={s.field}>{label}{required?" *":""}{multiline?<textarea {...shared}/>:<input type={type} {...shared}/>} {details&&<small id={id+"-help"} className={error?s.fieldError:undefined}>{details}</small>}</label>;
}
export function CheckField({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:ChangeEventHandler<HTMLInputElement>;disabled?:boolean}){
 return <label className={s.check}><input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}/>{label}</label>;
}
export function FilterChips({label,options,value,onChange}:{label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void}){
 return <div className={s.chips} role="group" aria-label={label}>{options.map(o=><button type="button" key={o.value} aria-pressed={o.value===value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</div>;
}
export function StatusPill({tone="neutral",children}:{tone?:"neutral"|"success"|"warning"|"error";children:ReactNode}){
 return <span className={s.statusPill} data-tone={tone}>{tone==="success"?<CheckCircle2 size={14}/>:tone==="error"||tone==="warning"?<AlertCircle size={14}/>:null}{children}</span>;
}
export function StateView({kind,title,description,action}:{kind:"loading"|"empty"|"error"|"offline"|"success";title:string;description?:string;action?:{label:string;run:()=>void}}){
 const Icon=kind==="loading"?LoaderCircle:kind==="empty"?Inbox:kind==="success"?CheckCircle2:AlertCircle;
 return <div className={s.stateView} data-tone={kind==="error"?"error":kind==="success"?"success":"neutral"} role={kind==="error"?"alert":"status"} aria-busy={kind==="loading"}><Icon size={24} aria-hidden="true"/><strong>{title}</strong>{description&&<p>{description}</p>}{action&&<ActionButton variant="outline" onClick={action.run}>{action.label}</ActionButton>}</div>;
}
export function Progress({value,max,label}:{value:number;max:number;label:string}){
 const bounded=Math.min(Math.max(value,0),Math.max(max,1));const total=Math.max(max,1);return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuenow={bounded} aria-valuemax={total} className={s.progressTrack}><span style={{width:bounded/total*100+"%"}}/></div>;
}
export function DataTable({caption,columns,rows}:{caption:string;columns:string[];rows:{key:string;cells:ReactNode[]}[]}){
 return <div className={s.tableWrap}><table className={s.dataTable}><caption>{caption}</caption><thead><tr>{columns.map((column,i)=><th scope="col" key={i}>{column}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.key}>{row.cells.map((cell,i)=><td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
export function Pagination({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void}){
 return <nav className={s.pagination} aria-label="Pagination"><ActionButton variant="outline" disabled={page<=1} aria-label="Previous page" onClick={()=>onChange(page-1)}><ChevronLeft size={18}/></ActionButton><span>Page {page} of {total}</span><ActionButton variant="outline" disabled={page>=total} aria-label="Next page" onClick={()=>onChange(page+1)}><ChevronRight size={18}/></ActionButton></nav>;
}
