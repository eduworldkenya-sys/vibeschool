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
      <strong>WEEKLY SCHEDULE</strong><span>{current.length} lessons · {irregular.length} needing period review</span>
    </div>
    {rows.length===0 ? <div className="vs-v3-empty" role="status">
      <strong>School day not configured</strong>
      <p>No confirmed teaching periods are available for this school. Existing lessons remain visible below; configure the real school day to build the calendar.</p>
      <a href="/teacher/timetable/setup">Open school day setup</a>
    </div> : <div className="vs-v3-scroll" role="region" aria-label="Weekly school period grid" tabIndex={0}>
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
    {irregular.length>0 && <details className="vs-v3-review">
      <summary>{irregular.length} existing lesson{irregular.length===1?"":"s"} outside confirmed periods · Review</summary>
      <p>These records are preserved. They do not create artificial time rows or authorize new school periods.</p>
      <div className="vs-v3-irregular">{irregular.map(slot=><div key={slot.id} className="vs-v3-irregular-row">
        <span>{DAYS.find(d=>d.d===slot.dayOfWeek)?.l} · {hhmm(slot.startTime)}–{hhmm(slot.endTime)}</span>
        {card(slot)}
      </div>)}</div>
    </details>}
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
.vs-v3-review summary{cursor:pointer;font-weight:650}.vs-v3-review p{color:var(--text-muted,#667085)}
.vs-v3-irregular{display:grid;gap:8px}.vs-v3-irregular-row{display:grid;grid-template-columns:minmax(100px,160px) 1fr;align-items:center;gap:10px}.vs-v3-irregular-row>span{font-size:11px;color:var(--text-muted,#667085)}
@media(max-width:650px){.vs-v3-week table{min-width:680px}.vs-v3-week th.vs-v3-time{width:68px}.vs-v3-section-head{align-items:start;flex-direction:column;gap:4px}}
@media print{.vs-v3-scroll{overflow:visible}.vs-v3-week table{min-width:0}.vs-v3-lesson{print-color-adjust:exact}.vs-v3-add{display:none}.vs-v3-time{position:static!important}}
`;
