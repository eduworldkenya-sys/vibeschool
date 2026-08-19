#!/usr/bin/env python3
from pathlib import Path
R=Path(__file__).resolve().parents[1]; t=(R/'supabase/migrations/20260820000080_task6_parent_consequential_rpc_revocation_closure.sql').read_text()
def q(n):
    assert n in t,n
for n in ['revoke all on function public.parent_start_conversation(uuid,uuid,text)','create or replace function public.parent_start_child_thread','if not public.is_parent_of_student(p_student_id)','from public.student_classes sc','sc.is_current = true','tc.school_id = v_school_id','t.student_id = p_student_id','t.school_id = v_school_id','vp.left_at is null','create or replace function public.parent_set_student_self_use','and deleted_at is null','create or replace function public.parent_get_student_kcse_brief','and released_at is not null']: q(n)
print('Parent Consequential RPC Authority Contract: PASS')
