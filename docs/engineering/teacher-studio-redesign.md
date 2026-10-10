# Teacher Studio redesign

Teacher OS uses the approved warm-neutral canvas, plum action colour, Manrope headings and DM Sans body typography. Fonts are self-hosted variable WOFF2 files, subset by Unicode range, with their OFL licences. Student, HQ and public surfaces keep their existing theme.

| Surface | Implementation |
| --- | --- |
| Today | Next-action hero with expandable detail, visual attendance/work counters and mixed-size contextual tools |
| Subject | Prepare, Teach and Check-learning tool tiles; class selection and canonical lesson handoff retained; guidance available in disclosures |
| Lesson plans | Responsive lesson cards, existing readiness filters and occurrence-based preparation |
| Scheme | Wrapping week controls, lesson cards, canonical commit/reflection/status actions retained |
| Lesson workspace | Shared studio controls and bounded desktop sheet; existing preparation/start/evidence/homework/completion flow |
| Lesson notes / Teach | Plum surfaces, readable typography, existing timing, offline pack, differentiation and completion authority |
| Class / learner | Class cards and workbook actions; learner record theme applied through its shell without changing the independently owned canonical-record file |
| Class / individual progress | Evidence cards and history; numeric meters only where a recorded numeric score exists; filters, exports and archive semantics retained |
| Workbook | Studio typography, colours, summary and tool tiles; spreadsheet editing, identity, formula safety and print behavior retained |
| Support | Responsive intervention cards, recorded priorities, baseline/follow-up and existing lifecycle actions |
| Curriculum / analytics | Recorded outcome-score meters, absent-data states and assessment-specific scope |
| School | Visual class, timetable and school-context shortcuts; existing notices, appointments and administration |
| Library | Studio hero and shared controls; adoption, publication and reading-assignment workflows retained |
| Assessment | Shared shell theme adapter for independently owned CSS module; recording and bulk-action source unchanged |

No demo data, overall learner mastery, approval state or curriculum coverage is added. Attendance remains a register statement; teaching completion and learner mastery remain separate. Semantic success, warning and error colors are not replaced by decorative plum.

## Validation

Run typecheck, lint and build sequentially: Next build replaces generated `.next/types` files, so running standalone TypeScript simultaneously can produce transient missing-generated-file errors.

Relevant existing regressions: teacher UI/navigation/landmarks/attendance semantics, subject companion context, student progress record, progress workspace, progress support and class workbook. Local compilation uses build-only placeholders when production environment variables are absent; this does not verify production authentication or database access. Authenticated browser and protected CI evidence must be collected against the exact PR head before merge.

The learner-record, timetable and assessment root source leases are preserved. Styling of the protected learner and assessment roots is scoped to `data-studio-view` in the teacher shell. Assessment CSS-module prefix adapters must be updated if those class names change.
