import sys

path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"

with open(path, "r") as f:
    content = f.read()

old = "const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)"
new = """const __rawLabel = selectedSubjectObj.label
      if (typeof window !== 'undefined') {
        console.log('EBOOK_DEBUG subjectLabel=', JSON.stringify(__rawLabel))
      }
      const globalSubjectId = await resolveGlobalSubjectId(__rawLabel)
      if (typeof window !== 'undefined') {
        console.log('EBOOK_DEBUG globalSubjectId=', globalSubjectId)
      }"""

count = content.count(old)
if count != 1:
    print(f"ERROR: expected 1 match, found {count}. Paste me the current line around resolveGlobalSubjectId instead.")
    sys.exit(1)

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)

print("Patched — reload the page, then check the console for EBOOK_DEBUG lines.")
