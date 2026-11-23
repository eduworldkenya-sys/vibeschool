"use client";

import React from "react";
import { periodAppearance } from "@/lib/timetable/periodAppearance";
import { subjectTone } from "@/lib/timetable/subjectColor";

/**
 * Premium weekly calendar presentation of the EXISTING teacher timetable.
 * All authority stays with the parent page, its canonical reader and the
 * existing add/edit/occurrence workflows. No new schedule state is created.
 */
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
const DAYS = [
  { d: 1, l: "Mon" }, { d: 2, l: "Tue" }, { d: 3, l: "Wed" },
  { d: 4, l: "Thu" }, { d: 5, l: "Fri" }, { d: 6, l: "Sat" }, { d: 7, l: "Sun" },
];
const time = (value: string) => value.slice(0, 5);
const isActive = (slot: ClassicSlot, date: string) =>
  slot.effectiveFrom <= date && (slot.effectiveUntil === null || slot.effectiveUntil >= date);
const overlaps = (a: ClassicSlot, b: ClassicSlot) =>
  a.id !== b.id && a.dayOfWeek === b.dayOfWeek &&
  time(a.startTime) < time(b.endTime) && time(a.endTime) > time(b.startTime);

export default function ClassicTimetable({
  slots, blocks, dateForDow, onSelect, onAdd,
}: {
  slots: ClassicSlot[];
  blocks: SchoolDayBlock[];
  dateForDow: (dow: number) => string;
  onSelect: (slot: ClassicSlot) => void;
  onAdd?: (placement: Placement) => void;
}) {
  const activeSlots = slots.filter(slot => isActive(slot, dateForDow(slot.dayOfWeek)));
  const days = DAYS.filter(day =>
    day.d <= 5 || activeSlots.some(slot => slot.dayOfWeek === day.d) ||
    blocks.some(block => block.scheduleDay === day.d)
  );

  // Preserve all old time boundaries, including custom periods and historical
  // overlaps. Consecutive double lessons span rows rather than appearing twice.
  const boundaries = [...new Set([
    ...blocks.flatMap(block => [time(block.startTime), time(block.endTime)]),
    ...activeSlots.flatMap(slot => [time(slot.startTime), time(slot.endTime)]),
  ])].sort();
  const rows = boundaries.slice(0, -1).map((start, index) => ({
    start, end: boundaries[index + 1],
  }));
  const covering = (day: number, row: { start: string; end: string }) =>
    blocks.find(block => block.scheduleDay === day &&
      time(block.startTime) <= row.start && time(block.endTime) >= row.end) ??
    blocks.find(block => block.scheduleDay === 0 &&
      time(block.startTime) <= row.start && time(block.endTime) >= row.end);

  if (!rows.length) {
    return <section className="vs-timetable-empty" aria-label="Empty timetable">
      <strong>No lessons scheduled</strong>
      <span>Use Add lesson or open Timetable setup to begin.</span>
      <style>{styles}</style>
    </section>;
  }

  return <section className="vs-timetable-week" aria-label="Weekly timetable">
    <style>{styles}</style>
    <div className="vs-timetable-scroll" role="region" aria-label="Scrollable weekly timetable" tabIndex={0}>
      <table aria-label="Conventional weekly timetable">
        <thead><tr>
          <th scope="col" className="vs-time-heading">Time</th>
          {days.map(day => <th scope="col" key={day.d}>
            <span>{day.l}</span>
            <small>{activeSlots.filter(slot => slot.dayOfWeek === day.d).length} lessons</small>
          </th>)}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.start}>
          <th scope="row" className="vs-time-cell">
            <span>{row.start}</span><small>{row.end}</small>
          </th>
          {days.map(day => {
            const found = activeSlots.filter(slot =>
              slot.dayOfWeek === day.d &&
              time(slot.startTime) <= row.start &&
              time(slot.endTime) > row.start
            );
            const preceding = found.length === 1 &&
              time(found[0].startTime) < row.start &&
              !activeSlots.some(other => overlaps(found[0], other));
            if (preceding) return null;
            const hasOverlap = found.length === 1 &&
              activeSlots.some(other => overlaps(found[0], other));
            const span = found.length === 1 && !hasOverlap
              ? rows.filter(part => part.start >= row.start &&
                part.start < time(found[0].endTime)).length : 1;
            const block = covering(day.d, row);

            // Never conceal pre-existing overlaps or legacy/custom slots.
            if (found.length) return <td key={day.d} rowSpan={span}
              className={hasOverlap || found.length > 1 ? "vs-conflict-cell" : ""}>
              {found.map(slot => <button key={slot.id} type="button"
                className="vs-lesson"
                style={{background:subjectTone(slot.subject).background,color:subjectTone(slot.subject).foreground,borderLeftColor:subjectTone(slot.subject).border}}
                aria-label={`Open ${slot.subject}, ${slot.className}, ${day.l} ${time(slot.startTime)}–${time(slot.endTime)}`}
                onClick={() => onSelect(slot)}>
                <strong>{slot.subject}</strong>
                <span>{slot.className}{slot.room ? ` · ${slot.room}` : ""}</span>
                <small>{time(slot.startTime)}–{time(slot.endTime)}</small>
              </button>)}
            </td>;

            if (block && block.kind !== "lesson") {
              const tone = periodAppearance(block.kind);
              return <td key={day.d}
                aria-label={`${tone.label}: ${block.label}, ${row.start} to ${row.end}`}
                style={{ background: tone.background, borderLeft: `2px solid ${tone.border}` }}>
                <span className="vs-activity" style={{ color: tone.text }}>{block.label}</span>
              </td>;
            }
            const canPlace = Boolean(onAdd && (!blocks.length ||
              (block?.kind === "lesson" && !activeSlots.some(slot =>
                slot.dayOfWeek === day.d && time(slot.startTime) < time(block.endTime) &&
                time(slot.endTime) > time(block.startTime)))));
            return <td key={day.d} className="vs-open-cell">
              {canPlace && <button type="button" className="vs-add"
                aria-label={`Add lesson ${day.l} ${row.start}`}
                onClick={() => onAdd?.({
                  dayOfWeek: day.d,
                  startTime: block ? time(block.startTime) : row.start,
                  endTime: block ? time(block.endTime) : row.end,
                })}>+ <span>Add lesson</span></button>}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

const styles = `
.vs-timetable-week,.vs-timetable-empty { color:var(--text-primary,#171c25);background:var(--surface,#fff);border:1px solid var(--border-color,#e4e8ee);border-radius:8px;overflow:hidden; }
.vs-timetable-scroll { overflow-x:auto;max-width:100%;overscroll-behavior-x:contain; }
.vs-timetable-scroll:focus-visible { outline:2px solid var(--focus-ring,#2563eb);outline-offset:-2px; }
.vs-timetable-week table { border-collapse:separate;border-spacing:0;min-width:720px;width:100%;table-layout:fixed;font:inherit;font-size:12px; }
.vs-timetable-week th,.vs-timetable-week td { border-right:1px solid var(--border-color,#e4e8ee);border-bottom:1px solid var(--border-color,#e4e8ee); }
.vs-timetable-week tr:last-child td,.vs-timetable-week tr:last-child th { border-bottom:0; }
.vs-timetable-week th:last-child,.vs-timetable-week td:last-child { border-right:0; }
.vs-timetable-week thead th { padding:11px 8px;background:var(--surface-raised,#f8f9fb);font-weight:650;text-align:left;vertical-align:middle; }
.vs-timetable-week thead th small { display:block;font-size:10px;font-weight:450;opacity:.65;margin-top:3px; }
.vs-timetable-week .vs-time-heading { position:sticky;left:0;z-index:3;width:94px; }
.vs-timetable-week .vs-time-cell { position:sticky;left:0;z-index:2;width:94px;padding:12px 9px;text-align:left;vertical-align:top;background:var(--surface,#fff);white-space:nowrap;font-size:11px;font-weight:650;font-variant-numeric:tabular-nums; }
.vs-timetable-week .vs-time-cell small { display:block;margin-top:3px;opacity:.55;font-size:10px;font-weight:450; }
.vs-timetable-week td { padding:5px;min-width:116px;vertical-align:top;height:54px; }
.vs-timetable-week .vs-lesson { display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;padding:9px 8px;min-height:57px;margin:0 0 3px;text-align:left;font:inherit;color:inherit;background:var(--surface-raised,#f8f9fb);border:1px solid var(--border-color,#e4e8ee);border-left:3px solid var(--text-primary,#374151);border-radius:4px;cursor:pointer; }
.vs-timetable-week .vs-lesson:hover { background:var(--surface-hover,#eef2f6);border-color:var(--text-muted,#9ca3af); }
.vs-timetable-week .vs-lesson:focus-visible,.vs-timetable-week .vs-add:focus-visible { outline:2px solid #2563eb;outline-offset:2px; }
.vs-timetable-week .vs-lesson strong {font-weight:680;line-height:1.25;}
.vs-timetable-week .vs-lesson span {font-size:11px;opacity:.8;line-height:1.25;}
.vs-timetable-week .vs-lesson small {font-size:10px;opacity:.65;font-variant-numeric:tabular-nums;}
.vs-timetable-week .vs-open-cell {background:var(--surface,#fff);}
.vs-timetable-week .vs-add {font:inherit;font-size:11px;padding:10px 6px;width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;gap:5px;border:1px dashed transparent;border-radius:4px;background:transparent;color:var(--text-muted,#667085);cursor:pointer;}
.vs-timetable-week .vs-add:hover {border-color:var(--border-color,#cbd5e1);background:var(--surface-raised,#f8f9fb);}
.vs-timetable-week .vs-activity {display:block;text-align:center;font-size:11px;font-weight:600;padding:8px 3px;}
.vs-timetable-week .vs-conflict-cell {background:var(--warning-bg,#fff7ed);}
.vs-timetable-empty {padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;}
.vs-timetable-empty span {font-size:12px;opacity:.7;}
@media(max-width:640px) { .vs-timetable-week table {min-width:680px;} .vs-timetable-week .vs-time-heading,.vs-timetable-week .vs-time-cell {width:76px;} .vs-timetable-week td {padding:3px;} .vs-timetable-week .vs-add span {display:none;} }
@media print { .vs-timetable-week {border:0;overflow:visible;} .vs-timetable-scroll {overflow:visible;} .vs-timetable-week table {min-width:0;font-size:10px;} .vs-timetable-week .vs-lesson {border:1px solid #bbb;background:#fff;color:#000;break-inside:avoid;} .vs-timetable-week .vs-add {display:none;} .vs-timetable-week .vs-time-cell,.vs-timetable-week thead th {position:static;background:#fff;color:#000;} }
`;
