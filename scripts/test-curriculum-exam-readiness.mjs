import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const sql=readFileSync("supabase/migrations/20261110160000_hq_curriculum_exam_readiness.sql","utf8")
const page=readFileSync("app/hq/curriculum-authority/grade9-mathematics/page.tsx","utf8")
const parent=readFileSync("app/hq/curriculum-authority/page.tsx","utf8")

test("curriculum readiness is owner-only, readonly and not a hidden approval API",()=>{
 assert.match(sql,/auth\.uid\(\) is null or not coalesce\(public\.is_platform_owner\(\),false\)/)
 assert.match(sql,/language plpgsql stable security definer/)
 assert.match(sql,/revoke all on function public\.hq_curriculum_exam_readiness/)
 assert.doesNotMatch(sql,/\b(insert|update|delete|truncate|alter)\s+(into\s+|table\s+|from\s+)?public\./i)
 assert.match(sql,/ready_for_curriculum_verified_exam/)
 assert.match(sql,/report_only',true/)
})
test("report demands official evidence and does not treat draft outcomes as verified",()=>{
 for(const name of ["curriculum_authority_sources","curriculum_authority_snapshots","curriculum_authority_observations","curriculum_authority_hierarchy_bindings","curriculum_learning_outcomes","assessment_questions","content_assessment_blueprints","assessment_item_outcomes"])assert.ok(sql.includes(name),name)
 assert.match(sql,/clo\.source_type='official' and clo\.status='verified'/)
 assert.match(sql,/promoted_snapshot_missing/)
 assert.match(sql,/hierarchy_bindings_missing/)
 assert.match(sql,/approved_blueprint_missing/)
 assert.match(sql,/unverified_existing_pilot_questions/)
})
test("HQ makes missing curriculum evidence discoverable, never editable through report",()=>{
 assert.match(page,/hq_curriculum_exam_readiness/)
 assert.match(page,/Not ready for curriculum-verified examinations/)
 assert.match(page,/This dashboard cannot alter authority records/)
 assert.match(parent,/grade9-mathematics/)
})
