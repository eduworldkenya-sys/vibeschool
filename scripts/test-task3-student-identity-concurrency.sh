#!/usr/bin/env bash
set -euo pipefail

DB_URL="${TASK3_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PSQL=(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1)

TEACHER_ID='30000000-0000-0000-0000-000000000001'
ADMIN_ID='30000000-0000-0000-0000-000000000002'
PARENT_ID='30000000-0000-0000-0000-000000000003'
STUDENT_A='30000000-0000-0000-0000-000000000004'
STUDENT_B='30000000-0000-0000-0000-000000000005'
SCHOOL_ID='31000000-0000-0000-0000-000000000001'
CLASS_A='32000000-0000-0000-0000-000000000001'
CLASS_B='32000000-0000-0000-0000-000000000002'
CLAIM_STUDENT='33000000-0000-0000-0000-000000000001'

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Create disposable identities through the supported local auth schema. Do not
# disable auth-owned triggers: the CI database connection is intentionally not
# the owner of auth.users, and the reconstructed application must tolerate the
# normal signup trigger path.
"${PSQL[@]}" <<SQL
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
 ('$TEACHER_ID','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task3-teacher@example.invalid','',now(),now()),
 ('$ADMIN_ID','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task3-admin@example.invalid','',now(),now()),
 ('$PARENT_ID','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task3-parent@example.invalid','',now(),now()),
 ('$STUDENT_A','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task3-student-a@example.invalid','',now(),now()),
 ('$STUDENT_B','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task3-student-b@example.invalid','',now(),now());

insert into public.profiles(id,full_name,role) values
 ('$TEACHER_ID','Task3 Race Teacher','teacher'),
 ('$ADMIN_ID','Task3 Race Admin','admin'),
 ('$PARENT_ID','Task3 Race Parent','parent'),
 ('$STUDENT_A','Task3 Claim Student A','student'),
 ('$STUDENT_B','Task3 Claim Student B','student')
on conflict (id) do update set full_name=excluded.full_name, role=excluded.role;

insert into public.schools(id,name,subdomain,timezone,status,country_code,requires_dual_approval)
values('$SCHOOL_ID','Task3 Disposable School','task3-race-school','Africa/Nairobi','active','KE',false);

insert into public.school_members(school_id,profile_id,role) values
 ('$SCHOOL_ID','$TEACHER_ID','teacher'),
 ('$SCHOOL_ID','$ADMIN_ID','admin');

insert into public.classes(id,name,subject,school_id) values
 ('$CLASS_A','Grade 6 A','', '$SCHOOL_ID'),
 ('$CLASS_B','Grade 6 B','', '$SCHOOL_ID');
SQL

run_as() {
  local uid="$1" sql="$2" out="$3"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -c "begin; set local role authenticated; set local \"request.jwt.claim.sub\"='$uid'; $sql; commit;" \
    >"$out" 2>"$out.err"
}

pids=()
for i in $(seq 1 20); do
  run_as "$TEACHER_ID" "select public.teacher_add_student('Teacher Race Learner','T3-RACE-T-001',null,'$SCHOOL_ID');" "$work/teacher.$i" & pids+=("$!")
done
for p in "${pids[@]}"; do wait "$p"; done
teacher_count=$("${PSQL[@]}" -Atc "select count(*) from public.students where lower(trim(admission_number))='t3-race-t-001' and deleted_at is null;")
teacher_receipts=$("${PSQL[@]}" -Atc "select count(*) from public.student_provisioning_receipts where actor_id='$TEACHER_ID' and operation='teacher_add_student';")
teacher_ids=$(cat "$work"/teacher.[0-9]* | grep -Eo '[0-9a-f]{8}-[0-9a-f-]{27,36}' | sort -u | wc -l | tr -d ' ')
[[ "$teacher_count" == "1" && "$teacher_receipts" == "1" && "$teacher_ids" == "1" ]] || { echo "teacher provisioning race failed: students=$teacher_count receipts=$teacher_receipts ids=$teacher_ids" >&2; exit 1; }

pids=()
for i in $(seq 1 20); do
  run_as "$ADMIN_ID" "select public.admin_add_student('Admin Race Learner','T3-RACE-A-001','','',null,'$SCHOOL_ID');" "$work/admin.$i" & pids+=("$!")
done
for p in "${pids[@]}"; do wait "$p"; done
admin_count=$("${PSQL[@]}" -Atc "select count(*) from public.students where lower(trim(admission_number))='t3-race-a-001' and deleted_at is null;")
admin_receipts=$("${PSQL[@]}" -Atc "select count(*) from public.student_provisioning_receipts where actor_id='$ADMIN_ID' and operation='admin_add_student';")
admin_ids=$(cat "$work"/admin.[0-9]* | grep -Eo '[0-9a-f]{8}-[0-9a-f-]{27,36}' | sort -u | wc -l | tr -d ' ')
[[ "$admin_count" == "1" && "$admin_receipts" == "1" && "$admin_ids" == "1" ]] || { echo "admin provisioning race failed: students=$admin_count receipts=$admin_receipts ids=$admin_ids" >&2; exit 1; }

pids=()
for i in $(seq 1 20); do
  (run_as "$PARENT_ID" "select public.create_child_for_parent('Parent Race Child','2014-01-01',null);" "$work/parent.$i" && echo ok >"$work/parent.$i.ok" || true) & pids+=("$!")
done
for p in "${pids[@]}"; do wait "$p"; done
parent_success=$(find "$work" -name 'parent.*.ok' | wc -l | tr -d ' ')
parent_children=$("${PSQL[@]}" -Atc "select count(*) from public.students where name='Parent Race Child' and deleted_at is null;")
[[ "$parent_success" == "0" && "$parent_children" == "0" ]] || { echo "parent direct-create denial race failed: successes=$parent_success learners=$parent_children" >&2; exit 1; }

"${PSQL[@]}" <<SQL
insert into public.students(id,name,admission_number,class_id,self_use_enabled)
values('$CLAIM_STUDENT','Claim Race Learner','T3-CLAIM-001','$CLASS_A',true);
insert into public.student_claim_codes(student_id,code,claimed,role)
values('$CLAIM_STUDENT','T3CLAIMRACE',false,'student');
SQL

pids=()
for i in $(seq 1 20); do
  cls="$CLASS_A"; [[ $((i % 2)) -eq 0 ]] && cls="$CLASS_B"
  (psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "insert into public.student_classes(student_id,class_id,school_id,is_current) values('$CLAIM_STUDENT','$cls','$SCHOOL_ID',true);" >"$work/enroll.$i" 2>"$work/enroll.$i.err" || true) & pids+=("$!")
done
for p in "${pids[@]}"; do wait "$p"; done
current_rows=$("${PSQL[@]}" -Atc "select count(*) from public.student_classes where student_id='$CLAIM_STUDENT' and is_current=true;")
[[ "$current_rows" == "1" ]] || { echo "current enrollment race failed: current_rows=$current_rows" >&2; exit 1; }

pids=()
for i in $(seq 1 20); do
  (psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "insert into public.class_join_requests(student_id,class_id,parent_id,status) values('$CLAIM_STUDENT','$CLASS_A','$PARENT_ID','pending');" >"$work/join.$i" 2>"$work/join.$i.err" || true) & pids+=("$!")
done
for p in "${pids[@]}"; do wait "$p"; done
pending_rows=$("${PSQL[@]}" -Atc "select count(*) from public.class_join_requests where student_id='$CLAIM_STUDENT' and class_id='$CLASS_A' and parent_id='$PARENT_ID' and status='pending';")
[[ "$pending_rows" == "1" ]] || { echo "pending join race failed: rows=$pending_rows" >&2; exit 1; }

(run_as "$STUDENT_A" "select public.redeem_student_claim('T3CLAIMRACE','$STUDENT_A');" "$work/claim.a" || true) & p1=$!
(run_as "$STUDENT_B" "select public.redeem_student_claim('T3CLAIMRACE','$STUDENT_B');" "$work/claim.b" || true) & p2=$!
wait "$p1"; wait "$p2"
claimants=$("${PSQL[@]}" -Atc "select count(distinct student_claimed_by) from public.student_claim_codes where student_id='$CLAIM_STUDENT' and student_claimed_by is not null;")
bound=$("${PSQL[@]}" -Atc "select count(*) from public.students where id='$CLAIM_STUDENT' and profile_id in ('$STUDENT_A','$STUDENT_B');")
[[ "$claimants" == "1" && "$bound" == "1" ]] || { echo "student claim race failed: claimants=$claimants bound=$bound" >&2; exit 1; }

echo 'Task 3 real concurrency/failure-injection suite: PASS'
