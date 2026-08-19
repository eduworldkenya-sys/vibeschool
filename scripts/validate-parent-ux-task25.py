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
home = read("app/parent/page.tsx")
children = read("app/parent/students/page.tsx")
child = read("app/parent/child/[id]/page.tsx")
homework = read("app/parent/child/[id]/homework/page.tsx")
messages = read("app/parent/child/[id]/messages/page.tsx")
learn = read("app/parent/learn/page.tsx")
results = read("app/parent/assessments/page.tsx")
inbox = read("app/parent/inbox/page.tsx")
profile = read("app/parent/profile/page.tsx")
support = read("app/parent/support/page.tsx")
connect = read("app/parent/connect/page.tsx")
core = read("scripts/validate-parent-core-journey.py")

for label in ["Home", "Children", "Schoolwork", "Progress", "Messages"]:
    checks.append((f'label: "{label}"' in layout, f"primary navigation exposes {label}"))

checks += [
    ('href: "/parent/inbox"' in layout, "canonical messages destination is Parent Inbox"),
    ('router.push("/parent/messages")' not in layout, "top-level navigation does not bypass Parent Inbox"),
    ('aria-current={isActive ? "page" : undefined}' in layout, "bottom navigation exposes active-page semantics"),
    ('width: 44, height: 44' in layout, "primary header controls keep 44px mobile tap targets"),
    ("router.replace('/parent/inbox')" in connect, "legacy Connect route converges on canonical inbox"),

    ('countableAttendance = attendance.filter' in home and 'row.status === "absent"' in home, "Parent Home attendance denominator uses explicit states"),
    ('attended = countableAttendance.filter' in home and 'row.status === "late"' in home, "Parent Home counts present and late as attended"),
    ('attendancePct: countableAttendance.length ?' in home, "Parent Home preserves no-record state separately from 0 percent"),
    ('Needs attention' in home and 'Your children' in home, "Parent Home prioritizes attention before family history"),
    ('No verified child is linked yet' in home and 'router.push("/parent/link-child")' in home, "Parent Home no-child state uses verified linking"),
    ('timeZone: "Africa/Nairobi"' in home, "Parent Home uses Kenya-local school date"),

    ('attendanceRecords === 0 || child.attendancePct === null' in children, "missing attendance is explicit"),
    ('does not mean the learner was absent' in children, "missing attendance is never presented as absence"),
    ('countedRows = rows.filter' in children and 'row.status === "absent"' in children, "children attendance rate uses explicit countable states"),
    ('attendancePct: countedRows.length ?' in children, "zero percent remains a real recorded value"),
    ('Excused records are not treated as absence.' in children, "children attendance excludes excused records from absence semantics"),
    ('Link or request access' in children, "no-child state uses verified relationship flow"),
    ('Add Child to Class' not in children and '+ Add Child' not in children, "children page does not imply arbitrary learner creation"),
    ('router.push("/parent/profile")' in children, "children settings entry resolves to a real account surface"),

    ('timeZone: "Africa/Nairobi"' in child, "child attendance uses Kenya-local school date"),
    ('countedRows = termRows.filter' in child and 'row.status === "absent"' in child, "child attendance rate has explicit denominator"),
    ('Excused records are not counted as absence.' in child, "child attendance explanation protects excused status"),
    ('This does not mean {firstName} was absent.' in child, "today missing attendance is explicitly non-absence"),
    ('router.push(`/parent/child/${child.id}/homework`)' in child, "child overview keeps homework child-scoped"),
    ('router.push(`/parent/child/${child.id}/messages`)' in child, "child overview keeps messages child-scoped"),

    ('submissionStatus === "submitted"' in homework, "submitted homework has explicit family-facing state"),
    ('info.label === "Overdue" || info.label === "Due soon"' in homework, "homework prioritizes tasks needing attention"),
    ('No submitted work is recorded and the due date has passed.' in homework, "overdue means no submission, not merely past due date"),
    ('requestVersion.current' in homework and 'setItems([])' in homework, "homework fails closed across child-context changes"),

    ('parent_student_links' in messages and 'teacher_classes' in messages, "messaging constrains child and staff context before conversation"),
    ('sendInFlight.current' in messages and 'if (!activeThreadId || !messageBody.trim() || sendInFlight.current) return' in messages, "messaging has explicit duplicate-send guard"),
    ('Your message was not confirmed as sent. It remains in the box so you can retry safely.' in messages, "messaging does not falsely confirm failed sends"),
    ('rpcError?.message' not in messages and 'cause instanceof Error ? cause.message' not in messages, "messaging does not render raw RPC/database errors"),
    ('Message sent.' in messages, "messaging confirms backend-successful send"),

    ('setState(EMPTY)' in learn and 'requestVersion.current' in learn, "Schoolwork clears sibling state before child loads"),
    ('aria-pressed={child.id === activeChildId}' in learn, "Schoolwork child switcher exposes selected state"),

    ('aria-label="Choose child for results"' in results, "Results exposes a multiple-child switcher"),
    ('setSummary(null)' in results and 'requestVersion.current' in results, "Results clears prior sibling data before switching"),
    ('getParentAssessmentSummary' in results, "Results remains on governed assessment summary boundary"),
    ('Draft or unreleased marks are not shown.' in results, "Results explains publication boundary"),
    ('Missing results do not mean low performance.' in results, "Results empty state avoids false performance inference"),

    ('Action needed' in inbox and 'Child updates' in inbox and 'School notices' in inbox, "family inbox groups notifications by usefulness"),
    ('Needs your confirmation' in inbox and 'ACK REQUIRED' not in inbox, "family inbox uses plain-language acknowledgement copy"),
    ('href.startsWith("/parent")' in inbox and 'href.startsWith("//")' in inbox, "notification deep links are constrained to Parent routes"),
    ('aria-pressed={filter === "unread"}' in inbox, "inbox filters expose selected state"),
    ('childName ? `${childName} · `' in inbox, "child-scoped notifications visibly identify the learner"),

    ('pretend switches are displayed' in profile.lower(), "profile explicitly withholds fake notification preferences"),
    ('Verified family relationship' in profile and 'Relationship: ${child.relationship}' not in profile, "profile humanizes active family relationship state"),
    ('router.push("/parent/link-child")' in profile, "profile linking uses verified relationship route"),
    ('router.push("/parent/support")' in profile, "profile exposes Report a Problem"),
    ('parent_student_links' in profile, "profile linked-child list derives from relationship authority"),
    ('Do not send passwords, PINs' in support, "support copy warns against sensitive-data disclosure"),
    ('Role: parent' in support, "support context is role-scoped"),
    ('replace(/\\/parent\\/child\\/[^/]+/g' in support, "support source screen redacts linked-child route identifiers"),
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
