# School Information Authority

## Mission
Give every school community member one coherent, authoritative view of school information without making School Hub the owner of unrelated domains.

## Domain ownership
- Membership and active school: school membership authority.
- Academic terms and instructional weeks: academic calendar authority.
- Teaching schedule and teaching-suppressing exceptions: timetable authority.
- Official notices and acknowledgement: VibeConnect circular authority.
- Policies and staff documents: school resources authority.
- General school events: dedicated school-events authority.
- School Hub: teacher-facing aggregation and routing only.

## Non-negotiable invariants
1. No hard-coded calendar, policy, notice, or event records in production UI.
2. No duplicate calendar/communications/document tables created for School Hub.
3. Every school-owned row is school-scoped and protected by RLS.
4. Readers derive the active school from canonical membership context.
5. Audience targeting is resolved server-side; clients cannot broaden an audience.
6. Events that suppress teaching link to timetable calendar exceptions rather than silently changing occurrences.
7. Official communications continue through vc_circulars/vc_circular_recipients.
8. Documents continue through resource_documents and its storage/security boundary.
9. School Hub only aggregates information relevant to the current teacher.
10. Parent/student surfaces receive only explicitly targeted information.

## Closure boundary
- Reconcile existing calendar, communication, and document authorities.
- Add canonical general school events with audience targeting and lifecycle.
- Add teacher-safe read model/RPC for relevant school information.
- Replace School Hub placeholders with authoritative aggregation.
- Preserve timetable occurrence semantics.
- Preserve circular acknowledgement semantics.
- Preserve document visibility semantics.
- Add cross-school negative tests, audience tests, lifecycle tests, and no-placeholder contract.
- Pass TypeScript/build, migration reconstruction, RLS/security, and dedicated school-information certification.

## Explicitly out of scope
School Hub does not become an ERP, timetable editor, document CMS, messaging backend, exam engine, attendance store, or homework store.
