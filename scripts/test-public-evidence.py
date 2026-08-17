#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
config = json.loads((root / 'config/public-evidence.json').read_text())
claims = config.get('claims', [])
allowed = set(config.get('publication_policy', {}).get('allowed_statuses', []))
required = {'id','title','status','metric_definition','value','measurement_window','population','method','verification','permission','limitations','source_reference'}
forbidden_keys = {'learner_id','student_id','parent_id','teacher_id','email','phone','raw_data','password','token'}

assert config.get('publication_policy', {}).get('default') == 'withhold', 'public evidence must fail closed'
assert allowed == {'draft','measured','verified','permissioned','published','withdrawn'}, 'unexpected evidence lifecycle'

for claim in claims:
    assert claim.get('status') in allowed, f"invalid status for {claim.get('id')}"
    assert not (forbidden_keys & set(claim.keys())), f"private/raw identifier key in public claim {claim.get('id')}"
    if claim.get('status') == 'published':
        missing = required - set(claim.keys())
        assert not missing, f"published claim missing {sorted(missing)}"
        for key in ('id','title','metric_definition','value','measurement_window','population','method','source_reference'):
            assert isinstance(claim.get(key), str) and claim[key].strip(), f"published claim missing {key}"
        verification = claim.get('verification', {})
        permission = claim.get('permission', {})
        assert verification.get('status') == 'verified', 'published claim is not verified'
        assert all(isinstance(verification.get(k), str) and verification[k].strip() for k in ('verified_at','verified_by','evidence_reference')), 'verification lineage incomplete'
        assert permission.get('status') == 'granted', 'published claim lacks publication permission'
        assert all(isinstance(permission.get(k), str) and permission[k].strip() for k in ('granted_at','scope')), 'permission scope incomplete'
        limitations = claim.get('limitations')
        assert isinstance(limitations, list) and limitations and all(isinstance(x,str) and x.strip() for x in limitations), 'published claim must expose limitations'

page = (root / 'app/evidence/page.tsx').read_text()
sitemap = (root / 'app/sitemap.ts').read_text()
footer = (root / 'components/public/PublicFooter.tsx').read_text()
governance = json.loads((root / 'config/public-content-governance.json').read_text())

assert 'No verified pilot outcome has been published yet.' in page
assert 'Operational row counts alone are never treated as adoption or impact proof.' in page
assert '/evidence' in sitemap
assert 'href="/evidence"' in footer
assert any(entry.get('route') == '/evidence' and entry.get('owner') == 'Evidence' for entry in governance.get('entries', []))
print(f'Public Evidence Contract: PASS ({len(claims)} claims, {sum(c.get("status") == "published" for c in claims)} published)')
