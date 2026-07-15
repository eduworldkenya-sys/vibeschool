-- Stage 2 data backfill: populate sub_strand_id on curriculum,
-- scheme_of_work, and vibe_chapters by matching existing free-text
-- subject/grade/sub_strand values against real cbc_strands rows.
-- Already run manually against live DB — this file documents it
-- for migration history / fresh-environment setup.

update vibe_chapters vc
set sub_strand_id = cs.id
from vibe_publications vp
join subjects s
  on s.school_id is null and lower(s.name) = lower(vp.cbc_subject)
join cbc_strands cs
  on cs.subject_id = s.id
  and lower(cs.grade) = lower(vp.cbc_grade)
where vc.publication_id = vp.id
  and lower(cs.sub_strand) = lower(vc.cbc_strand)
  and vc.sub_strand_id is null;

update curriculum c
set sub_strand_id = cs.id
from subjects s
join cbc_strands cs
  on cs.subject_id = s.id
where s.school_id is null
  and lower(s.name) = lower(c.subject)
  and lower(cs.grade) = lower(c.grade)
  and lower(cs.sub_strand) = lower(c.sub_strand)
  and c.sub_strand_id is null;

update scheme_of_work sw
set sub_strand_id = cs.id
from subjects s
join cbc_strands cs
  on cs.subject_id = s.id
where s.school_id is null
  and lower(s.name) = lower(sw.subject)
  and lower(cs.grade) = lower(sw.grade)
  and lower(cs.sub_strand) = lower(sw.sub_strand)
  and sw.sub_strand_id is null;
