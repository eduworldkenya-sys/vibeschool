from pathlib import Path

page = Path('app/hq/content/page.tsx').read_text()
required = [
    'Content Release',
    'My approvals',
    'Needs work',
    'Release status',
    'View blockers',
    'View requirement',
    'Approve exact version',
    'hq_review_publishing_artifact',
    'p_expected_version',
    'Technical release evidence',
    'Review rubric',
]
missing = [token for token in required if token not in page]
if missing:
    raise SystemExit(f'HQ Content Release OS contract missing: {missing}')

forbidden = [
    'publication_release\"?\"Open review',
]
for token in forbidden:
    if token in page:
        raise SystemExit(f'Forbidden legacy publishing action contract remains: {token}')

print('HQ Content Release OS regression contract: PASS')
