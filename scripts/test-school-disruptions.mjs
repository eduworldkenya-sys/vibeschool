// Static contracts for P0 school-day disruptions.
// Database integration, clean rebuild, RLS-negative-path and authenticated UI
// checks remain separate release gates; this test never claims those passed.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8")
const sql = read("supabase/migrations/20261112194500_school_disruption_occurrences_p0.sql")
const page = read("app/admin/calendar/disruptions/page.tsx")
const home = read("app/admin/page.tsx")
const base = read("supabase/migrations/20260718151116_18a_teaching_occurrences.sql")
const recovery = read("supabase/migrations/20260722124812_tbl009a_recovery_writer.sql")
const calendar = read("supabase/migrations/20260925113000_modern_timetable_operations.sql")

test("extends canonical exceptions, occurrences and recovery without a competing engine", () => {
  assert.match(calendar, /create table if not exists public\.school_calendar_exceptions/)
  assert.match(base, /create table if not exists public\.teaching_occurrences/)
  assert.match(recovery, /create or replace function public\.schedule_recovery_occurrence/)
  assert.match(sql, /alter table public\.school_calendar_exceptions[\s\S]*add column if not exists disruption_reason_code/)
  assert.match(sql, /alter table public\.teaching_occurrences[\s\S]*add column if not exists disruption_exception_id/)
  assert.doesNotMatch(sql, /drop table public\.teaching_occurrences/i)
  assert.doesNotMatch(sql, /update public\.scheme_of_work/i)
})

test("closed day approval is admin-only, school scoped and repeat-safe", () => {
  assert.match(sql, /function public\.admin_preview_school_disruption/)
  assert.match(sql, /function public\.admin_record_school_disruption/)
  assert.match(sql, /function public\.admin_reopen_school_disruption/)
  assert.match(sql, /not public\.is_school_admin\(p_school_id\)/)
  assert.match(sql, /not public\.is_school_admin\(v_school_id\)/)
  assert.match(sql, /DISRUPTION_ALREADY_RECORDED_WITH_DIFFERENT_DETAILS/)
  assert.match(sql, /status','already_recorded'/)
  assert.match(sql, /DATE_OUTSIDE_SCHOOL_TERM/)
  assert.match(sql, /grant execute on function public\.admin_record_school_disruption[\s\S]*to authenticated/)
  assert.match(sql, /revoke all on function public\.admin_record_school_disruption[\s\S]*from public,anon,authenticated/)
})

test("completed teaching survives and closure never becomes teacher absence", () => {
  assert.match(sql, /v_active_count>0 then raise exception 'LESSONS_ALREADY_IN_PROGRESS'/)
  assert.match(sql, /o\.lifecycle in \('planned','ready'\)/)
  assert.match(sql, /lifecycle='missed',disruption_exception_id=v_ce\.id/)
  assert.match(sql, /on conflict \(timetable_slot_id,occurrence_date\) do nothing/)
  assert.match(sql, /disruption_previous_lifecycle=o\.lifecycle/)
  assert.match(sql, /disruption_previous_reason=o\.exception_reason/)
  assert.match(sql, /completed_lessons_preserved/)
  assert.doesNotMatch(sql, /set lifecycle='completed'/)
})

test("start and closure share lock; late generators cannot create false planned lessons", () => {
  assert.match(sql, /school-disruption:'\|\|p_school_id::text\|\|':'\|\|p_date::text/)
  assert.match(sql, /school-disruption:'\|\|new.school_id::text\|\|':'\|\|new.occurrence_date::text/)
  assert.match(sql, /if tg_op='INSERT' then/)
  assert.match(sql, /new\.lifecycle := 'missed'/)
  assert.match(sql, /raise exception 'SCHOOL_DAY_CLOSED'/)
  assert.match(sql, /raise exception 'RECOVERY_DATE_CLOSED'/)
  assert.match(sql, /create trigger guard_school_disruption_teaching/)
})

test("reopen is audited, reversible and does not erase past missed lessons", () => {
  assert.match(sql, /create table if not exists public\.school_disruption_audit/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /grant select on public\.school_disruption_audit to authenticated/)
  assert.match(sql, /action in \('recorded','reopened'\)/)
  assert.match(sql, /case when o\.occurrence_date<v_today then 'missed'/)
  assert.match(sql, /disruption_exception_id=null,disruption_previous_lifecycle=null/)
  assert.match(sql, /set suppress_ordinary_teaching=false/)
  assert.match(sql, /'reopened',v_ce\.disruption_reason_code/)
  assert.doesNotMatch(sql, /delete from public\.teaching_occurrences/i)
})

test("admin UI previews impact, confirms deliberately and disclaims partial days", () => {
  assert.match(page, /getAdminSchoolAuthority\(/)
  assert.match(page, /admin_preview_school_disruption/)
  assert.match(page, /admin_record_school_disruption/)
  assert.match(page, /admin_reopen_school_disruption/)
  assert.match(page, /preview\.can_confirm/)
  assert.match(page, /preview\.date!==date/)
  assert.match(page, /Partial-day handling is not yet supported/)
  assert.match(home, /\/admin\/calendar\/disruptions/)
})
