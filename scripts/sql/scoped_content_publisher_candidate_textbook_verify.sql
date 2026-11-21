-- Synthetic identities only; MUST run inside a transaction ending ROLLBACK.
do $fixture$
declare own uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); x uuid:=gen_random_uuid();
 b uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid(); ch uuid:=gen_random_uuid(); err text; rev uuid; failures integer:=0;
begin
 if auth.uid() is not null then raise exception 'fixture_requires_null_actor'; end if;
 insert into auth.users(id,raw_user_meta_data) select id,'{"full_name":"ROLLBACK TEST ONLY"}'::jsonb from unnest(array[own,a,d,x]) id;
 update public.profiles set role='teacher' where id in (a,d);
 insert into public.platform_owners(profile_id,added_by,note) values(own,'rollback synthetic fixture','never committed');
 insert into public.vibe_publications(id,author_id,format,title,pricing,status,cbc_grade,cbc_subject) values(b,a,'vibetextbook','ROLLBACK TEST BOOK','{"type":"free"}','draft','Grade 4','Mathematics'),(b2,a,'vibetextbook','ROLLBACK TEST CROSS SCOPE','{"type":"free"}','draft','Grade 4','Mathematics');
 insert into public.vibe_chapters(id,publication_id,title,number,blocks,word_count,status) values(ch,b,'Synthetic chapter',1,'[{"id":"fixture","type":"paragraph","content":"Synthetic rollback fixture; not educational material."}]',8,'draft');
 insert into public.publication_release_approvals(publication_id,status,content_fingerprint,reviewed_by,notes) values(b,'approved',public.publication_release_fingerprint(b),own,'synthetic fixture only');
 -- unauthenticated owner
 perform set_config('request.jwt.claim.sub',x::text,true);
 begin perform public.hq_bind_publication_release_publisher(b,d,clock_timestamp()+interval '10 minutes'); raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'authenticated_platform_owner_required' then raise; end if; failures:=failures+1; end;
 -- wrong role
 perform set_config('request.jwt.claim.sub',own::text,true);
 begin perform public.hq_bind_publication_release_publisher(b,x,clock_timestamp()+interval '10 minutes'); raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'publisher_product_access_required' then raise; end if; failures:=failures+1; end;
 -- bind
 perform set_config('request.jwt.claim.sub',own::text,true);
 perform public.hq_bind_publication_release_publisher(b,d,clock_timestamp()+interval '10 minutes');
 -- wrong author
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin perform public.publish_textbook(b); raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'scoped_publisher_required' then raise; end if; failures:=failures+1; end;
 -- wrong scope
 perform set_config('request.jwt.claim.sub',d::text,true);
 begin perform public.publish_publication(b2); raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'Not authorized to publish publication %' then raise; end if; failures:=failures+1; end;
 -- expire
 perform set_config('request.jwt.claim.sub',d::text,true);
 update public.publication_release_approvals set delegation_expires_at=clock_timestamp()-interval '1 second' where publication_id=b;
 -- expired
 perform set_config('request.jwt.claim.sub',d::text,true);
 begin perform public.publish_textbook(b); raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'scoped_publisher_expired_or_revoked' then raise; end if; failures:=failures+1; end;
 -- bind
 perform set_config('request.jwt.claim.sub',own::text,true);
 perform public.hq_bind_publication_release_publisher(b,d,clock_timestamp()+interval '10 minutes');
 -- revoke
 perform set_config('request.jwt.claim.sub',own::text,true);
 perform public.hq_revoke_publication_release_publisher(b);
 -- revoked
 perform set_config('request.jwt.claim.sub',d::text,true);
 begin perform public.publish_textbook(b); raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'scoped_publisher_expired_or_revoked' then raise; end if; failures:=failures+1; end;
 -- bind
 perform set_config('request.jwt.claim.sub',own::text,true);
 perform public.hq_bind_publication_release_publisher(b,d,clock_timestamp()+interval '10 minutes');
 -- change
 perform set_config('request.jwt.claim.sub',own::text,true);
 update public.vibe_chapters set title='Changed after review' where id=ch;
 -- stale
 perform set_config('request.jwt.claim.sub',d::text,true);
 begin perform public.publish_textbook(b); raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'scoped_publisher_approval_stale' then raise; end if; failures:=failures+1; end;
 -- restore
 perform set_config('request.jwt.claim.sub',d::text,true);
 update public.vibe_chapters set title='Synthetic chapter' where id=ch;
 -- publish
 perform set_config('request.jwt.claim.sub',d::text,true);
 perform public.publish_textbook(b);
if not exists(select 1 from public.vibe_publications p where p.id=b and p.status='published') or not exists(select 1 from public.vibe_chapters c where c.id=ch and c.status='published') then raise exception 'synthetic_publication_not_released'; end if;
select created_by into rev from public.publication_revisions where publication_id=b order by revision_number desc limit 1;
if rev is distinct from d then raise exception 'incorrect_revision_actor'; end if;
 if not exists(select 1 from public.vibelearn_content v where v.vibe_publication_id=b and v.status='live' and v.type='textbook') then raise exception 'synthetic_textbook_index_missing'; end if;
 -- live edit
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin update public.vibe_chapters set title='Unauthorized live edit' where id=ch; raise exception 'unexpected_success'; exception when others then get stacked diagnostics err=message_text; if err not like 'scoped_live_chapter_requires_revision' then raise; end if; failures:=failures+1; end;
 if failures<>8 then raise exception 'negative_test_count_mismatch'; end if;
 perform set_config('request.jwt.claim.sub','',true);
end $fixture$;
