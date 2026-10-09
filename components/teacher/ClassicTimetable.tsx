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
  slots,blocks,dateForDow,onSelect,onAdd,
}:{
  slots:ClassicSlot[];
  blocks:SchoolDayBlock[];
  dateForDow:(dow:number)=>string;
  onSelect:(slot:ClassicSlot)=>void;
  onAdd?:(placement:{dayOfWeek:number;startTime:string;endTime:string})=>void;
}){
  const activeSlots=slots.filter(s => active(s,dateForDow(s.dayOfWeek)));
  const days=DAYS.filter(day => day.d <= 5 || activeSlots.some(s => s.dayOfWeek === day.d) || blocks.some(b => b.scheduleDay === day.d));
  // Atomic boundaries allow a double lesson to span rows without duplicating
  // it or creating an overlapping extra row. Historical slots stay invisible.
  const boundaries=[...new Set([...blocks.flatMap(b => [fmt(b.startTime),fmt(b.endTime)]),
    ...activeSlots.flatMap(s => [fmt(s.startTime),fmt(s.endTime)])])].sort();
  const rows=boundaries.slice(0,-1).map((start,i) => ({start,end:boundaries[i+1]}));
  if(!rows.length) return <div style={{padding:28,textAlign:"center",color:C.textMuted}}>No lessons or school periods yet. Use Add lesson to enter your timetable.</div>;
  const covering=(day:number,row:{start:string;end:string}) => {
    const specific=blocks.find(b => b.scheduleDay===day && fmt(b.startTime)<=row.start && fmt(b.endTime)>=row.end);
    return specific ?? blocks.find(b => b.scheduleDay===0 && fmt(b.startTime)<=row.start && fmt(b.endTime)>=row.end);
  };
  return <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",border:`1px solid ${C.border}`,borderRadius:14}}>
    <table aria-label="Conventional weekly timetable" style={{borderCollapse:"separate",borderSpacing:0,minWidth:720,width:"100%",background:C.surface,fontSize:12}}>
      <thead><tr><th scope="col" style={head(true)}>Time</th>{days.map(day=><th scope="col" key={day.d} style={head(false)}>{day.l}</th>)}</tr></thead>
      <tbody>{rows.map((row,ri) => <tr key={row.start}>
        <th scope="row" style={periodCell}>{row.start}–{row.end}</th>
        {days.map(day => {
          const found=activeSlots.filter(s => s.dayOfWeek===day.d && fmt(s.startTime)<=row.start && fmt(s.endTime)>row.start);
          const preceding=found.length===1 && fmt(found[0].startTime)<row.start && !activeSlots.some(s => s.id!==found[0].id && s.dayOfWeek===day.d && fmt(s.startTime)<fmt(found[0].endTime) && fmt(s.endTime)>fmt(found[0].startTime));
          if(preceding) return null;
          const hasOverlap=found.length===1 && activeSlots.some(s => s.id!==found[0].id && s.dayOfWeek===day.d && fmt(s.startTime)<fmt(found[0].endTime) && fmt(s.endTime)>fmt(found[0].startTime));
          const span=found.length===1 && !hasOverlap ? rows.filter(r => r.start>=row.start && r.start<fmt(found[0].endTime)).length : 1;
          const block=covering(day.d,row);
          // Always expose existing lessons, even when school configuration
          // later changes underneath them; never hide a conflicting baseline.
          if(found.length) return <td key={day.d} rowSpan={span} style={cell}>{found.map(s=><button key={s.id} type="button" onClick={()=>onSelect(s)} style={slotButton}>
            <span style={{fontWeight:800,color:C.textPrimary}}>{s.subject}</span>
            <span style={{fontSize:11,color:C.textMuted}}>{s.className}{s.room?` · ${s.room}`:""}</span>
            <span style={{fontSize:11,color:C.textMuted}}>{fmt(s.startTime)}–{fmt(s.endTime)}</span>
          </button>)}</td>;
          if(block && block.kind!=="lesson") return <td key={day.d} style={{...cell,textAlign:"center",background:"var(--surface-raised, #f9fafb)"}}><strong>{block.label}</strong></td>;
          return <td key={day.d} style={cell}>{onAdd && (!blocks.length || (block?.kind==='lesson' && !activeSlots.some(s => s.dayOfWeek===day.d && fmt(s.startTime)<fmt(block.endTime) && fmt(s.endTime)>fmt(block.startTime)))) && <button type="button" aria-label={`Add lesson ${day.l} ${row.start}`} onClick={()=>onAdd({dayOfWeek:day.d,startTime:block?fmt(block.startTime):row.start,endTime:block?fmt(block.endTime):row.end})} style={slotButton}>+ Add lesson</button>}</td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}
const head=(sticky:boolean):React.CSSProperties=>({padding:"10px",fontWeight:800,color:C.textPrimary,background:"var(--surface-raised, #f9fafb)",borderBottom:`1px solid ${C.border}`,position:sticky?"sticky":undefined,left:sticky?0:undefined,zIndex:sticky?2:1,minWidth:sticky?105:118});
const periodCell:React.CSSProperties={...head(true),textAlign:"left",borderRight:`1px solid ${C.border}`};
const cell:React.CSSProperties={padding:6,borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,verticalAlign:"top",minWidth:118};
const slotButton:React.CSSProperties={width:"100%",display:"flex",flexDirection:"column",gap:3,textAlign:"left",padding:"8px",borderRadius:9,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",fontFamily:"inherit",marginBottom:4};
