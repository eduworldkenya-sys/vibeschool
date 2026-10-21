#!/usr/bin/env bash
# Disposable PostgreSQL fixture ONLY. Never run against production.
# Runs after sponsorship-assertions.sql and tests two simultaneous submissions
# competing for the final sponsored-text slot.
set -euo pipefail

: "${PGDATABASE:?Set PGDATABASE to a disposable Success Wishes test database}"
if [[ "${PGDATABASE}" != "success_wishes_test" ]]; then
  echo "Refusing to mutate a database outside the disposable CI fixture" >&2
  exit 2
fi

workdir="$(mktemp -d)"
first_pid=""
cleanup() {
  if [[ -n "${first_pid}" ]]; then
    kill "${first_pid}" 2>/dev/null || true
  fi
  rm -rf "${workdir}"
}
trap cleanup EXIT

# The preceding sponsorship assertions finish at a cap of two used slots,
# with the pilot disabled. Turn it back on as the synthetic founder, then
# free exactly one slot using synthetic fixture content.
psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.success_wishes_set_sponsored_pilot(
  '11111111-1111-4111-8111-111111111111',true,7,2
);
reset role;
set role service_role;
delete from public.success_wishes_messages
where management_token_hash=repeat('5',64);
reset role;
do $sw$
begin
  if (select count(*) from public.success_wishes_messages m
    join public.success_wishes_inboxes i on i.id=m.inbox_id
    where i.school_id='11111111-1111-4111-8111-111111111111'
      and m.payment_status='sponsored') <> 1
    then raise exception 'Concurrency fixture must have exactly one occupied slot'; end if;
end $sw$;
SQL

# A transaction holds the advisory lock and leaves its new row uncommitted.
# The second transaction begins only after PostgreSQL has acknowledged the
# first INSERT; its own trigger must wait and then observe the committed row.
psql -X -v ON_ERROR_STOP=1 >"${workdir}/first.log" 2>&1 <<'SQL' &
begin;
set role service_role;
insert into public.success_wishes_messages(
  inbox_id,sender_name,relationship,format,body,management_token_hash,
  idempotency_key,payment_status,expires_at
) select id,'First concurrent','Guardian','text','Good luck',
  repeat('a',64),repeat('b',64),'sponsored',now()+interval '2 days'
from public.success_wishes_inboxes
where school_id='11111111-1111-4111-8111-111111111111';
\echo FIRST_INSERT_ACKNOWLEDGED
select pg_sleep(3);
commit;
SQL
first_pid=$!

acknowledged=false
for _ in $(seq 1 70); do
  if grep -q 'FIRST_INSERT_ACKNOWLEDGED' "${workdir}/first.log"; then
    acknowledged=true
    break
  fi
  if ! kill -0 "${first_pid}" 2>/dev/null; then break; fi
  sleep 0.1
done
if [[ "${acknowledged}" != true ]]; then
  cat "${workdir}/first.log" >&2
  echo "First fixture insertion failed to acquire the final slot" >&2
  exit 1
fi

# Expected failure MUST be the school quota constraint, not another error.
if psql -X -v ON_ERROR_STOP=1 >"${workdir}/second.log" 2>&1 <<'SQL'
set role service_role;
insert into public.success_wishes_messages(
  inbox_id,sender_name,relationship,format,body,management_token_hash,
  idempotency_key,payment_status,expires_at
) select id,'Second concurrent','Guardian','text','Best wishes',
  repeat('c',64),repeat('d',64),'sponsored',now()+interval '2 days'
from public.success_wishes_inboxes
where school_id='11111111-1111-4111-8111-111111111111';
SQL
then
  echo "CRITICAL: second concurrent message bypassed the daily cap" >&2
  exit 1
fi
if ! grep -q 'sponsored_daily_limit_reached' "${workdir}/second.log"; then
  cat "${workdir}/second.log" >&2
  echo "Unexpected failure: required sponsored quota rejection did not occur" >&2
  exit 1
fi
wait "${first_pid}"
first_pid=""

psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
set role service_role;
do $sw$
begin
  if (select count(*) from public.success_wishes_messages m
    join public.success_wishes_inboxes i on i.id=m.inbox_id
    where i.school_id='11111111-1111-4111-8111-111111111111'
      and m.payment_status='sponsored') <> 2
    then raise exception 'Concurrent sponsored sends exceeded school quota'; end if;
end $sw$;
reset role;
SQL
echo "PASS: concurrent sponsored submissions respect atomic per-school cap"
