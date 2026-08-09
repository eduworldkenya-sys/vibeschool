do $$ declare d text; begin
select pg_get_functiondef('public.run_content_intelligence_cycle(text)'::regprocedure) into d;
d:=replace(d,$x$'content_improvement'$x$,$x$'review_candidate'$x$);
d:=replace(d,$x$coalesce(b.plain_text,'') , '',$x$,$x$coalesce(b.plain_text,''), 'Research required before editorial patch.',$x$);
d:=replace(d,$x$'outcome mapping required'$x$,$x$'C1'$x$);
d:=replace(d,$x$'linked curriculum outcome'$x$,$x$'C4'$x$);
d:=replace(d,$x$'needs_research'$x$,$x$'insufficient_evidence'$x$);
d:=replace(d,$x$'proposed'$x$,$x$'pending_review'$x$);
d:=replace(d,$x$'applying'$x$,$x$'applied'$x$);
d:=replace(d,$x$,v_run,'insufficient_evidence'$x$,$x$,v_run,'needs_review'$x$);
execute d; end $$;