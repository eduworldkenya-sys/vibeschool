fixes = [
    (
        '/data/data/com.termux/files/home/vibeschool/app/teacher/assessment/page.tsx',
        "    const uniqueStrands = []",
        "    const uniqueStrands: StrandOption[] = []"
    ),
    (
        '/data/data/com.termux/files/home/vibeschool/app/admin/academics/gradebook/page.tsx',
        "        const unique = []",
        "        const unique: StrandRow[] = []"
    ),
]

for fpath, old, new in fixes:
    with open(fpath, 'r') as f:
        src = f.read()
    if old in src:
        src = src.replace(old, new)
        with open(fpath, 'w') as f:
            f.write(src)
        print('Fixed: ' + fpath.split('/')[-1])
    else:
        print('NOT FOUND: ' + fpath.split('/')[-1])
