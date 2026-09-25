"use client";

import React from "react";
import { C } from "@/components/teacher/ui";

export type ClassicSlot = {
  id:string; subject:string; className:string; room:string;
  startTime:string; endTime:string; dayOfWeek:number;
  effectiveFrom:string; effectiveUntil:string|null;
};

export type SchoolDayBlock = {
  id:string; scheduleDay:number; periodNumber:number; label:string;
  startTime:string; endTime:string; kind:string; protected:boolean;
};

const DAYS=[{d:1,l:"Mon"},{d:2,l:"Tue"},{d:3,l:"Wed"},{d:4,l:"Thu"},{d:5,l:"Fri"},{d:6,l:"Sat"},{d:7,l:"Sun"}];

function active(slot:ClassicSlot,date:string){
  return slot.effectiveFrom<=date && (slot.effectiveUntil===null || slot.effectiveUntil>=date);
}
function fmt(t:string){ return t.slice(0,5); }

export default function ClassicTimetable({
  slots,blocks,dateForDow,onSelect,
}:{
  slots:ClassicSlot[];
  blocks:SchoolDayBlock[];
  dateForDow:(dow:number)=>string;
  onSelect:(slot:ClassicSlot)=>void;
}){
  const visibleDays=DAYS.filter(day =>
    slots.some(s=>s.dayOfWeek===day.d && active(s,dateForDow(day.d))) ||
    blocks.some(b=>b.scheduleDay===0 || b.scheduleDay===day.d)
  );
  const days=visibleDays.length?visibleDays:DAYS.slice(0,5);

  const rows=React.useMemo(()=>{
    const keyed=new Map<string,{start:string;end:string;label:string;kind:string;period:number}>();
    for(const b of blocks){
      const key=`${b.startTime.slice(0,5)}-${b.endTime.slice(0,5)}-${b.periodNumber}`;
      if(!keyed.has(key)) keyed.set(key,{start:b.startTime,end:b.endTime,label:b.label,kind:b.kind,period:b.periodNumber});
    }
    for(const s of slots){
      const key=`${s.startTime.slice(0,5)}-${s.endTime.slice(0,5)}-lesson`;
      if(![...keyed.values()].some(r=>r.start.slice(0,5)===s.startTime.slice(0,5)&&r.end.slice(0,5)===s.endTime.slice(0,5)))
        keyed.set(key,{start:s.startTime,end:s.endTime,label:"Lesson",kind:"lesson",period:999});
    }
    return [...keyed.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.period-b.period);
  },[blocks,slots]);

  if(!rows.length) return <div style={{padding:"28px 12px",textAlign:"center",color:C.textMuted,fontSize:13}}>No timetable periods configured yet.</div>;

  return <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",border:`1px solid ${C.border}`,borderRadius:14}}>
    <table aria-label="Conventional weekly timetable" style={{borderCollapse:"separate",borderSpacing:0,minWidth:720,width:"100%",background:C.surface,fontSize:12}}>
      <thead><tr>
        <th style={head(true)}>Period</th>
        {days.map(x=><th key={x.d} style={head(false)}>{x.l}</th>)}
      </tr></thead>
      <tbody>
        {rows.map((row,ri)=>{
          const rowBlocks=blocks.filter(b=>b.startTime.slice(0,5)===row.start.slice(0,5)&&b.endTime.slice(0,5)===row.end.slice(0,5));
          const generic=rowBlocks.find(b=>b.scheduleDay===0);
          const isGenericNonLesson=generic && generic.kind!=="lesson";
          return <tr key={row.start+row.end+ri}>
            <th scope="row" style={periodCell}>
              <div style={{fontWeight:800,color:C.textPrimary}}>{generic?.label ?? row.label}</div>
              <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{fmt(row.start)}–{fmt(row.end)}</div>
            </th>
            {days.map(day=>{
              const dayBlock=rowBlocks.find(b=>b.scheduleDay===day.d) ?? generic;
              const nonLesson=dayBlock && dayBlock.kind!=="lesson";
              if(nonLesson || isGenericNonLesson) return <td key={day.d} style={{...cell,background:"var(--surface-raised, #f9fafb)",textAlign:"center"}}>
                <strong style={{color:C.textMuted,textTransform:"capitalize"}}>{dayBlock?.label ?? generic?.label}</strong>
              </td>;
              const found=slots.filter(s=>s.dayOfWeek===day.d&&active(s,dateForDow(day.d))&&s.startTime.slice(0,5)===row.start.slice(0,5)&&s.endTime.slice(0,5)===row.end.slice(0,5));
              return <td key={day.d} style={cell}>
                {found.map(s=><button key={s.id} type="button" onClick={()=>onSelect(s)} style={slotButton}>
                  <span style={{fontWeight:800,color:C.textPrimary}}>{s.subject}</span>
                  <span style={{fontSize:10,color:C.textMuted}}>{s.className}{s.room?` · ${s.room}`:""}</span>
                </button>)}
              </td>;
            })}
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
const head=(sticky:boolean):React.CSSProperties=>({padding:"10px",fontWeight:800,color:C.textPrimary,background:"var(--surface-raised, #f9fafb)",borderBottom:`1px solid ${C.border}`,position:sticky?"sticky":undefined,left:sticky?0:undefined,zIndex:sticky?2:1,minWidth:sticky?105:118});
const periodCell:React.CSSProperties={...head(true),textAlign:"left",borderRight:`1px solid ${C.border}`};
const cell:React.CSSProperties={padding:6,borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,verticalAlign:"top",minWidth:118};
const slotButton:React.CSSProperties={width:"100%",display:"flex",flexDirection:"column",gap:3,textAlign:"left",padding:"8px",borderRadius:9,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",fontFamily:"inherit",marginBottom:4};
