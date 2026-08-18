#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]
roots=['app/page.tsx','app/about','app/contact','app/careers','app/institutions','app/trust','app/legal','app/pathways','app/learn/careers','components/public']
files=[]
for root in roots:
    path=ROOT/root
    if path.is_file(): files.append(path)
    elif path.exists(): files.extend(path.rglob('*.tsx'))

# Hard-coded external links are deny-by-default. These hosts are intentional public
# authorities/channels used by VibeSchool's public due-diligence surfaces.
allowed_external_hosts={'wa.me','www.tiktok.com','ppra.go.ke','www.odpc.go.ke'}
for path in sorted(set(files)):
    content=path.read_text(encoding='utf-8')
    rel=path.relative_to(ROOT)
    if 'href="#"' in content or "href='#'" in content or 'javascript:void(0)' in content:
        errors.append(f'{rel}: placeholder link')
    if re.search(r'href=["\']http://',content,re.I): errors.append(f'{rel}: insecure external http link')
    for match in re.finditer(r'href=["\'](https://([^/"\']+)[^"\']*)["\']',content,re.I):
        url,host=match.group(1),match.group(2).lower()
        if host not in allowed_external_hosts:
            errors.append(f'{rel}: unexpected hard-coded external host {host} ({url})')
    for match in re.finditer(r'<a\b([^>]*target=["\']_blank["\'][^>]*)>',content,re.I|re.S):
        attrs=match.group(1)
        if not re.search(r'rel=["\'][^"\']*noopener',attrs,re.I):
            errors.append(f'{rel}: target=_blank link missing noopener')

# Dynamic evidence URLs are allowed only in the school-evidence surface and must use safe new-tab rel.
schools=(ROOT/'app/pathways/schools/page.tsx').read_text(encoding='utf-8')
if 'href={r.source_url}' not in schools or 'noopener' not in schools:
    errors.append('school evidence external URL safety contract missing')

if errors:
    print('PUBLIC LINK CONTRACT: FAIL')
    for error in errors: print(' -',error)
    sys.exit(1)
print('PUBLIC LINK CONTRACT: PASS')
print(f'Audited {len(set(files))} public TSX surfaces for placeholders, insecure hard-coded URLs, unexpected hosts and new-tab isolation.')
