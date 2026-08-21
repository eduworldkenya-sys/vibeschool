#!/usr/bin/env python3
"""Independent deterministic Quality Intelligence evaluator."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from typing import Any
ROOT=Path(__file__).resolve().parents[1]
RUBRIC=ROOT/'quality-intelligence/rubrics/teacher-guide-v1.json'
GOLD=ROOT/'quality-intelligence/fixtures/teacher-guide-gold-v1.json'

def load(path:Path)->dict[str,Any]: return json.loads(path.read_text(encoding='utf-8'))
def sha(value:Any)->str: return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def validate(r:dict[str,Any])->None:
    ds=r.get('dimensions',[]); keys=[d['key'] for d in ds]
    if not ds or len(keys)!=len(set(keys)): raise ValueError('invalid dimensions')
    if sum(int(d['weight']) for d in ds)!=100: raise ValueError('weights must sum to 100')
    i=r.get('independence',{})
    if i.get('content_worker_may_modify') is not False or i.get('content_worker_self_score_is_authoritative') is not False: raise ValueError('worker independence violated')

def evaluate(scores:dict[str,Any],blockers:list[str],r:dict[str,Any])->dict[str,Any]:
    validate(r); hard=set(r['hard_blockers'])
    unknown=sorted(set(blockers)-hard)
    if unknown: raise ValueError('unknown blockers: '+','.join(unknown))
    total=0.0; minima=[]; normalized={}
    for d in r['dimensions']:
        k=d['key']
        if k not in scores: raise ValueError('missing score: '+k)
        v=int(scores[k])
        if not 0<=v<=5: raise ValueError('score out of range: '+k)
        normalized[k]=v; total+=(v/5)*int(d['weight'])
        if v<int(d['minimum_certified_score']): minima.append(k)
    extra=sorted(set(scores)-set(normalized))
    if extra: raise ValueError('unknown scores: '+','.join(extra))
    overall=round(total,2); threshold=float(r['score_scale']['certification_threshold'])
    disposition='block' if blockers else ('reject' if minima or overall<threshold else 'certify')
    return {'disposition':disposition,'overall_score':overall,'failed_dimension_minima':minima,'hard_blockers':blockers,'dimension_scores':normalized,'rubric_key':r['rubric_key'],'rubric_version':r['version'],'rubric_sha256':sha(r)}

def calibrate(r:dict[str,Any],suite:dict[str,Any])->dict[str,Any]:
    cases=suite.get('cases',[])
    if not cases: raise ValueError('no gold cases')
    rows=[]; fp=fn=pos=neg=0
    for case in cases:
        result=evaluate(case['scores'],case.get('blockers',[]),r); expected=case['expected_disposition']; actual=result['disposition']; ok=actual==expected
        if expected=='certify': pos+=1; fn+=int(actual!='certify')
        else: neg+=1; fp+=int(actual=='certify')
        rows.append({'case_key':case['case_key'],'expected':expected,'actual':actual,'passed':ok,'score':result['overall_score']})
    passed=sum(int(x['passed']) for x in rows)
    return {'suite_key':suite['suite_key'],'suite_version':suite['version'],'suite_sha256':sha(suite),'rubric_sha256':sha(r),'cases':len(rows),'passed':passed,'failed':len(rows)-passed,'accuracy':round(passed/len(rows),4),'false_positive_rate':round(fp/max(neg,1),4),'false_negative_rate':round(fn/max(pos,1),4),'results':rows}

def compare(before:dict[str,Any],after:dict[str,Any])->dict[str,Any]:
    if before.get('rubric_sha256')!=after.get('rubric_sha256'): raise ValueError('rubric mismatch')
    deltas={k:after['dimension_scores'][k]-v for k,v in before['dimension_scores'].items()}; regressions=sorted(k for k,v in deltas.items() if v<0)
    return {'overall_delta':round(float(after['overall_score'])-float(before['overall_score']),2),'dimension_deltas':deltas,'regressed_dimensions':regressions,'regression_free':not regressions}

def main()->int:
    p=argparse.ArgumentParser(); p.add_argument('--rubric',type=Path,default=RUBRIC); p.add_argument('--gold',type=Path,default=GOLD); p.add_argument('--calibrate',action='store_true'); p.add_argument('--input',type=Path); a=p.parse_args(); r=load(a.rubric)
    report=calibrate(r,load(a.gold)) if a.calibrate else evaluate(load(a.input)['scores'],load(a.input).get('blockers',[]),r) if a.input else None
    if report is None: p.error('use --calibrate or --input')
    print(json.dumps(report,indent=2,sort_keys=True)); return 1 if report.get('failed',0) else 0
if __name__=='__main__': raise SystemExit(main())
