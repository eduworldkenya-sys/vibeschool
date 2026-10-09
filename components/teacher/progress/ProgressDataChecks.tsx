import { progressDataChecks } from '@/lib/learner-intelligence/progress-review'
import type { ProgressEvidence } from '@/lib/learner-intelligence/progress-record'

export default function ProgressDataChecks({rows}:{rows:ProgressEvidence[]}) {
  const checks = progressDataChecks(rows)
  return <><style>{`@media print { @page {size:A4;margin:12mm;} body * {visibility:hidden;} .progress-print,.progress-print * {visibility:visible;} .progress-print {position:absolute!important;left:0;top:0;width:100%!important;max-width:none!important;padding:0!important;} .progress-print [data-progress-controls],.progress-print nav,.progress-print details[aria-label="Progress data checks"] {display:none!important;} .progress-print > section:first-of-type {background:#fff!important;color:#111827!important;border:1px solid #d1d5db;} }`}</style><details aria-label="Progress data checks" style={{marginTop:12,padding:15,border:'1px solid #d1d5db',borderRadius:15,background:'#fff'}}>
    <summary style={{minHeight:44,fontWeight:800,cursor:'pointer'}}>Data checks · {checks.observations} source observations</summary>
    <p style={{fontSize:12,lineHeight:1.7}}>All loaded evidence in the selected subject, across dates. {checks.sources.length?`Sources: ${checks.sources.map(source=>source.replaceAll('_',' ')).join(', ')}.`:'No source evidence is available.'}</p>
    <ul style={{fontSize:12,lineHeight:1.9,paddingLeft:20}}>
      <li>{checks.unknownSubject} records need subject identity reconciliation and are excluded from learning judgments.</li>
      <li>{checks.unlinked} observations need curriculum outcome links. Subject totals do not establish outcome mastery.</li>
      <li>{checks.unknownMaximum} marks have no recorded maximum; percentages are withheld.</li>
      <li>{checks.invalidScale} scores have an invalid scale; review the source record.</li>
      <li>{checks.noRecordedLevel} observations have no recorded expectation level. A numeric score is retained separately.</li>
      <li>{checks.repeatedSourceRows} repeated source rows were reconciled to one observation.</li>
      <li>{checks.captureDates} legacy entries use their original data-entry date. This does not establish the exact assessment date.</li>
      <li>{checks.futureDated} future-dated observations are excluded from progress judgments.</li>
    </ul>
    <p style={{fontSize:11,lineHeight:1.7,color:"var(--teacher-muted, #627168)"}}>Only evidence readable in your assigned scope is included. These checks do not prove every source is complete or released. Use the school report workflow for parent sharing.</p>
  </details></>
}
