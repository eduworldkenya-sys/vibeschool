#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

checks: list[tuple[bool, str]] = []

def read(path: str) -> str:
    p = ROOT / path
    checks.append((p.exists(), f"required file exists: {path}"))
    return p.read_text(encoding="utf-8") if p.exists() else ""

layout = read("app/parent/layout.tsx")
children = read("app/parent/students/page.tsx")
profile = read("app/parent/profile/page.tsx")
support = read("app/parent/support/page.tsx")
core = read("scripts/validate-parent-core-journey.py")

for label in ["Home", "Children", "Schoolwork", "Progress", "Messages"]:
    checks.append((f'label: "{label}"' in layout, f"primary navigation exposes {label}"))

checks += [
    ('href: "/parent/inbox"' in layout, "canonical messages destination is Parent Inbox"),
    ('router.push("/parent/messages")' not in layout, "top-level navigation does not route to legacy parent/messages"),
    ('aria-current={isActive ? "page" : undefined}' in layout, "bottom navigation exposes active-page semantics"),
    ('minHeight: 44' in layout, "primary header controls keep mobile tap targets"),
    ('attendanceRecords === 0 || child.attendancePct === null' in children, "missing attendance is explicit"),
    ('This does not mean the learner was absent.' in children, "missing attendance is never presented as absence"),
    ('attendancePct: rows.length ?' in children, "zero percent remains a real recorded value"),
    ('Link or request access' in children, "no-child state uses verified relationship flow"),
    ('Add Child to Class' not in children and '+ Add Child' not in children, "children page does not imply arbitrary learner creation"),
    ('router.push("/parent/profile")' in children, "children settings entry resolves to a real account surface"),
    ('No pretend switches are displayed.' in profile, "profile does not expose fake notification preferences"),
    ('router.push("/parent/link-child")' in profile, "profile linking uses verified relationship route"),
    ('router.push("/parent/support")' in profile, "profile exposes Report a Problem"),
    ('parent_student_links' in profile, "profile linked-child list derives from relationship authority"),
    ('Do not send passwords, PINs' in support, "support copy warns against sensitive-data disclosure"),
    ('Role: parent' in support, "support context is role-scoped"),
    ('student_id' not in support and 'childId' not in support, "support context does not embed child identifiers"),
    (bool(core), "Task 25 is stacked on Task 6 Parent core journey contract"),
]

failed = [message for ok, message in checks if not ok]
for ok, message in checks:
    print(("PASS" if ok else "FAIL") + " - " + message)

if failed:
    print(f"\nParent UX Task 25 contract failed: {len(failed)} check(s).", file=sys.stderr)
    sys.exit(1)

print(f"\nParent UX Task 25 contract passed: {len(checks)} checks.")
