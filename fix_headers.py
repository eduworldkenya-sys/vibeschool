files = [
    'components/teacher/SmartInsightSlides.tsx',
    'components/teacher/SmartTimetablePreview.tsx',
]
for path in files:
    with open(path, 'r') as f:
        lines = f.readlines()
    lines = [l for l in lines if 'nairobiDateStr' not in l and 'use client' not in l]
    lines = ['"use client";\n', "import { nairobiDateStr } from '@/lib/time'\n"] + lines
    with open(path, 'w') as f:
        f.writelines(lines)
    print('✅ ' + path)
