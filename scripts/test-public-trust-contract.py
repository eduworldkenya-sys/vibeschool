#!/usr/bin/env python3
from pathlib import Path
import json
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

# Public surfaces that must remain inside the canonical VibeSchool shell.
shell_pages = [
    'app/page.tsx','app/product/page.tsx','app/about/page.tsx','app/contact/page.tsx','app/careers/page.tsx',
    'app/institutions/page.tsx','app/trust/page.tsx','app/trust/child-safety/page.tsx',
    'app/trust/security/page.tsx','app/trust/responsible-ai/page.tsx','app/legal/page.tsx',
    'app/legal/privacy/page.tsx','app/legal/terms/page.tsx','app/legal/aup/page.tsx',
    'app/pathways/page.tsx','app/pathways/subjects/page.tsx','app/pathways/continue/page.tsx',
    'app/not-found.tsx',
]
for rel in shell_pages:
    content = text(rel)
    for required in ['PublicHeader','PublicFooter','main-content']:
        if required not in content:
            errors.append(f'{rel}: missing {required}')

header = text('components/public/PublicHeader.tsx')
footer = text('components/public/PublicFooter.tsx')
shell_css = text('components/public/PublicShell.module.css')
for fragment in ['Skip to content','aria-label="Public navigation"','/product','/pathways','/institutions','/about','/contact','/login/global','PublicJourneyTracker']:
    if fragment not in header: errors.append(f'PublicHeader missing: {fragment}')
for fragment in ['@vibeschoolkenya','wa.me/254728232157','/legal/privacy','/legal/terms','/legal/aup','/careers','/institutions','/trust']:
    if fragment not in footer: errors.append(f'PublicFooter missing: {fragment}')
for fragment in [':focus-visible','@media(max-width:640px)','min-height:44px','prefers-reduced-motion']:
    if fragment not in shell_css: errors.append(f'PublicShell accessibility/responsive contract missing: {fragment}')

# Mission and vision are strategic product invariants, not mutable campaign copy.
mission = text('docs/strategy/VIBESCHOOL-MISSION-VISION-LOCK.md')
for fragment in [
    'LOCKED STRATEGIC CONSTITUTION',
    'Build the Education Operating System',
    'Every learner known. Every lesson connected. Every outcome visible.',
    'KNOW → PLAN → TEACH → LEARN → PROVE → ADAPT → REPORT → PROGRESS',
    'AI is not an authority.',
    'Design systems, not isolated pages.',
    'Change Control',
]:
    if fragment not in mission: errors.append(f'mission/vision lock missing: {fragment}')

home = text('app/page.tsx')
for fragment in ['RoleJourneySelector','ConnectedEducationExplorer','SchoolReadinessAssessment','EXPLORE VIBESCHOOL','FOR SCHOOLS & EDUCATION INSTITUTIONS','Pathways','Trust Centre','/product','/institutions']:
    if fragment not in home: errors.append(f'homepage communication missing: {fragment}')

role_selector = text('components/public/RoleJourneySelector.tsx')
for fragment in ['Learner','Teacher','Family','School leader','public_role_learner','public_role_teacher','public_role_family','public_role_school','See the whole system']:
    if fragment not in role_selector: errors.append(f'role journey selector missing: {fragment}')

explorer = text('components/public/ConnectedEducationExplorer.tsx')
for fragment in ['CONNECTED EDUCATION EXPLORER','WHAT ENTERS','WHAT BECOMES CLEARER','WHO BENEFITS','WHAT CONNECTS NEXT','does not claim that every workflow has completed live-school pilot validation','public_connected_explorer_interaction']:
    if fragment not in explorer: errors.append(f'connected education explorer missing: {fragment}')

readiness = text('components/public/SchoolReadinessAssessment.tsx')
for fragment in ['SCHOOL READINESS CHECK','self-assessment, not an external audit or certification','public_readiness_start','public_readiness_complete_early','public_readiness_complete_connected']:
    if fragment not in readiness: errors.append(f'school readiness assessment missing: {fragment}')
for forbidden in ['email','phone','student_id','school_id','learner_id']:
    if re.search(rf"['\"]{forbidden}['\"]\s*:", readiness, re.I): errors.append(f'readiness assessment must not collect {forbidden}')

product = text('app/product/page.tsx')
for fragment in ['THE VIBESCHOOL PRODUCT','THE CONNECTED LEARNING CHAIN','TEACHERS','LEARNERS','FAMILIES','SCHOOLS','WHY VIBESCHOOL IS DESIGNED DIFFERENTLY','PRODUCT PROOF, WITHOUT FABRICATED CLAIMS','CapabilityStatus','/institutions','/pathways']:
    if fragment not in product: errors.append(f'product surface missing: {fragment}')

capability = text('components/public/CapabilityStatus.tsx')
for fragment in ['CAPABILITY STATUS','Available','Validation','Planned','does not publish an invented support or uptime guarantee' if False else 'operational or pilot proof','public_capability_status_view']:
    if fragment not in capability: errors.append(f'capability transparency missing: {fragment}')
for forbidden in ['10,000 learners','100 schools','99.9% uptime']:
    if forbidden in capability: errors.append(f'capability status contains unsupported proof: {forbidden}')

contact = text('app/contact/page.tsx')
for fragment in ['GENERAL ENQUIRIES','No account needed.','ACCOUNT SUPPORT','Government / public sector','Partnership / funding','Careers / talent','Never include passwords','public_contact_support_submit']:
    if fragment not in contact: errors.append(f'contact trust/routing contract missing: {fragment}')

institutions = text('app/institutions/page.tsx')
for fragment in ['VIBESCHOOL FOR SCHOOLS','WHAT A SCHOOL CAN BRING TOGETHER','IMPLEMENTATION PRINCIPLE','BEFORE ADOPTION','QUESTIONS A SCHOOL SHOULD ASK BEFORE BUYING','does not publish an invented support or uptime guarantee','/trust']:
    if fragment not in institutions: errors.append(f'institutional surface missing: {fragment}')

trust = text('app/trust/page.tsx')
for fragment in ['/trust/child-safety','/trust/security','/trust/responsible-ai','FORMAL POLICIES','/institutions']:
    if fragment not in trust: errors.append(f'Trust Centre missing: {fragment}')

child = text('app/trust/child-safety/page.tsx')
security = text('app/trust/security/page.tsx')
ai = text('app/trust/responsible-ai/page.tsx')
for fragment in ['Best interests first','Verified relationships matter','Human escalation remains possible']:
    if fragment not in child: errors.append(f'child-safety surface missing: {fragment}')
for fragment in ['Identity before authority','Least-necessary access','Server and database enforcement','Fail closed for uncertainty']:
    if fragment not in security: errors.append(f'security surface missing: {fragment}')
for fragment in ['Assist, do not quietly decide','Human responsibility remains','Uncertainty should be visible','Protect learner information']:
    if fragment not in ai: errors.append(f'responsible-AI surface missing: {fragment}')

pathways = text('app/pathways/page.tsx')
for fragment in ['Guidance, not placement','No login to start','Verified education information','uncertainty']:
    if fragment not in pathways: errors.append(f'Pathways trust contract missing: {fragment}')

privacy = text('app/legal/privacy/page.tsx')
terms = text('app/legal/terms/page.tsx')
aup = text('app/legal/aup/page.tsx')
legal = privacy + terms + aup
for forbidden in ['BN-KYCZ73AZ','+254 720 614664','+254 732 227603','VibeSchool is a paid platform']:
    if forbidden in legal: errors.append(f'legacy legal/product wording remains public: {forbidden}')
for fragment in ['Children require additional protection','We do not sell personal data']:
    if fragment not in privacy: errors.append(f'Privacy contract missing: {fragment}')
for fragment in ['Free and paid services','Education guidance and decisions','does not mean VibeSchool automatically owns every item']:
    if fragment not in terms: errors.append(f'Terms contract missing: {fragment}')
for fragment in ['Learners and students','AI-supported learning tools','Schools and administrators']:
    if fragment not in aup: errors.append(f'AUP contract missing: {fragment}')

layout = text('app/layout.tsx')
sitemap = text('app/sitemap.ts')
robots = text('app/robots.ts')
og = text('app/opengraph-image.tsx')
for fragment in ['metadataBase','EducationalOrganization','WebSite','openGraph','twitter','/opengraph-image']:
    if fragment not in layout: errors.append(f'global SEO metadata missing: {fragment}')
for route in ['/product','/institutions','/trust/child-safety','/trust/security','/trust/responsible-ai','/pathways/schools','/legal/aup']:
    if route not in sitemap: errors.append(f'sitemap missing: {route}')
for fragment in ['/product','/teachers','/learners','/families','/trust/','/pathways/','/student/','sitemap:']:
    if fragment not in robots: errors.append(f'robots policy missing: {fragment}')
for fragment in ['ImageResponse','1200','630','connected education for Kenya']:
    if fragment not in og: errors.append(f'Open Graph image missing: {fragment}')

telemetry = text('app/api/public-telemetry/route.ts')
telemetry_client = text('lib/publicTelemetry.ts')
journey_tracker = text('components/public/PublicJourneyTracker.tsx')
for fragment in ['ALLOWED_EVENTS','credentials','query strings','free-text','learner/school identifiers','readiness answers','cache-control']:
    if fragment not in telemetry: errors.append(f'privacy telemetry endpoint missing: {fragment}')
for forbidden in ['email','phone','user_id','student_id','school_id']:
    if re.search(rf"['\"]{forbidden}['\"]\s*:", telemetry, re.I): errors.append(f'telemetry must not collect {forbidden}')
for fragment in ['sendBeacon','public_contact_whatsapp','public_auth_signin','public_readiness_start','public_role_teacher','public_connected_explorer_interaction','public_capability_status_view']:
    if fragment not in telemetry_client: errors.append(f'telemetry client missing: {fragment}')
for fragment in ['/pathways/check','/pathways/schools','/learn/careers','data-vs-tracked']:
    if fragment not in journey_tracker: errors.append(f'public funnel tracker missing: {fragment}')

not_found = text('app/not-found.tsx')
for fragment in ['This page is not where we expected it to be.','VibeSchool home','Explore Pathways','Contact us']:
    if fragment not in not_found: errors.append(f'404 recovery missing: {fragment}')

sw = text('public/sw.js')
offline = text('public/offline.html')
for fragment in ['SAFE_PUBLIC_ROUTES','/offline.html','/institutions','/trust','url.pathname.startsWith(\'/api/\')']:
    if fragment not in sw: errors.append(f'PWA public resilience missing: {fragment}')
for forbidden in ["'/student/'","'/teacher/'","'/parent/'","'/admin/'"]:
    if forbidden in sw: errors.append(f'private route must not be in shared public cache: {forbidden}')
for fragment in ['You’re offline.','private learner or school records','Try again']:
    if fragment not in offline: errors.append(f'offline UX missing: {fragment}')

governance_path = ROOT / 'config/public-content-governance.json'
if not governance_path.exists(): errors.append('missing public content governance registry')
else:
    try:
        governance = json.loads(governance_path.read_text(encoding='utf-8'))
        governed = {entry.get('route') for entry in governance.get('entries', [])}
        for route in ['/','/product','/contact','/institutions','/trust','/legal/privacy','/pathways']:
            if route not in governed: errors.append(f'content governance missing route: {route}')
    except Exception as exc:
        errors.append(f'invalid public content governance json: {exc}')

# No placeholder social/link promises or old public role routes in changed marketing surfaces.
for rel in shell_pages:
    content = text(rel)
    for forbidden in ['Link coming soon','href="#"','/login/teacher"','/login/parent"','/login/admin"']:
        if forbidden in content: errors.append(f'{rel}: stale/placeholder public UX remains: {forbidden}')
    if re.search(r'\b(?:10|20|50|100|500)[,+]?000\s+(?:students|learners|schools|teachers)\b', content, flags=re.I):
        errors.append(f'{rel}: suspicious unsupported adoption metric')

if errors:
    print('PUBLIC TRUST CONTRACT: FAIL')
    for error in errors: print(f' - {error}')
    sys.exit(1)

print('PUBLIC TRUST CONTRACT: PASS')
print('Mission, product proof, trust, governance, legal consistency, SEO, measurement, resilience and public-shell invariants are present.')
