PATH = "app/teacher/layout.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

OLD_1 = "function IconScheme({ size = 22 }: { size?: number }) {"

NEW_1 = '''function IconWeek({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="7" y1="14" x2="7" y2="14.01"/>
      <line x1="12" y1="14" x2="12" y2="14.01"/>
      <line x1="17" y1="14" x2="17" y2="14.01"/>
    </svg>
  )
}
function IconScheme({ size = 22 }: { size?: number }) {'''

assert OLD_1 in src, "Patch 1 anchor not found."
assert src.count(OLD_1) == 1, "Patch 1 anchor not unique."
src = src.replace(OLD_1, NEW_1, 1)

OLD_2 = '''    { label: "Today",       icon: <IconPulse      size={24} />, href: "/teacher/teach-today"       },
    { label: "SubjectHub",  icon: <IconSubjectHub size={24} />, href: "/teacher/subjecthub"        },'''

NEW_2 = '''    { label: "Today",       icon: <IconPulse      size={24} />, href: "/teacher/teach-today"       },
    { label: "Week",        icon: <IconWeek       size={24} />, href: "/teacher/week"              },
    { label: "SubjectHub",  icon: <IconSubjectHub size={24} />, href: "/teacher/subjecthub"        },'''

assert OLD_2 in src, "Patch 2 anchor not found."
assert src.count(OLD_2) == 1, "Patch 2 anchor not unique."
src = src.replace(OLD_2, NEW_2, 1)

def balance(s):
    return (s.count("(") - s.count(")"), s.count("{") - s.count("}"), s.count("[") - s.count("]"))

with open(PATH, "r", encoding="utf-8") as f:
    original = f.read()

if balance(original) != balance(src):
    raise SystemExit("Balance check FAILED. Aborting write.")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

print("Patched app/teacher/layout.tsx — Week tile added. Balance OK.")
