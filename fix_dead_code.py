path = '/data/data/com.termux/files/home/vibeschool/app/api/generate-scheme/route.ts'
with open(path, 'w') as f:
    f.write("import { NextResponse } from 'next/server'\nexport async function POST() {\n  return NextResponse.json({ error: 'Deprecated' }, { status: 410 })\n}\n")
print("generate-scheme: deprecated")

path2 = '/data/data/com.termux/files/home/vibeschool/app/admin/academics/curriculum/page.tsx'
with open(path2, 'r') as f:
    src = f.read()
old = "desc={`Week ${week} hasn't been set up for ${subject}. Add strands or copy from a previous week.`}"
new = "desc={`No CBC curriculum data found for ${subject} in Week ${week}. Ensure curriculum is seeded for this grade.`}"
if old in src:
    src = src.replace(old, new)
    with open(path2, 'w') as f:
        f.write(src)
    print("admin curriculum: empty state updated")
else:
    print("admin curriculum: NOT FOUND")
print("dead_code: Done")
