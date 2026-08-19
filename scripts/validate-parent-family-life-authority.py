#!/usr/bin/env python3
from pathlib import Path
R=Path(__file__).resolve().parents[1]; t=(R/'supabase/migrations/20260820000090_task6_parent_family_life_bola_closure.sql').read_text()
for x in ['child_goals','child_skills','child_books','child_events']:
 assert f'{x}.parent_id = (select auth.uid())' in t and f'public.is_parent_of_student({x}.student_id)' in t
for n in ['g.student_id = child_goal_milestones.student_id','public.is_parent_of_student(g.student_id)','create or replace function public.parent_get_linked_pathway_passports',"coalesce(l.access_level, 'full') <> 'none'",'from public, anon, service_role','to authenticated']: assert n in t,n
print('Parent Family Life Cross-Child Authority Contract: PASS')
