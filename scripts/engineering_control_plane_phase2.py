#!/usr/bin/env python3
"""Phase-2 semantic reconciliation and deterministic promotion primitives."""
from __future__ import annotations
import argparse, json, re, sys
from dataclasses import dataclass, asdict
from pathlib import Path

POLICY = json.loads(Path('.github/control-plane/phase2-policy.json').read_text())

@dataclass(frozen=True)
class Manifest:
    pr: int
    head: str
    base: str
    domains: tuple[str, ...]
    migrations: tuple[str, ...] = ()
    dependencies: tuple[int, ...] = ()
    state: str = 'DEVELOPING'


def migration_versions(names):
    out=[]
    for name in names:
        m=re.match(r'^(\d{8,14})_', Path(name).name)
        if m: out.append(m.group(1))
    return tuple(sorted(out))


def collision(a: Manifest, b: Manifest):
    reasons=[]
    shared=set(a.domains)&set(b.domains)&set(POLICY['exclusive_domains'])
    if shared: reasons.append({'code':'SEMANTIC_COLLISION','domains':sorted(shared)})
    av=set(migration_versions(a.migrations)); bv=set(migration_versions(b.migrations))
    if av & bv: reasons.append({'code':'MIGRATION_COLLISION','versions':sorted(av&bv)})
    return reasons


def invalidate(merged_domains, candidate: Manifest):
    affected=sorted(set(merged_domains)&set(candidate.domains))
    if not affected:
        return {'state':candidate.state,'reason':None,'affected_domains':[]}
    return {'state':'RECONCILE REQUIRED','reason':'UPSTREAM_INVALIDATION','affected_domains':affected}


def verdict(candidate: Manifest, current_main: str, evidence: dict, active: list[Manifest]):
    reasons=[]
    if candidate.base != current_main: reasons.append('STALE_MAIN')
    if evidence.get('head') != candidate.head: reasons.append('STALE_HEAD')
    if evidence.get('main') != current_main: reasons.append('STALE_MAIN')
    if evidence.get('superseded', False): reasons.append('STALE_HEAD')
    if evidence.get('security') == 'RED': reasons.append('RLS_SECURITY_RED')
    if evidence.get('reconstruction') == 'RED': reasons.append('DB_RECONSTRUCTION_FAILURE')
    if evidence.get('generated_types') == 'DRIFT': reasons.append('GENERATED_TYPES_DRIFT')
    if evidence.get('build') == 'RED': reasons.append('BUILD_FAILURE')
    if evidence.get('workflow_security') == 'RED': reasons.append('WORKFLOW_SECURITY_RED')
    if evidence.get('production_drift') == 'RED': reasons.append('PRODUCTION_DRIFT')
    for other in active:
        if other.pr != candidate.pr:
            reasons += [x['code'] for x in collision(candidate, other)]
    reasons=sorted(set(reasons))
    if reasons:
        state='SECURITY RED' if any(x in reasons for x in ('RLS_SECURITY_RED','WORKFLOW_SECURITY_RED')) else 'BLOCKED'
    else:
        state='MERGE ELIGIBLE'
    return {'pr':candidate.pr,'head':candidate.head,'current_main':current_main,'state':state,'reasons':reasons}


def self_test():
    a=Manifest(1,'h1','m',('DATABASE','AUTH'),('202608190001_a.sql',))
    b=Manifest(2,'h2','m',('DATABASE',),('202608190001_b.sql',))
    codes={x['code'] for x in collision(a,b)}
    assert codes == {'SEMANTIC_COLLISION','MIGRATION_COLLISION'}
    assert invalidate(['AUTH'],a)['state']=='RECONCILE REQUIRED'
    assert invalidate(['TELEMETRY'],a)['state']==a.state
    good={'head':'h1','main':'m','security':'GREEN','reconstruction':'GREEN','generated_types':'GREEN','build':'GREEN','workflow_security':'GREEN','production_drift':'GREEN'}
    assert verdict(a,'m',good,[])['state']=='MERGE ELIGIBLE'
    stale=dict(good,head='old'); assert 'STALE_HEAD' in verdict(a,'m',stale,[])['reasons']
    sup=dict(good,superseded=True); assert verdict(a,'m',sup,[])['state']=='BLOCKED'
    assert verdict(a,'m',good,[b])['state']=='BLOCKED'
    print('phase-2 adversarial self-test: PASS')


def load_manifest(d):
    return Manifest(int(d['pr']),d['head'],d['base'],tuple(sorted(d.get('domains',[]))),tuple(sorted(d.get('migrations',[]))),tuple(d.get('dependencies',[])),d.get('state','DEVELOPING'))


def main():
    p=argparse.ArgumentParser(); p.add_argument('--self-test',action='store_true'); p.add_argument('--input')
    a=p.parse_args()
    if a.self_test: self_test(); return 0
    if not a.input: p.error('--input required unless --self-test')
    data=json.loads(Path(a.input).read_text())
    manifests=[load_manifest(x) for x in data['prs']]
    output={'current_main':data['current_main'],'prs':[],'collisions':[]}
    for m in manifests:
        output['prs'].append(verdict(m,data['current_main'],data.get('evidence',{}).get(str(m.pr),{}),manifests))
    for i,x in enumerate(manifests):
        for y in manifests[i+1:]:
            c=collision(x,y)
            if c: output['collisions'].append({'prs':[x.pr,y.pr],'reasons':c})
    print(json.dumps(output,indent=2)); return 2 if any(x['state']!='MERGE ELIGIBLE' for x in output['prs']) else 0

if __name__=='__main__': sys.exit(main())
