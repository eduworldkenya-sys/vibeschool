#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

FILE="app/teacher/academics/page.tsx"

echo "== TBL-010E verification =="

[ -f "$FILE" ] || {
  echo "FAIL: missing $FILE"
  exit 1
}

echo "== 1/8 TypeScript =="
npx tsc --noEmit

echo "== 2/8 subject bridge selected =="
grep -Fq '.select("id, name, global_subject_id")' "$FILE" \
  && echo "OK: subject query fetches global_subject_id" \
  || { echo "FAIL: missing global_subject_id select"; exit 1; }

echo "== 3/8 subject query errors handled =="
grep -Fq 'error:subError' "$FILE" \
  && grep -Fq 'Failed to load assigned subjects' "$FILE" \
  && echo "OK: subject query errors are not silently swallowed" \
  || { echo "FAIL: subject query error handling missing"; exit 1; }

echo "== 4/8 missing assigned subjects detected =="
grep -Fq 'missingSubjectIds' "$FILE" \
  && grep -Fq 'Assigned subjects could not be resolved' "$FILE" \
  && echo "OK: partial subject resolution is rejected" \
  || { echo "FAIL: missing assigned-subject detection"; exit 1; }

echo "== 5/8 strands query uses global ids =="
grep -Fq '.in("subject_id",globalSubjectIds)' "$FILE" \
  && echo "OK: cbc_strands query uses global subject ids" \
  || { echo "FAIL: cbc_strands query is not keyed on global ids"; exit 1; }

echo "== 6/8 aggregation maps school id to global id =="
grep -Fq 'globalSubjectIdBySchoolId.get(sub.id)' "$FILE" \
  && grep -Fq 'o.subject_id===globalSubjectId' "$FILE" \
  && echo "OK: strand definitions aggregate through the global parent" \
  || { echo "FAIL: aggregation still compares taxonomy to school id"; exit 1; }

echo "== 7/8 assessments remain school-id keyed =="
grep -Fq 'assData.filter(a=>a.subject_id===sub.id)' "$FILE" \
  && echo "OK: assessment matching remains on school subject ids" \
  || { echo "FAIL: assessment identity was changed"; exit 1; }

echo "== 8/8 old broken paths absent =="
if grep -Fq 'cbc_strands").select("id,subject_id,name").in("subject_id",subjectIds)' "$FILE"; then
  echo "FAIL: old school-id cbc_strands query remains"
  exit 1
fi

if grep -Fq 'const strandDefs=outcomeData.filter(o=>o.subject_id===sub.id);' "$FILE"; then
  echo "FAIL: old school-id strand aggregation remains"
  exit 1
fi

grep -Fq '"Academics: assigned subjects missing global identity"' "$FILE" \
  || { echo "FAIL: unlinked subject diagnostic missing"; exit 1; }

echo "All TBL-010E checks passed."
