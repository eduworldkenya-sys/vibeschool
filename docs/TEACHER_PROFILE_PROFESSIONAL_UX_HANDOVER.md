# Teacher Profile Professional UX — Handover

Date: 2026-08-18  
Scope: `/teacher/profile` + avatar storage contract  
Branch: `agent/teacher-profile-professional-ux-20260818`

## Product decision

Teacher Profile is a professional identity surface, not a duplicate HR/admin control room. The page now focuses on:

1. professional identity and trust,
2. teacher-owned personal/contact details,
3. teacher-owned professional details,
4. qualifications and professional development,
5. teaching preferences used as professional context,
6. read-only authoritative school/class/subject assignment.

Attendance, leave, appraisal, messages, documents and finance are deliberately not presented as unfinished profile tabs. They belong in their own operational modules.

## Defects found and closed

- Avatar upload was exposed in UI while production had no `avatars` storage bucket.
- The old upload path used `avatars/<user>.<ext>` while the desired storage boundary is a user-owned top-level folder.
- Teacher Profile attempted delete/insert mutations on `teacher_classes`, while production RLS correctly reserves those writes for school admins/owners.
- School/class/subject authority was visually mixed with teacher-owned profile fields.
- The ten-section profile mixed identity with HR operations and contained incomplete/coming-soon experiences.
- Feedback, accessibility and mobile hierarchy were weak for a high-trust profile form.

## Implementation

- Rebuilt the page around Overview, Personal, Professional, Credentials and Teaching Preferences.
- Added a professional identity header, completion meter, school/TSC/role context, responsive assignment cards and explicit ownership messaging.
- School membership and class/subject assignments are read-only and labelled “Managed by your school”.
- Saving now updates only `profiles` and `teacher_profiles`; it never mutates `teacher_classes`.
- Credentials remain stored in the existing JSONB contracts on `teacher_profiles`.
- Avatar upload supports JPEG/PNG/WebP up to 3 MB at `<auth.uid()>/profile.<ext>`.
- Upload, save and failure states are announced with status/alert semantics; all editable controls have visible labels.
- Removed unfinished operational surfaces from the profile experience.

## Supabase production change

Migration ledger version: `20260818152550_teacher_profile_avatar_storage`

The migration creates/configures the public `avatars` bucket with:
- 3 MB maximum object size,
- JPEG/PNG/WebP MIME restriction,
- public read for profile rendering,
- authenticated owner-scoped insert/update/delete policies.

No teacher assignment RLS was weakened. Existing admin/owner authority on `teacher_classes` remains the source of truth.

## Authority boundary

Teacher-owned:
- personal/contact fields,
- professional identity fields in `teacher_profiles`,
- qualifications / professional development,
- teaching preferences,
- avatar.

School-owned:
- school membership,
- class assignment,
- subject assignment.

This distinction is intentional and should remain intact in future UI work.

## Certification checklist

- [ ] Exact branch head reviewed against current `main`.
- [ ] TypeScript check passes.
- [ ] Production build passes.
- [ ] Existing repository CI gates pass.
- [ ] Production avatar bucket and RLS re-queried after migration.
- [ ] PR diff contains only intended profile/storage/handover changes.
- [ ] PR merged only after exact-head certification.

## Follow-up boundary

Do not re-add attendance, leave, appraisal, messages, documents, payroll or finance as “Profile” tabs. Link to dedicated operational surfaces when those modules are ready.
