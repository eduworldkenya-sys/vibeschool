// HQ optionality is a review-transport decision, not an authorization exemption.
// Run alongside canonical curriculum and outcome-package tests. No database writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(p)=>readFileSync(p,"utf8");
const playbook=read("docs/curriculum/CONTENT_GENERATION.md");
const operating=read("docs/curriculum/CONTENT_OPERATING_MODEL.md");
const quality=read("docs/curriculum/OUTCOME_PACKAGE_QUALITY_AND_RELEASE.md");
const authority=read("supabase/functions/curriculum-authority-intake/index.ts");
const packageManifest=read("docs/curriculum/OUTCOME_PACKAGE_ASSEMBLY_CONTRACT.md");
const cmd=JSON.parse(read("package.json")).scripts["check:content-without-hq"];

test("HQ is not mandatory for draft curriculum or educational checks",()=>{
  assert.match(playbook,/HQ is NOT a prerequisite for the non-mutating research, drafting or checking/);
  assert.match(playbook,/KICD design and its edition\/page locators/);
  assert.match(playbook,/current GitHub curriculum map and existing canonical Supabase outcomes/);
  assert.match(playbook,/EDITORIAL_CHECKED/);
  assert.match(playbook,/NOT_CHECKED/);
  assert.match(operating,/HQ remains available for future management/);
  assert.match(operating,/not an obligatory checkpoint/);
  assert.match(operating,/read-only/);
});

test("missing source evidence never turns into a certified curriculum",()=>{
  for(const marker of [
    "BLOCKED_CURRICULUM_RECONCILIATION",
    "CURRICULUM_MATCH",
    "actual KICD source and canonical VibeSchool records",
    "NOT_CHECKED",
    "BLOCKED_AUTHORITY",
    "protected mutations protected",
    "authorization is not optional"
  ])assert.ok(playbook.includes(marker),"Missing governance marker: "+marker);
  assert.match(operating,/not.*official-source authentication/);
});

test("existing authenticated owner and content certification gates are not weakened",()=>{
  assert.match(authority,/rpc\("is_platform_owner"\)/);
  assert.match(authority,/HQ platform owner required/);
  assert.match(authority,/source\.source_status !== "approved"/);
  assert.match(authority,/curriculum_authority_register_artifact/);
  assert.match(authority,/curriculum_authority_reconcile_snapshot/);
  assert.match(quality,/authenticated platform owner alone invokes/);
  assert.match(quality,/cla_certify_learning_resource_version/);
  assert.match(packageManifest,/vs_curriculum_package_gate/);
  assert.match(packageManifest,/candidate → verified → certified/);
  assert.match(playbook,/do not.*service-role powers to impersonate the owner/);
});

test("operator check only reuses canonical suites and a non-mutating contract test",()=>{
  assert.equal(cmd,
    "npm run test:curriculum-identity && npm run test:outcome-packages && node --test scripts/test-content-hq-optional-contract.mjs");
  assert.doesNotMatch(cmd,/supabase\s+db\s+(push|reset)|migrate|deploy|publish|service_role/);
});
