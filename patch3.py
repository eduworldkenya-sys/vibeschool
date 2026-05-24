f = 'app/teacher/page.tsx'
c = open(f).read()

import re

def replace_quick_actions(text):
    pattern = r'const QUICK_ACTIONS = \[(.*?)\]'
    def replacer(m):
        block = m.group(1)
        block = block.replace("route: '/teacher/classhub'",   "base: '/teacher/classhub',   useClass: false")
        block = block.replace("route: '/teacher/timetable'",  "base: '/teacher/timetable',  useClass: true ")
        block = block.replace("route: '/teacher/lessonplan'", "base: '/teacher/lessonplan', useClass: true ")
        block = block.replace("route: '/teacher/attendance'", "base: '/teacher/attendance', useClass: true ")
        block = block.replace("route: '/teacher/subjecthub'", "base: '/teacher/subjecthub', useClass: false")
        block = block.replace("route: '/teacher/results'",    "base: '/teacher/results',    useClass: true ")
        block = block.replace("route: '/teacher/assessment'", "base: '/teacher/assessment', useClass: true ")
        block = block.replace("route: '/teacher/schoolhub'",  "base: '/teacher/schoolhub',  useClass: false")
        return 'const QUICK_ACTION_DEFS = [' + block + ']'
    new_text, count = re.subn(pattern, replacer, text, flags=re.DOTALL)
    print('replacements:', count)
    return new_text

c = replace_quick_actions(c)
open(f, 'w').write(c)
print('done')
