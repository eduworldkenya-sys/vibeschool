-- Live provider, payment and school administration are NOT exercised in this disposable fixture.
do $$
begin
 if has_function_privilege('anon','public.success_wish_school_provision_minor(uuid,uuid,uuid,uuid,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.success_wish_school_provision_minor(uuid,uuid,uuid,uuid,text,text)','EXECUTE')
 then raise exception 'Public provisioning RPC exposure'; end if;
 if has_table_privilege('anon','public.success_wish_receiver_provisioning_audit','SELECT')
 or has_table_privilege('authenticated','public.success_wish_receiver_provisioning_audit','SELECT')
 then raise exception 'Public audit read exposure'; end if;
 if not (select relrowsecurity from pg_class where oid='public.success_wish_receiver_provisioning_audit'::regclass)
 then raise exception 'Provisioning audit RLS missing'; end if;
end $$;
set role service_role;
do $$
declare
  school1 uuid='11111111-1111-4111-8111-111111111111';
  school2 uuid='22222222-2222-4222-8222-222222222222';
  student1 uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  student2 uuid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  admin1 uuid='33333333-3333-4333-8333-333333333333';
  admin2 uuid='44444444-4444-4444-8444-444444444444';
  link1 uuid='70000000-0000-4000-8000-000000000001';
  link2 uuid='70000000-0000-4000-8000-000000000002';
  digest text=repeat('a',64);
  a uuid;
  b uuid;
begin
  a:=public.success_wish_school_provision_minor(school1,student1,link1,admin1,'+254712345678',digest);
  if a is null then raise exception 'Did not provision a legitimate school minor'; end if;
  b:=public.success_wish_school_provision_minor(school1,student1,link1,admin1,'+254712345678',digest);
  if a<>b then raise exception 'Retry created a second receiver'; end if;
  if (select consent_status from public.success_wish_receivers where id=a)<>'pending'
    or (select consent_route from public.success_wish_receivers where id=a)<>'guardian' then
    raise exception 'Provisioning skipped guardian consent'; end if;
  if (select count(*) from public.success_wish_receiver_provisioning_audit where receiver_id=a)<>1 then
    raise exception 'Missing provisioning audit'; end if;
  begin
    perform public.success_wish_school_provision_minor(school1,student2,link2,admin1,'+254712345678',digest);
    raise exception 'Cross-school candidate accepted';
  exception when check_violation then null; end;
  begin
    perform public.success_wish_school_provision_minor(school1,student1,link2,admin1,'+254712345678',digest);
    raise exception 'Cross-student guardian link accepted';
  exception when check_violation then null; end;
  begin
    perform public.success_wish_school_provision_minor(school2,student2,link2,admin1,'+254733222111',digest);
    raise exception 'Wrong school administrator accepted';
  exception when insufficient_privilege then null; end;
  update public.students set date_of_birth=current_date-interval '19 years' where id=student2;
  begin
    perform public.success_wish_school_provision_minor(school2,student2,link2,admin2,'+254733222111',digest);
    raise exception 'Adult accepted through minor path';
  exception when check_violation then null; end;
  update public.students set date_of_birth=current_date-interval '16 years' where id=student2;
  b:=public.success_wish_school_provision_minor(school2,student2,link2,admin2,'+254712345678',digest);
  if b is null or a=b then raise exception 'Shared-phone sibling receiver isolation failed'; end if;
  begin
    perform public.success_wish_school_provision_minor(school1,student1,link1,admin1,'+254733222111',digest);
    raise exception 'Existing receiver guardian phone silently changed';
  exception when check_violation then null; end;
end $$;
reset role;
