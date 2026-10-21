-- Private audio is never playable until a trusted server-side probe
-- independently confirms its bytes, codec, duration and object identity.
begin;
-- access: service-only public.success_wishes_voice_validations
-- authorization-test: public.success_wishes_voice_validations
create table if not exists public.success_wishes_voice_validations (
  message_id uuid primary key references public.success_wishes_messages(id) on delete cascade,
  object_path text not null,
  mime_type text not null check (mime_type in ('audio/webm','audio/mp4','audio/mpeg','audio/ogg')),
  byte_size integer not null check (byte_size between 1 and 26214400),
  duration_seconds numeric(7,3) not null check (duration_seconds > 0 and duration_seconds <= 60),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  validator_version text not null check (validator_version ~ '^trusted-audio-probe-v[0-9]{1,3}$'),
  verified_at timestamptz not null default now(),
  check (split_part(object_path,'/',1) = message_id::text),
  check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](webm|m4a|mp3|ogg)$')
);
alter table public.success_wishes_voice_validations enable row level security;
revoke all on public.success_wishes_voice_validations from public,anon,authenticated;
grant select,insert,update,delete on public.success_wishes_voice_validations to service_role;

-- A voice message cannot become ready without a matching private asset and
-- independently observed duration. A media replacement rechecks the guard.
create or replace function public.success_wishes_guard_voice_ready()
returns trigger language plpgsql security invoker set search_path = '' as $wish$
begin
  if new.format='voice' and new.media_status='ready'
    and not exists (
      select 1 from public.success_wishes_voice_validations v
      where v.message_id=new.id
        and v.object_path=new.media_asset_id
        and v.verified_at <= now()
        and v.duration_seconds > 0 and v.duration_seconds <= 60
    )
  then raise exception 'voice_asset_requires_trusted_validation' using errcode='23514';
  end if;
  return new;
end $wish$;
revoke all on function public.success_wishes_guard_voice_ready() from public,anon,authenticated;
drop trigger if exists success_wishes_voice_ready_guard on public.success_wishes_messages;
create trigger success_wishes_voice_ready_guard
before insert or update of format,media_asset_id,media_status
on public.success_wishes_messages
for each row execute function public.success_wishes_guard_voice_ready();
commit;
