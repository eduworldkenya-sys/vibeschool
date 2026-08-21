#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, pathlib, re, sys
from typing import Any

ROOT=pathlib.Path(__file__).resolve().parents[1]
PROFILE_PATH=ROOT/'critic/independent-critic-v1.json'
RUBRIC_PATH=ROOT/'quality-intelligence/rubrics/teacher-guide-v1.json'
P2_GOLD_PATH=ROOT/'quality-intelligence/fixtures/teacher-guide-gold-v1.json'
PROFILE=json.loads(PROFILE_PATH.read_text())

CATEGORIES=set(PROFILE['finding_categories'])
DIMENSIONS=set(PROFILE['canonical_dimensions'])
BLOCKERS=set(PROFILE['canonical_hard_blockers'])
SEVERITIES=set(PROFILE['severity'])


def canonical_sha(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def finding(case: dict[str,Any], category: str, dimension: str, severity: str, claim: str, evidence: str,
            remediation: str, blocking: bool=True, blocker: str|None=None, confidence: float=.95,
            uncertainty: str|None=None) -> dict[str,Any]:
    assert category in CATEGORIES and dimension in DIMENSIONS and severity in SEVERITIES
    assert blocker is None or blocker in BLOCKERS
    return {
      'finding_id':f"{case['id']}:{category}:{len(claim)}", 'critic_execution_id':'exam',
      'artifact_id':case['id'],'artifact_version':'v1','quality_contract_version':'teacher-guide-independent-quality:v1',
      'critic_profile_version':'independent-senior-educational-editor:v1','subject_profile_version':'chemistry:v1',
      'category':category,'canonical_dimension':dimension,'hard_blocker_code':blocker,'severity':severity,
      'affected_section':'artifact','affected_curriculum_outcome':case.get('outcome'),'claim':claim,'evidence':evidence,
      'reasoning_summary':claim,'required_remediation':remediation,'release_blocking':blocking,
      'confidence':confidence,'uncertainty':uncertainty,'created_at':'EXAM'
    }


def review(case: dict[str,Any]) -> dict[str,Any]:
    t=case['content'].lower(); fs=[]
    if case.get('curriculum_linked') and not case.get('teachable_chain'):
        fs.append(finding(case,'curriculum','outcome_teachability','MAJOR',
          'Curriculum linkage exists without a teachable instructional chain',
          'Mapped outcome lacks explanation, learner experience, teacher check, assessment or expected evidence',
          'Add the missing outcome-specific instructional chain',True,'required_outcome_not_teachable'))
    wrong=[r'protons and electrons.*mass number',r'mass number.*protons.*electrons',r'acid.*turns blue litmus blue']
    if case.get('scientific_falsehood') or any(re.search(p,t) for p in wrong):
        fs.append(finding(case,'scientific_correctness','subject_accuracy','CRITICAL',
          'Material Chemistry claim is scientifically wrong','Artifact contains a materially false scientific relationship',
          'Correct the scientific claim from authoritative evidence and re-review',True,'material_subject_error'))
    if case.get('polished_shallow'):
        fs.append(finding(case,'teaching_depth','pedagogy_and_sequence','MAJOR',
          'Factually fluent material does not build teachable understanding',
          'Content summarizes information without an executable explanation, learner reasoning and check sequence',
          'Develop explanations, examples, learner reasoning and checks'))
    if case.get('activity_without_learning'):
        fs.append(finding(case,'activity','outcome_teachability','MAJOR',
          'Activity volume does not establish meaningful learning','Activities do not exercise the target reasoning or yield evidence of understanding',
          'Tie learner action to the outcome, expected result, conclusion and teacher check'))
    if case.get('missing_expected_observation'):
        fs.append(finding(case,'practical','classroom_readiness','MAJOR',
          'Practical lacks an expected observation and interpretation','Procedure exists but teacher and learner are not told what evidence should occur or mean',
          'State expected observation, interpretation and learning evidence'))
    if case.get('weak_lab_orientation'):
        fs.append(finding(case,'practical','classroom_readiness','MAJOR',
          'Laboratory activity is not operationally prepared for classroom use','Apparatus orientation, preparation or supervision guidance is missing',
          'Add preparation, apparatus orientation and supervision guidance'))
    if case.get('unsafe_practical'):
        fs.append(finding(case,'safety','safety_and_practical_integrity','CRITICAL',
          'Practical has an unresolved material safety omission','A required hazard control, supervision step or disposal control is absent',
          'Add authoritative safety controls and re-review',True,'unsafe_practical'))
    if case.get('assessment_answer_wrong'):
        fs.append(finding(case,'assessment','assessment_quality','CRITICAL',
          'Assessment expected answer is materially wrong','The answer key would reward an incorrect Chemistry response',
          'Correct the expected response and marking guidance',True,'assessment_answer_materially_wrong'))
    if case.get('answer_question_mismatch'):
        fs.append(finding(case,'marking','assessment_quality','CRITICAL',
          'Scientifically correct answer is attached to the wrong question','Question and marking guidance measure different propositions',
          'Realign question, expected response and marks',True,'assessment_answer_materially_wrong'))
    if case.get('assessment_not_taught'):
        fs.append(finding(case,'assessment','assessment_quality','MAJOR',
          'Assessment requires reasoning the guide does not teach','Question demands particle-level causal explanation while instruction remains macroscopic recall',
          'Teach the assessed reasoning or narrow the question to taught content'))
    if case.get('weak_questioning'):
        fs.append(finding(case,'pedagogy','pedagogy_and_sequence','MODERATE',
          'Teacher questioning does not expose the intended understanding','All prompts are recall and none tests the target misconception or reasoning',
          'Add targeted diagnostic and reasoning questions'))
    if case.get('weak_misconception'):
        fs.append(finding(case,'misconception','pedagogy_and_sequence','MODERATE',
          'Named misconception is not instructionally treated','The guide labels a misconception but never elicits, challenges or corrects it',
          'Add an elicitation, contrast and corrective explanation/check'))
    if case.get('generic_differentiation'):
        fs.append(finding(case,'differentiation','inclusion_and_differentiation','MODERATE',
          'Differentiation is generic rather than actionable','Support and extension labels contain no concrete adaptation to the task',
          'Specify a feasible scaffold and extension tied to the learning demand'))
    if case.get('weak_closure'):
        fs.append(finding(case,'teacher_usability','teacher_usability','MODERATE',
          'Lesson closure does not consolidate or verify the stated outcome','Activity ends without synthesis, evidence check or return to the outcome',
          'Add brief consolidation and an outcome-linked exit check'))
    if case.get('fabricated_evidence'):
        fs.append(finding(case,'provenance','source_grounding','CRITICAL',
          'Evidence identity cannot be verified','Citation appears plausible but has no verifiable approved evidence identity',
          'Replace with verifiable authoritative evidence',True,'fabricated_source_or_citation'))
    if case.get('contradictory_sources'):
        fs.append(finding(case,'evidence','source_grounding','CRITICAL',
          'Authoritative evidence conflicts and cannot be resolved safely','Material sources disagree on a required scientific claim',
          'Escalate for authoritative evidence resolution',True,'contradictory_authoritative_evidence_unresolved',.7,'UNRESOLVED'))
    if case.get('style_only'):
        fs.append(finding(case,'teacher_usability','teacher_usability','MINOR',
          'Optional editorial style improvement','No curriculum, correctness, safety or assessment defect is established',
          'Consider only if it materially improves usability',False))
    if case.get('repaired'):
        fs=[f for f in fs if f['category'] not in set(case.get('repaired_categories',[]))]

    # Critic self-discipline: reject duplicates, malformed evidence and severity/blocking contradictions.
    out=[]; seen=set()
    for f in fs:
        key=(f['category'],f['canonical_dimension'],f['claim'])
        if key in seen or not f['evidence']: continue
        if f['hard_blocker_code'] and not f['release_blocking']: raise AssertionError('hard blocker must block')
        if f['severity']=='CRITICAL' and not f['release_blocking']: raise AssertionError('critical must block')
        seen.add(key); out.append(f)
    if any(f['category']=='safety' and f['release_blocking'] for f in out): decision='SAFETY_BLOCK'
    elif any(f['uncertainty']=='UNRESOLVED' and f['release_blocking'] for f in out): decision='EVIDENCE_REQUIRED'
    elif any(f['release_blocking'] for f in out): decision='REPAIR_REQUIRED'
    elif out: decision='PASS_WITH_NOTES'
    else: decision='PASS'
    return {'decision':decision,'findings':out}


def verify_p2_binding() -> dict[str,Any]:
    rubric=json.loads(RUBRIC_PATH.read_text()); gold=json.loads(P2_GOLD_PATH.read_text())
    binding=PROFILE['quality_intelligence_binding']
    rubric_sha=canonical_sha(rubric); gold_sha=canonical_sha(gold)
    if rubric['rubric_key']!=binding['rubric_key'] or rubric['version']!=binding['rubric_version']: raise SystemExit('P2 rubric identity mismatch')
    if rubric_sha!=binding['rubric_sha256']: raise SystemExit(f'P2 rubric SHA mismatch: {rubric_sha}')
    if gold['suite_key']!=binding['gold_suite_key'] or gold['version']!=binding['gold_suite_version']: raise SystemExit('P2 gold identity mismatch')
    if gold_sha!=binding['gold_suite_sha256']: raise SystemExit(f'P2 gold SHA mismatch: {gold_sha}')
    if set(rubric['hard_blockers'])!=BLOCKERS: raise SystemExit('P3 hard blockers diverge from P2')
    if {d['key'] for d in rubric['dimensions']}!=DIMENSIONS: raise SystemExit('P3 dimensions diverge from P2')
    return {'rubric_sha256':rubric_sha,'gold_suite_sha256':gold_sha,'binding':'PASS'}


def main() -> int:
    ap=argparse.ArgumentParser(); ap.add_argument('--suite',required=True); ap.add_argument('--report',default=None); args=ap.parse_args()
    p2=verify_p2_binding()
    suite=json.loads(pathlib.Path(args.suite).read_text()); cases=suite['cases']
    tp=fp=tn=fn=severity_ok=0; layer={'p1':0,'p2':0,'p3':0}; unique_p3=[]; rows=[]
    for c in cases:
        r=review(c); blocked=r['decision'] not in ('PASS','PASS_WITH_NOTES'); expected=bool(c['expected_block'])
        if expected and blocked: tp+=1
        elif expected and not blocked: fn+=1
        elif not expected and blocked: fp+=1
        else: tn+=1
        sev_ok=not c.get('expected_severity') or any(f['severity']==c['expected_severity'] for f in r['findings'])
        severity_ok+=int(sev_ok)
        for key in layer:
            layer[key]+=int(bool(c.get(f'{key}_expected_detect')))
        if c.get('p3_expected_detect') and not c.get('p1_expected_detect') and not c.get('p2_expected_detect'): unique_p3.append(c['id'])
        rows.append({'id':c['id'],'expected_block':expected,'decision':r['decision'],'detected':blocked,'severity_ok':sev_ok,'finding_categories':[f['category'] for f in r['findings']]})
    recall=tp/(tp+fn) if tp+fn else 1.0; fpr=fp/(fp+tn) if fp+tn else 0.0
    report={
      'suite':suite['suite'],'version':suite['version'],'cases':len(cases),'p2_binding':p2,
      'calibration':{'tp':tp,'fn':fn,'fp':fp,'tn':tn,'defect_recall':round(recall,4),'false_negative_rate':round(1-recall,4),'false_positive_rate':round(fpr,4),'severity_accuracy':round(severity_ok/len(cases),4)},
      'layer_expected_detection':layer,
      'p3_unique_reasoning_cases':unique_p3,
      'p3_unique_value_demonstrated':len(unique_p3)>0,
      'rows':rows
    }
    rendered=json.dumps(report,indent=2,sort_keys=True); print(rendered)
    if args.report: pathlib.Path(args.report).write_text(rendered+'\n')
    if fn or fp or severity_ok!=len(cases) or not unique_p3: return 1
    return 0

if __name__=='__main__': raise SystemExit(main())
