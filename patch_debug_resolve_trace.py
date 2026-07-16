import sys
path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace(
    "import { getContentForSubject, resolveGlobalSubjectId } from '@/lib/curriculum/globalSubjects'",
    "import { getContentForSubject, resolveGlobalSubjectId, lastResolveDebug } from '@/lib/curriculum/globalSubjects'",
    1
)

old = "      const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)\n      setDebugTrace(t => [...t.slice(-39), `req#${requestId} globalSubjectId=${globalSubjectId ?? 'NULL'}`])"
new = "      const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)\n      setDebugTrace(t => [...t.slice(-39), `req#${requestId} globalSubjectId=${globalSubjectId ?? 'NULL'}`, `req#${requestId} resolveDebug=${lastResolveDebug}`])"

count = content.count(old)
if count != 1:
    print(f"ERROR: expected 1 match, found {count}. Paste me the exact line around setDebugTrace/globalSubjectId instead.")
    sys.exit(1)

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)
print("Patched page.tsx")
