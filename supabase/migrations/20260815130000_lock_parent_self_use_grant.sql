-- parent_set_student_self_use is an authenticated parent action.
-- Keep the function callable by authenticated users only; the function itself
-- also verifies the caller owns the parent->student relationship.
revoke execute on function public.parent_set_student_self_use(uuid, boolean) from anon;
grant execute on function public.parent_set_student_self_use(uuid, boolean) to authenticated;
