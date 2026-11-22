-- Grade 4 CRE 2.1: KICD revised 2024, printed page 8, PDF page 16.
-- Guarded, forward-only correction of a proven source mismatch.
do $$
declare n integer;
begin
  update public.cbc_strands
  set sub_strand='2.1 Respect for the Holy Bible',
      learning_outcomes=ARRAY[
        'a) handle the Holy Bible with respect as the inspired word of God;',
        'b) identify the books in the Old and New Testament;',
        'c) play a game naming books in the Old and New Testament;',
        'd) recite Isaiah 49:16 and desire to read the Holy Bible always;'
      ]::text[]
  where grade='Grade 4'
    and subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'
    and source_ref='owner-approved:grade4-cre:2026-11-22'
    and sub_strand='2.1 The Inspired Word of God'
    and cardinality(learning_outcomes)=4;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Expected one Grade 4 CRE 2.1 row, changed %',n; end if;
end $$;
