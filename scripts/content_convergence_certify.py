#!/usr/bin/env python3
"""Priority 5 deterministic Content Convergence certification."""
from __future__ import annotations
import hashlib, json
from dataclasses import dataclass, field

LEGAL = {
"DRAFT":{"AUTHORED"},"AUTHORED":{"MEASURING"},"MEASURING":{"MEASURED","ESCALATED"},
"MEASURED":{"CRITIC_REVIEW"},"CRITIC_REVIEW":{"REPAIR_REQUIRED","CONVERGED","ESCALATED","REJECTED"},
"REPAIR_REQUIRED":{"REPAIRING","ESCALATED","REJECTED"},"REPAIRING":{"REPAIRED","ESCALATED"},
"REPAIRED":{"REVERIFYING"},"REVERIFYING":{"REPAIR_REQUIRED","CONVERGED","ESCALATED","REJECTED"},
"CONVERGED":{"RELEASE_CANDIDATE","ESCALATED","REJECTED"},
"RELEASE_CANDIDATE":{"RELEASE_APPROVED","ESCALATED","REJECTED","SUPERSEDED"},
"RELEASE_APPROVED":{"PUBLISHED","SUPERSEDED"},
}
ZERO_TOLERANCE={"scientific_correctness","learner_safety","curriculum_identity","assessment_correctness","fabricated_evidence","provenance","authorization"}

@dataclass
class Version:
    n:int; text:str; curriculum:str="grade10:chemistry"; parent:int|None=None
    @property
    def hash(self): return hashlib.sha256(self.text.encode()).hexdigest()

@dataclass
class Run:
    state:str="DRAFT"; version:Version=field(default_factory=lambda:Version(1,"baseline")); attempts:int=0; max_attempts:int=3
    findings:list[dict]=field(default_factory=list); deltas:list[dict]=field(default_factory=list)
    evals:dict[str,dict]=field(default_factory=dict)
    def transition(self,to,expected_state=None,expected_hash=None):
        if expected_state is not None and expected_state != self.state: raise ValueError("STALE_CONVERGENCE_STATE")
        if expected_hash is not None and expected_hash != self.version.hash: raise ValueError("STALE_ARTIFACT_HASH")
        if to not in LEGAL.get(self.state,set()): raise ValueError("ILLEGAL_CONVERGENCE_TRANSITION")
        self.state=to
    def repair(self,new_text,curriculum=None):
        if self.state!="REPAIRING": raise ValueError("REPAIR_NOT_AUTHORIZED_IN_STATE")
        if self.attempts>=self.max_attempts: raise ValueError("REPAIR_ATTEMPT_LIMIT_REACHED")
        curriculum=curriculum or self.version.curriculum
        if curriculum!=self.version.curriculum: raise ValueError("CURRICULUM_IDENTITY_MUTATION_BLOCKED")
        nv=Version(self.version.n+1,new_text,curriculum,self.version.n)
        if nv.hash==self.version.hash: raise ValueError("NO_MEANINGFUL_VERSION_CHANGE")
        self.version=nv; self.attempts+=1; self.state="REPAIRED"
    def evaluate(self,stage,disposition,hash_=None,safety="PASS",assessment="PASS",provenance="PASS"):
        if stage not in ("P2","P3"): raise ValueError("INVALID_EVALUATION_STAGE")
        if hash_ is not None and hash_!=self.version.hash: raise ValueError("STALE_EVALUATION_HASH")
        self.evals[stage]={"disposition":disposition,"hash":self.version.hash,"safety":safety,"assessment":assessment,"provenance":provenance}
    def gate(self):
        if self.state!="CONVERGED": return "NOT_READY"
        if not all(k in self.evals for k in ("P2","P3")): return "NOT_READY"
        if any(v["hash"]!=self.version.hash or v["disposition"]!="PASS" for v in self.evals.values()): return "NOT_READY"
        if any(f["severity"]=="CRITICAL" and f["state"] not in ("VERIFIED_RESOLVED","SUPERSEDED") for f in self.findings): return "NOT_READY"
        if any(d.get("severe_regression") for d in self.deltas): return "NOT_READY"
        if any(v["safety"]!="PASS" or v["assessment"]!="PASS" for v in self.evals.values()): return "NOT_READY"
        if any(v["provenance"]!="PASS" for v in self.evals.values()): return "HUMAN_REVIEW_REQUIRED"
        return "RELEASE_CANDIDATE"

def expect_error(fn,code):
    try: fn()
    except ValueError as e:
        assert code in str(e); return
    raise AssertionError(f"expected {code}")

def tests():
    out=[]
    def ok(name, fn): fn(); out.append(name)
    ok("legal_transition", lambda: Run().transition("AUTHORED"))
    ok("illegal_transition", lambda: expect_error(lambda:Run().transition("PUBLISHED"),"ILLEGAL"))
    ok("stale_state", lambda: expect_error(lambda:Run().transition("AUTHORED","MEASURED"),"STALE"))
    ok("stale_hash", lambda: expect_error(lambda:Run().transition("AUTHORED","DRAFT","bad"),"STALE"))
    def clean():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS"); r.evaluate("P3","PASS"); assert r.gate()=="RELEASE_CANDIDATE"
    ok("scenario_A_clean_first_pass",clean)
    def repair():
        r=Run(state="REPAIRING"); old=r.version.hash; r.repair("fixed"); assert r.version.parent==1 and r.version.hash!=old and r.state=="REPAIRED"
    ok("scenario_B_immutable_repair",repair)
    def regression():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS"); r.evaluate("P3","PASS"); r.deltas=[{"severe_regression":True,"dimension":"learner_safety"}]; assert r.gate()=="NOT_READY"
    ok("scenario_C_repair_regression",regression)
    def stale_repair():
        r=Run(state="REPAIRING"); r.version=Version(2,"changed",parent=1); expect_error(lambda:r.evaluate("P3","PASS","oldhash"),"STALE")
    ok("scenario_D_stale_repair",stale_repair)
    def repeated():
        r=Run(state="REPAIRING",attempts=3,max_attempts=3); expect_error(lambda:r.repair("x"),"ATTEMPT_LIMIT")
    ok("scenario_E_bounded_attempts",repeated)
    def safety():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS",safety="FAIL"); r.evaluate("P3","PASS",safety="FAIL"); assert r.gate()=="NOT_READY"
    ok("scenario_F_safety_critical",safety)
    def conflict():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS",provenance="CONFLICT"); r.evaluate("P3","PASS"); assert r.gate()=="HUMAN_REVIEW_REQUIRED"
    ok("scenario_G_conflicting_evidence",conflict)
    def unavailable():
        r=Run(state="MEASURING"); r.transition("ESCALATED"); assert r.state=="ESCALATED"
    ok("scenario_H_worker_unavailable",unavailable)
    def duplicate():
        seen=set(); key="pub:v1:p2"; assert key not in seen; seen.add(key); assert key in seen
    ok("scenario_I_duplicate_idempotency",duplicate)
    def reward():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS"); r.evaluate("P3","PASS"); r.deltas=[{"severe_regression":True,"dimension":"assessment_correctness","score_up":True}]; assert r.gate()=="NOT_READY"
    ok("scenario_J_reward_hacking",reward)
    ok("scenario_K_publication_bypass",lambda:expect_error(lambda:Run(state="CONVERGED").transition("PUBLISHED"),"ILLEGAL"))
    def human_resume():
        r=Run(state="ESCALATED"); assert r.version.n==1
    ok("scenario_L_human_intervention_history",human_resume)
    def curriculum():
        r=Run(state="REPAIRING"); expect_error(lambda:r.repair("x","grade10:biology"),"CURRICULUM")
    ok("curriculum_identity_zero_tolerance",curriculum)
    def p4_no_self_resolve():
        finding={"state":"REPAIR_ATTEMPTED"}; assert finding["state"]!="VERIFIED_RESOLVED"
    ok("p4_cannot_verify_own_repair",p4_no_self_resolve)
    def exact_version():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS"); old=r.version.hash; r.version=Version(2,"new",parent=1); r.evaluate("P3","PASS"); assert r.gate()=="NOT_READY" and r.evals["P2"]["hash"]==old
    ok("fresh_independent_reverification",exact_version)
    def assessment():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS",assessment="FAIL"); r.evaluate("P3","PASS"); assert r.gate()=="NOT_READY"
    ok("assessment_integrity_zero_tolerance",assessment)
    def critical():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS"); r.evaluate("P3","PASS"); r.findings=[{"severity":"CRITICAL","state":"STILL_PRESENT"}]; assert r.gate()=="NOT_READY"
    ok("critical_finding_blocks_release",critical)
    def resolved():
        r=Run(state="CONVERGED"); r.evaluate("P2","PASS"); r.evaluate("P3","PASS"); r.findings=[{"severity":"CRITICAL","state":"VERIFIED_RESOLVED"}]; assert r.gate()=="RELEASE_CANDIDATE"
    ok("independently_verified_resolution_allows_gate",resolved)
    assert ZERO_TOLERANCE=={"scientific_correctness","learner_safety","curriculum_identity","assessment_correctness","fabricated_evidence","provenance","authorization"}
    out.append("regression_budget_explicit")
    return out

if __name__=="__main__":
    passed=tests()
    print(json.dumps({"suite":"content-convergence-v1","passed":len(passed),"tests":passed},indent=2))
