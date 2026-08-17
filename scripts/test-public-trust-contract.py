#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def text(rel: str) -> str:
    path = ROOT / rel
    if not path.exists():
        errors.append(f'missing {rel}')
        return ''
    return path.read_text(encoding='utf-8')

# Public surfaces that must remain inside the VibeSchool public trust shell.
shell_pages = [
    'app/page.tsx',
    'app/about/page.tsx',
    'app/contact/page.tsx',
    'app/careers/page.tsx',
    'app/legal/page.tsx',
    'app/legal/privacy/page.tsx',
    'app/legal/terms/page.tsx',
    'app/legal/aup/page.tsx',
    'app/pathways/page.tsx',
    'app/pathways/subjects/page.tsx',
    'app/pathways/continue/page.tsx',
]
for rel in shell_pages:
    content = text(rel)
    if 'PublicHeader' not in content:
        errors.append(f'{rel}: missing PublicHeader')
    if 'PublicFooter' not in content:
        errors.append(f'{rel}: missing PublicFooter')
    if 'main-content' not in content:
        errors.append(f'{rel}: missing main-content landmark target')

header = text('components/public/PublicHeader.tsx')
footer = text('components/public/PublicFooter.tsx')
shell_css = text('components/public/PublicShell.module.css')

for fragment in ['Skip to content', 'aria-label="Public navigation"', '/pathways', '/about', '/contact', '/login/global']:
    if fragment not in header:
        errors.append(f'PublicHeader missing: {fragment}')
for fragment in ['@vibeschoolkenya', 'wa.me/254728232157', '/legal/privacy', '/legal/terms', '/legal/aup', '/careers']:
    if fragment not in footer:
        errors.append(f'PublicFooter missing: {fragment}')
for fragment in [':focus-visible', '@media(max-width:640px)', 'min-height:44px']:
    if fragment not in shell_css:
        errors.append(f'PublicShell accessibility/responsive contract missing: {fragment}')

home = text('app/page.tsx')
for fragment in ['SEE THE PRODUCT WITHOUT AN ACCOUNT', 'FOR SCHOOLS, INSTITUTIONS & PUBLIC-SECTOR PARTNERS', 'Curriculum', 'Pathways', 'Trust & policies']:
    if fragment not in home:
        errors.append(f'homepage communication missing: {fragment}')

contact = text('app/contact/page.tsx')
for fragment in ['GENERAL ENQUIRIES', 'No account needed.', 'ACCOUNT SUPPORT', '@vibeschoolkenya', 'Never include passwords']:
    if fragment not in contact:
        errors.append(f'contact trust contract missing: {fragment}')

pathways = text('app/pathways/page.tsx')
for fragment in ['Guidance, not placement', 'No login to start', 'Verified education information', 'uncertainty']:
    if fragment not in pathways:
        errors.append(f'Pathways trust contract missing: {fragment}')

privacy = text('app/legal/privacy/page.tsx')
terms = text('app/legal/terms/page.tsx')
aup = text('app/legal/aup/page.tsx')
legal = privacy + terms + aup
for forbidden in ['BN-KYCZ73AZ', '+254 720 614664', '+254 732 227603']:
    if forbidden in legal:
        errors.append(f'legacy operator/contact detail remains public: {forbidden}')
if 'VibeSchool is a paid platform' in terms:
    errors.append('Terms still incorrectly describe all VibeSchool as paid')

# Never manufacture social proof in this package.
for rel in shell_pages:
    content = text(rel)
    if re.search(r'\b(?:10|20|50|100|500)[,+]?000\s+(?:students|learners|schools|teachers)\b', content, flags=re.I):
        errors.append(f'{rel}: suspicious unsupported adoption metric')

if errors:
    print('PUBLIC TRUST CONTRACT: FAIL')
    for error in errors:
        print(f' - {error}')
    sys.exit(1)

print('PUBLIC TRUST CONTRACT: PASS')
print('Public purpose, shell, navigation, trust, contact, legal and responsive invariants are present.')
