"use client";

import React from "react";
import { periodAppearance } from "@/lib/timetable/periodAppearance";
import { subjectTone } from "@/lib/timetable/subjectColor";

export type ClassicSlot = {
  id: string; subject: string; className: string; room: string;
  startTime: string; endTime: string; dayOfWeek: number;
  effectiveFrom: string; effectiveUntil: string | null;
};
export type SchoolDayBlock = {
  id: string; scheduleDay: number; periodNumber: number; label: string;
  startTime: string; endTime: string; kind: string; protected: boolean;
};
type Placement = { dayOfWeek: number; startTime: string; endTime: string };
const DAYS = [{d:1,l:"Mon"},{d:2,l:"Tue"},{d:3,l:"Wed"},{d:4,l:"Thu"},{d:5,l:"Fri"},{d:6,l:"Sat"},{d:7,l:"Sun"}];
const hhmm = (s: string) => s.slice(0,5);
const active = (s: ClassicSlot, date: string) =>
  s.effectiveFrom <= date && (!s.effectiveUntil || s.effectiveUntil >= date);
// Find a continuous sequence of REAL teaching periods for a single or
// multi-period lesson. Never bridge breaks or unrelated clock gaps.
const matchingBlock = (blocks: SchoolDayBlock[], day: number, slot: ClassicSlot) => {
  const dayPeriods = blocks.filter(b => b.scheduleDay===day || b.scheduleDay===0)
    .filter(b=>b.kind==="lesson")
    .sort((a,b)=>hhmm(a.startTime).localeCompare(hhmm(b.startTime)));
  let until = hhmm(slot.startTime);
  let matched = false;
  for (const block of dayPeriods) {
    if (hhmm(block.startTime) !== until) {
      if (matched || hhmm(block.startTime) > until) break;
      continue;
    }
    matched = true;
    until = hhmm(block.endTime);
    if (until===hhmm(slot.endTime)) return true;
    if (until>hhmm(slot.endTime)) return false;
  }
  return false;
};
const blockForDay = (blocks: SchoolDayBlock[], day: number, start: string, end: string) =>
  blocks.find(b => b.scheduleDay === day && hhmm(b.startTime) === start && hhmm(b.endTime) === end) ??
  blocks.find(b => b.scheduleDay === 0 && hhmm(b.startTime) === start && hhmm(b.endTime) === end);

export default function ClassicTimetable({
  slots, blocks, dateForDow, onSelect, onAdd,
}: {
  slots: ClassicSlot[];
  blocks: SchoolDayBlock[];
  dateForDow: (dow: number) => string;
  onSelect: (slot: ClassicSlot) => void;
  onAdd?: (placement: Placement) => void;
}) {
  const current = slots.filter(slot => active(slot,dateForDow(slot.dayOfWeek)));
  const [focusedDay, setFocusedDay] = React.useState(1);
  // Only actual configured school periods create calendar rows.
  // Irregular/legacy lessons remain below the grid as reviewable records.
  const teachingDays = DAYS.filter(d => d.d<=5 ||
    blocks.some(b=>b.scheduleDay===d.d) || current.some(s=>s.dayOfWeek===d.d));
  const rowKeys = new Map<string,{start:string;end:string}>();
  for (const b of blocks) {
    if (b.scheduleDay!==0 && !teachingDays.some(d=>d.d===b.scheduleDay)) continue;
    rowKeys.set(`${hhmm(b.startTime)}-${hhmm(b.endTime)}`,{start:hhmm(b.startTime),end:hhmm(b.endTime)});
  }
  const rows = [...rowKeys.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
  const irregular = current.filter(slot => !matchingBlock(blocks,slot.dayOfWeek,slot));
  const focusedEntries = [
    ...current.filter(slot=>slot.dayOfWeek===focusedDay).map(slot=>({start:slot.startTime,slot,activity:null as SchoolDayBlock|null})),
    ...blocks.filter(block=>block.kind!=="lesson" && (block.scheduleDay===0 || block.scheduleDay===focusedDay))
      .map(activity=>({start:activity.startTime,slot:null as ClassicSlot|null,activity})),
  ].sort((a,b)=>a.start.localeCompare(b.start));
  const card = (slot:ClassicSlot) => {
    const tone=subjectTone(slot.subject);
    return <button type="button" key={slot.id} onClick={()=>onSelect(slot)}
      className="vs-v3-lesson" style={{background:tone.background,color:tone.foreground,borderLeftColor:tone.border}}
      aria-label={`Open ${slot.subject}, ${slot.className}, ${hhmm(slot.startTime)} to ${hhmm(slot.endTime)}`}>
      <strong>{slot.subject}</strong>
      <span>{slot.className}{slot.room?` · ${slot.room}`:""}</span>
      <small>{hhmm(slot.startTime)}–{hhmm(slot.endTime)}</small>
    </button>;
  };
  return <section className="vs-v3-week" aria-label="Weekly timetable">
    <style>{css}</style>
    <div className="vs-v3-section-head">
      <strong>WEEK</strong><span>{current.length} lessons{irregular.length>0?" · "+irregular.length+" unverified":""}</span>
    </div>
    {rows.length===0 ? <>
      <div className="vs-week-notice" role="status">
        <div><strong>School periods not configured</strong><span>Saved lessons are visible below. Their period placement is not confirmed.</span></div>
        <a href="/teacher/timetable/setup">Set up</a>
      </div>
      <div className="vs-week-record-board" aria-label="Saved lessons by day">
        {teachingDays.map(day => {
          const saved = current.filter(slot => slot.dayOfWeek === day.d).sort((a,b)=>a.startTime.localeCompare(b.startTime));
          return <div key={day.d} className="vs-week-record-column">
            <div className="vs-week-record-column-head"><strong>{day.l} {dateForDow(day.d).slice(8)}</strong><span>{saved.length}</span></div>
            <div className="vs-week-record-column-list">{saved.length ? saved.map(slot=><div key={slot.id}>
              {card(slot)}
            </div>) : <span className="vs-week-none">No lessons</span>}</div>
          </div>;
        })}
      </div>
    </> : <div className="vs-v3-scroll" role="region" aria-label="Weekly school period grid" tabIndex={0}>
      <table>
        <thead><tr><th scope="col" className="vs-v3-time">TIME</th>
          {teachingDays.map(d=><th scope="col" key={d.d}><strong>{d.l}</strong><small>{dateForDow(d.d).slice(8)}</small></th>)}
        </tr></thead>
        <tbody>{rows.map(row=><tr key={row.start+row.end}>
          <th scope="row" className="vs-v3-time"><strong>{row.start}</strong><small>{row.end}</small></th>
          {teachingDays.map(day=>{
            const block=blockForDay(blocks,day.d,row.start,row.end);
            const occupying=current.filter(s=>s.dayOfWeek===day.d && matchingBlock(blocks,day.d,s) &&
              hhmm(s.startTime)<=row.start && hhmm(s.endTime)>=row.end);
            const candidates=occupying.filter(s=>hhmm(s.startTime)===row.start);
            const continuing=occupying.filter(s=>hhmm(s.startTime)<row.start);
            const activity=block&&block.kind!=="lesson";
            const tone=activity?periodAppearance(block.kind):null;
            return <td key={day.d} className={activity?"vs-v3-activity":""} style={tone?{background:tone.background}:undefined}>
              {activity?<span style={{color:tone?.text}}>{block.label}</span>:
                candidates.length ? <div className="vs-v3-cards">{candidates.map(card)}</div> :
                continuing.length ? <span className="vs-v3-continued" aria-label="Occupied by continuing lesson">Continues · {continuing.map(s=>s.subject).join(", ")}</span> :
                block?.kind==="lesson" && onAdd ? <button type="button" className="vs-v3-add"
                  aria-label={`Add lesson ${day.l} ${row.start} to ${row.end}`}
                  onClick={()=>onAdd({dayOfWeek:day.d,startTime:row.start,endTime:row.end})}>+</button>:null}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="vs-week-mobile" aria-label="Week day selector and lesson list">
      <div role="group" aria-label="Choose day" className="vs-week-mobile-days">
        {teachingDays.map(day=><button type="button" key={day.d} aria-pressed={focusedDay===day.d}
          className={focusedDay===day.d?"active":""} onClick={()=>setFocusedDay(day.d)}>
          <span>{day.l}</span><strong>{dateForDow(day.d).slice(8)}</strong>
          <small>{current.filter(s=>s.dayOfWeek===day.d).length}</small>
        </button>)}
      </div>
      <div className="vs-week-focus-header"><strong>{teachingDays.find(d=>d.d===focusedDay)?.l} {dateForDow(focusedDay).slice(8)}</strong>
        <span>{current.filter(s=>s.dayOfWeek===focusedDay).length} lessons</span></div>
      {focusedEntries.map((entry,index)=><div key={(entry.slot?.id ?? entry.activity?.id ?? String(index))} className="vs-week-focus-row">
        <span className="vs-week-focus-time">{hhmm(entry.start)}
          <small>{hhmm(entry.slot?.endTime ?? entry.activity?.endTime ?? "")}</small></span>
        {entry.slot ? <div>{card(entry.slot)}{rows.length>0 && !matchingBlock(blocks,focusedDay,entry.slot) &&
          <span className="vs-week-unverified">Unverified period</span>}</div>
          : entry.activity ? <div className="vs-week-activity"
            style={{background:periodAppearance(entry.activity.kind).background,
              borderLeftColor:periodAppearance(entry.activity.kind).border,
              color:periodAppearance(entry.activity.kind).text}}>
              {entry.activity.label}
            </div> : null}
      </div>)}
      {focusedEntries.length===0 &&
        <div className="vs-week-none" style={{padding:"20px 12px"}}>No lessons for this day.</div>}
    </div>
    {rows.length>0 && irregular.length>0 && <section className="vs-v3-review" aria-label="Existing lessons outside confirmed periods">
      <div className="vs-week-focus-header"><strong>{irregular.length} lessons need period review</strong>
        <a href="/teacher/timetable/setup">Review periods</a></div>
      <p>Preserved records. They do not create teaching periods.</p>
      <div className="vs-v3-irregular">{irregular.map(slot=><div key={slot.id} className="vs-v3-irregular-row">
        <span>{DAYS.find(d=>d.d===slot.dayOfWeek)?.l} · {hhmm(slot.startTime)}–{hhmm(slot.endTime)}</span>
        {card(slot)}
      </div>)}</div>
    </section>}
    {rows.length>0 && current.length===0 && <div className="vs-v3-empty">No lessons scheduled for this week.</div>}
  </section>;
}
const css=`
.vs-v3-week{background:var(--surface,#fff);border:1px solid var(--border-color,#e3e6e9);border-radius:8px;overflow:hidden;color:var(--text-primary,#16202a)}
.vs-v3-section-head{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:11px 13px;font-size:11px;border-bottom:1px solid var(--border-color,#e3e6e9)}
.vs-v3-section-head strong{font-size:10px;letter-spacing:.06em}.vs-v3-section-head span{opacity:.67}
.vs-v3-scroll{overflow-x:auto;max-width:100%}.vs-v3-scroll:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}
.vs-v3-week table{width:100%;min-width:680px;border-collapse:collapse;table-layout:fixed;font:inherit;font-size:12px}
.vs-v3-week th,.vs-v3-week td{border-right:1px solid var(--border-color,#e3e6e9);border-bottom:1px solid var(--border-color,#e3e6e9)}
.vs-v3-week th:last-child,.vs-v3-week td:last-child{border-right:0}
.vs-v3-week thead th{padding:10px 6px;background:var(--surface-raised,#f8f9fa);text-align:center}
.vs-v3-week thead th strong{display:block}.vs-v3-week thead th small{display:block;font-weight:400;font-size:10px;opacity:.6;margin-top:3px}
.vs-v3-week th.vs-v3-time{width:80px;text-align:left;padding:10px 9px;background:var(--surface-raised,#f8f9fa);position:sticky;left:0;z-index:2;font-weight:500}
.vs-v3-week th.vs-v3-time strong{display:block;font-size:11px}.vs-v3-week th.vs-v3-time small{display:block;opacity:.6;font-size:10px;margin-top:5px}
.vs-v3-week td{height:72px;vertical-align:middle;padding:4px;min-width:100px}
.vs-v3-cards{display:flex;flex-direction:column;gap:3px}
.vs-v3-lesson{width:100%;text-align:left;display:flex;flex-direction:column;gap:4px;border:0;border-left:3px solid;border-radius:4px;padding:9px 7px;cursor:pointer;font:inherit;min-height:58px}
.vs-v3-lesson:hover{filter:brightness(.96)}.vs-v3-lesson:focus-visible,.vs-v3-add:focus-visible{outline:2px solid #2563eb;outline-offset:1px}
.vs-v3-lesson strong{font-size:11px;line-height:1.2}.vs-v3-lesson span,.vs-v3-lesson small{font-size:10px;opacity:.8;line-height:1.2}
.vs-v3-add{width:100%;height:55px;background:transparent;border:1px solid transparent;border-radius:4px;color:var(--text-muted,#98a1aa);cursor:pointer;font-size:17px}
.vs-v3-add:hover{background:var(--surface-raised,#f8f9fa);border-color:var(--border-color,#e3e6e9)}
.vs-v3-activity{text-align:center;font-size:11px;font-weight:600}
.vs-v3-continued{display:block;text-align:center;font-size:10px;opacity:.6;padding:5px;line-height:1.3}
.vs-v3-empty{padding:22px 16px;line-height:1.5;font-size:12px}.vs-v3-empty p{margin:6px 0 10px;color:var(--text-muted,#667085)}
.vs-v3-review{padding:12px;border-top:1px solid var(--border-color,#e3e6e9);font-size:12px}
.vs-v3-review p{color:var(--text-muted,#667085)}.vs-week-focus-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 0;font-size:12px}.vs-week-focus-header a{color:#07684b;text-decoration:none;font-weight:700}
.vs-v3-irregular{display:grid;gap:8px}.vs-v3-irregular-row{display:grid;grid-template-columns:minmax(100px,160px) 1fr;align-items:center;gap:10px}.vs-v3-irregular-row>span{font-size:11px;color:var(--text-muted,#667085)}
.vs-week-notice{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:11px 13px;border-bottom:1px solid var(--border-color,#e3e6e9);background:var(--surface-raised,#f8f9fa);font-size:12px}
.vs-week-notice>div{display:grid;gap:2px}.vs-week-notice span{font-size:11px;color:var(--text-muted,#667085)}.vs-week-notice a,.vs-v3-section-head a{color:#07684b;text-decoration:none;font-weight:700}
.vs-week-record-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-top:1px solid var(--border-color,#e3e6e9)}
.vs-week-record-column{min-width:0;border-right:1px solid var(--border-color,#e3e6e9)}.vs-week-record-column:last-child{border-right:0}
.vs-week-record-column-head{display:flex;justify-content:space-between;gap:4px;padding:11px 7px;border-bottom:1px solid var(--border-color,#e3e6e9);background:var(--surface-raised,#f8f9fa);font-size:12px}
.vs-week-record-column-list{padding:6px;display:grid;align-content:start;gap:7px;min-height:130px}
.vs-week-unverified{display:block;font-size:10px;color:var(--text-muted,#667085);padding:4px 1px}
.vs-week-none{font-size:12px;color:var(--text-muted,#667085)}
.vs-week-mobile{display:none}.vs-week-mobile-days{display:flex;overflow-x:auto;scrollbar-width:none;gap:5px;padding:12px}
.vs-week-mobile-days button{min-width:48px;flex:1;border:1px solid var(--border-color,#e3e6e9);border-radius:7px;background:var(--surface,#fff);color:var(--text-primary,#17202a);padding:7px 4px;display:grid;justify-items:center;gap:3px;font:inherit;cursor:pointer}
.vs-week-mobile-days button.active{background:#07684b;color:white;border-color:#07684b}
.vs-week-mobile-days span{font-size:11px}.vs-week-mobile-days strong{font-size:14px}.vs-week-mobile-days small{font-size:10px;opacity:.75}
.vs-week-mobile>.vs-week-focus-header{padding:9px 12px;background:var(--surface-raised,#f8f9fa)}
.vs-week-focus-row{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px;margin:8px 12px;align-items:start}
.vs-week-focus-time{font-size:11px;padding-top:11px;font-weight:700;font-variant-numeric:tabular-nums}.vs-week-focus-time small{display:block;font-weight:400;color:var(--text-muted,#667085);padding-top:3px}
.vs-week-focus-row .vs-v3-lesson strong{font-size:13px}.vs-week-focus-row .vs-v3-lesson span{font-size:11px}.vs-week-focus-row .vs-v3-lesson small{display:none}
.vs-week-activity{padding:13px;border-left:3px solid;border-radius:5px;font-size:12px}
@media(max-width:650px){.vs-v3-scroll,.vs-week-record-board,.vs-v3-review{display:none}.vs-week-mobile{display:block}.vs-v3-section-head{align-items:center;flex-direction:row;gap:6px}.vs-week-notice{align-items:start}}
@media print{.vs-v3-scroll{overflow:visible}.vs-v3-week table{min-width:0}.vs-v3-lesson{print-color-adjust:exact}.vs-v3-add{display:none}.vs-v3-time{position:static!important}}
`;
