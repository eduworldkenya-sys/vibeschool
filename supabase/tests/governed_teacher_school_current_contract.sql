begin;
do $$ begin
 if to_regclass('public.teacher_school_claims') is null then raise exception 'teacher_school_claims missing'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='teacher_school_claims' and c.relrowsecurity) then raise exception 'teacher_school_claims RLS disabled'; end if;
 if to_regprocedure('public.submit_teacher_school_claim(uuid,uuid,text[])') is null then raise exception 'submit claim RPC missing'; end if;
 if to_regprocedure('public.review_teacher_school_claim(uuid,text,text)') is null then raise exception 'review claim RPC missing'; end if;
end $$;
rollback;
