-- Behavioral fix 1 (audit F-08/F-12, proven by rollback test): the legacy
-- trigger ignores effective dates and vetoes legal date-disjoint revisions,
-- blocking update_timetable_slot, restore_timetable_snapshot and
-- duplicate_active_timetable. The date-aware GiST exclusion constraints
-- (excl_teacher_overlap / excl_class_overlap / excl_room_overlap) fully
-- subsume its correct subset.
drop trigger if exists trg_check_slot_overlap on public.timetable_slots;
drop function if exists public.fn_check_slot_overlap();
drop index if exists public.idx_timetable_overlap_check;
