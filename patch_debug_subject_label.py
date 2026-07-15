import sys
path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"
with open(path, "r") as f:
    content = f.read()

old = """      const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)
      setDebugTrace(t => [...t.slice(-9), `req#${requestId} globalSubjectId=${globalSubjectId ?? 'NULL'}`])"""

new = """      setDebugTrace(t => [...t.slice(-9), `req#${requestId} subjectLabel=${JSON.stringify(selectedSubjectObj.label)} grade=${JSON.stringify(selectedClassObj.grade)}`])
      const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)
      setDebugTrace(t => [...t.slice(-9), `req#${requestId} globalSubjectId=${globalSubjectId ?? 'NULL'}`])"""

count = content.count(old)
if count != 1:
    print(f"ERROR: expected 1 match, found {count}. Aborting.")
    sys.exit(1)

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)
print("subject-label trace added successfully.")
