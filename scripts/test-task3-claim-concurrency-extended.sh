#!/usr/bin/env bash
set -euo pipefail

DB_URL="${TASK3_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PSQL=(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1)
SCHOOL_ID='31000000-0000-0000-0000-000000000001'
CLASS_A='32000000-0000-0000-0000-000000000001'
PARENT_ID='30000000-0000-0000-0000-000000000003'
RACE_LEARNER='36000000-0000-0000-0000-000000000001'
DUAL_LEARNER='36000000-0000-0000-0000-000000000002'
DUAL_STUDENT='35000000-0000-0000-0000-000000000001'

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

run_as() {
  local uid="$1" sql="$2" out="$3"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -c "begin; set local role authenticated; set local \"request.jwt.claim.sub\"='$uid'; $sql; commit;" \
    >"$out" 2>"$out.err"
}

# Twenty genuinely independent, roleless accounts race for one canonical learner.
for i in $(seq -w 1 20); do
  uid="34000000-0000-0000-0000-0000000000${i}"
  "${PSQL[@]}" <<SQL
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values('$uid','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task3-claim-$i@example.invalid','',now(),now());
insert into public.profiles(id,full_name,role)
values('$uid','Task3 Claim Competitor $i',null)
on conflict(id) do update set full_name=excluded.full_name,role=null;
SQL
done

"${PSQL[@]}" <<SQL
insert into public.students(id,name,admission_number,class_id)
values('$RACE_LEARNER','Twenty Way Claim Learner','T3-CLAIM-20','$CLASS_A');
insert into public.student_claim_codes(student_id,code,claimed,role)
values('$RACE_LEARNER','T3CLAIM20WAY',false,'both');
SQL

pids=()
for i in $(seq -w 1 20); do
  uid="34000000-0000-0000-0000-0000000000${i}"
  (run_as "$uid" "select public.redeem_student_claim('T3CLAIM20WAY','$uid');" "$work/claim20.$i" || true) &
  pids+=("$!")
done
for p in "${pids[@]}"; do wait "$p"; done

claim_successes=$(cat "$work"/claim20.* | grep -c '"status" *: *"success"' || true)
claim_losers=$(cat "$work"/claim20.* | grep -c '"status" *: *"already_claimed"' || true)
bound_profile=$("${PSQL[@]}" -Atc "select profile_id::text from public.students where id='$RACE_LEARNER';")
claim_actor=$("${PSQL[@]}" -Atc "select student_claimed_by::text from public.student_claim_codes where student_id='$RACE_LEARNER';")
claim_timestamp_count=$("${PSQL[@]}" -Atc "select count(*) from public.student_claim_codes where student_id='$RACE_LEARNER' and student_claimed_at is not null and student_claimed_by is not null;")
membership_count=$("${PSQL[@]}" -Atc "select count(*) from public.school_members where profile_id='$bound_profile' and school_id='$SCHOOL_ID' and role='student';")
competitor_bindings=$("${PSQL[@]}" -Atc "select count(*) from public.students where profile_id::text like '34000000-0000-0000-0000-0000000000%';")

if [[ "$claim_successes" != "1" || "$claim_losers" != "19" || -z "$bound_profile" || "$bound_profile" != "$claim_actor" || "$claim_timestamp_count" != "1" || "$membership_count" != "1" || "$competitor_bindings" != "1" ]]; then
  echo "20-way student claim race failed: successes=$claim_successes losers=$claim_losers bound=$bound_profile actor=$claim_actor timestamp_rows=$claim_timestamp_count memberships=$membership_count bindings=$competitor_bindings" >&2
  cat "$work"/claim20.*.err >&2 || true
  exit 1
fi

# A Parent relationship claim and a Student identity claim use independent lanes.
"${PSQL[@]}" <<SQL
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values('$DUAL_STUDENT','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task3-dual-student@example.invalid','',now(),now());
insert into public.profiles(id,full_name,role)
values('$DUAL_STUDENT','Task3 Dual Claim Student',null)
on conflict(id) do update set full_name=excluded.full_name,role=null;
insert into public.students(id,name,admission_number,class_id)
values('$DUAL_LEARNER','Dual Lane Claim Learner','T3-DUAL-001','$CLASS_A');
insert into public.student_claim_codes(student_id,code,claimed,role)
values('$DUAL_LEARNER','T3DUALLANE',false,'both');
SQL

(run_as "$DUAL_STUDENT" "select public.redeem_student_claim('T3DUALLANE','$DUAL_STUDENT');" "$work/dual.student" || true) & ps=$!
(run_as "$PARENT_ID" "select public.redeem_parent_claim('T3DUALLANE','$PARENT_ID');" "$work/dual.parent" || true) & pp=$!
wait "$ps"; wait "$pp"

dual_student_success=$(grep -c '"status" *: *"success"' "$work/dual.student" || true)
dual_parent_success=$(grep -c '^success$' "$work/dual.parent" || true)
dual_state=$("${PSQL[@]}" -AtF '|' -c "select (student_claimed_at is not null)::int,(student_claimed_by='$DUAL_STUDENT')::int,(parent_claimed_at is not null)::int,(parent_claimed_by='$PARENT_ID')::int from public.student_claim_codes where student_id='$DUAL_LEARNER';")
parent_link=$("${PSQL[@]}" -Atc "select count(*) from public.parent_student_links where parent_id='$PARENT_ID' and student_id='$DUAL_LEARNER';")
student_binding=$("${PSQL[@]}" -Atc "select count(*) from public.students where id='$DUAL_LEARNER' and profile_id='$DUAL_STUDENT';")

if [[ "$dual_student_success" != "1" || "$dual_parent_success" != "1" || "$dual_state" != "1|1|1|1" || "$parent_link" != "1" || "$student_binding" != "1" ]]; then
  echo "student/parent dual-lane claim race failed: student_success=$dual_student_success parent_success=$dual_parent_success state=$dual_state parent_link=$parent_link student_binding=$student_binding" >&2
  cat "$work/dual.student.err" "$work/dual.parent.err" >&2 || true
  exit 1
fi

echo 'Task 3 extended claim concurrency suite: PASS'
