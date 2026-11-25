-- Additive candidate. Existing mini_lessons RLS remains the visibility authority.
-- authorization-test: public.mini_lessons - owner pending inserts only, no client deck updates.
alter table public.mini_lessons add column slide_deck jsonb;
alter table public.mini_lessons add constraint mini_slide_deck_shape check (
 case when slide_deck is null then true
 when jsonb_typeof(slide_deck) <> 'array' then false
 else cover_path is null and jsonb_array_length(slide_deck) between 2 and 10 and octet_length(slide_deck::text)<=50000 end
);
grant insert(slide_deck) on public.mini_lessons to authenticated;
create function public.mini_slide_deck_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if new.slide_deck is distinct from old.slide_deck then raise exception 'Mini slide snapshots are immutable' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function public.mini_slide_deck_immutable() from public,anon,authenticated;
create trigger mini_slide_deck_immutable before update of slide_deck on public.mini_lessons for each row execute function public.mini_slide_deck_immutable();
comment on column public.mini_lessons.slide_deck is 'Immutable bounded deck; null for legacy photo posts. Trusted safety route validates and screens supported content before approval.';
