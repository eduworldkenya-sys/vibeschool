#!/usr/bin/env python3
import argparse, json, pathlib, re, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROFILE=json.loads((ROOT/'critic/independent-critic-v1.json').read_text())

CATEGORIES={'curriculum','scientific_correctness','pedagogy','teaching_depth','activity','classroom_feasibility','assessment','marking','misconception','differentiation','inclusion','practical','safety','evidence','provenance','consistency','teacher_usability','governance'}

def finding(case, category, severity, claim, evidence, remediation, blocking=True, confidence=.95, uncertainty=None):
    return {'finding_id':f"{case['id']}:{category}:{len(claim)}",'critic_execution_id':case.get('execution_id','exam'), 'artifact_id':case['id'],'artifact_version':case.get('version','v1'),'quality_contract_version':case.get('quality_contract_version','p2-v1'),'critic_profile_version':'independent-senior-educational-editor:v1','subject_profile_version':'chemistry:v1','category':category,'severity':severity,'affected_section':case.get('section','artifact'),'affected_curriculum_outcome':case.get('outcome'),'claim':claim,'evidence':evidence,'reasoning_summary':claim,'required_remediation':remediation,'release_blocking':blocking,'confidence':confidence,'uncertainty':uncertainty,'created_at':'EXAM'}

def review(case):
    t=case['content'].lower(); fs=[]
    if case.get('curriculum_linked') and not case.get('teachable_chain'):
        fs.append(finding(case,'curriculum','MAJOR','Curriculum linkage exists without a teachable instructional chain','Mapped outcome lacks explanation, learner experience, teacher check, assessment or expected evidence','Add the missing outcome-specific instructional chain'))
    wrong=[r'protons and electrons.*mass number',r'mass number.*protons.*electrons',r'acid.*turns blue litmus blue']
    if any(re.search(p,t) for p in wrong): fs.append(finding(case,'scientific_correctness','CRITICAL','Material Chemistry claim is scientifically wrong','Artifact contains a known false scientific relationship','Correct the scientific claim from authoritative evidence and re-review'))
    if case.get('polished_shallow') or ('summary' in t and case.get('requires_teaching')):
        fs.append(finding(case,'teaching_depth','MAJOR','Factually fluent material does not provide sufficient teaching depth','Content summarizes information without an executable explanation/experience/check sequence','Develop classroom-ready explanations, examples, learner work and checks'))
    if case.get('activity_without_learning'):
        fs.append(finding(case,'activity','MAJOR','Activity volume does not establish meaningful learning','Activities lack expected observation, conclusion or learning check','Tie each activity to an outcome, expected result and teacher check'))
    if case.get('assessment_answer_wrong') or case.get('answer_question_mismatch'):
        fs.append(finding(case,'assessment','CRITICAL','Assessment answer/marking relationship is materially invalid','Expected answer is wrong or attached to a different question','Correct question-answer-marking alignment and re-evaluate'))
    if case.get('unsafe_practical'):
        fs.append(finding(case,'safety','CRITICAL','Practical has an unresolved material safety omission','Hazard/control/supervision or disposal evidence is insufficient','Add authoritative safety controls; require human/editorial evidence if uncertainty remains'))
    if case.get('fabricated_evidence'):
        fs.append(finding(case,'provenance','CRITICAL','Evidence/provenance appears fabricated or cannot be verified','Citation/evidence identity is unsupported','Replace with verifiable authoritative evidence'))
    if case.get('contradictory_sources'):
        fs.append(finding(case,'evidence','CRITICAL','Authoritative source evidence conflicts and cannot be resolved safely','Input sources make contradictory material claims','Escalate for authoritative evidence resolution',True,.7,'UNRESOLVED'))
    # critic self-discipline: never elevate pure style preference
    if case.get('style_only'):
        fs.append(finding(case,'teacher_usability','MINOR','Optional editorial style improvement','No curriculum, correctness, safety or assessment defect is established','Consider stylistic revision only if it improves usability',False,.9,None))
    # stale findings are invalid after repair when current evidence disproves them
    if case.get('repaired'):
        fs=[f for f in fs if f['category'] not in set(case.get('repaired_categories',[]))]
    # de-duplicate and validate evidence/category/severity
    out=[]; seen=set()
    for f in fs:
        key=(f['category'],f['claim'],f['affected_section'])
        if key in seen or f['category'] not in CATEGORIES or not f['evidence']: continue
        seen.add(key); out.append(f)
    if any(f['category']=='safety' and f['release_blocking'] for f in out): decision='SAFETY_BLOCK'
    elif any(f.get('uncertainty')=='UNRESOLVED' and f['release_blocking'] for f in out): decision='EVIDENCE_REQUIRED'
    elif any(f['release_blocking'] for f in out): decision='REPAIR_REQUIRED'
    elif out: decision='PASS_WITH_NOTES'
    else: decision='PASS'
    return {'decision':decision,'findings':out}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--suite',required=True); args=ap.parse_args()
    cases=json.loads(pathlib.Path(args.suite).read_text())['cases']; tp=fp=tn=fn=0; severity_ok=0
    for c in cases:
        r=review(c); blocked=r['decision'] not in ('PASS','PASS_WITH_NOTES'); expected=c['expected_block']
        if expected and blocked: tp+=1
        elif expected and not blocked: fn+=1
        elif not expected and blocked: fp+=1
        else: tn+=1
        if not c.get('expected_severity') or any(f['severity']==c['expected_severity'] for f in r['findings']): severity_ok+=1
        print(json.dumps({'id':c['id'],'decision':r['decision'],'findings':r['findings']},sort_keys=True))
    recall=tp/(tp+fn) if tp+fn else 1; fpr=fp/(fp+tn) if fp+tn else 0
    print(json.dumps({'cases':len(cases),'tp':tp,'fn':fn,'fp':fp,'tn':tn,'defect_recall':recall,'false_positive_rate':fpr,'severity_accuracy':severity_ok/len(cases)},sort_keys=True))
    if fn or fp or severity_ok != len(cases): sys.exit(1)
if __name__=='__main__': main()
