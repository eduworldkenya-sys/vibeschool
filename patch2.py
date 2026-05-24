f = 'app/teacher/page.tsx'
c = open(f).read()

old = """const QUICK_ACTIONS = [
    { id: 'classhub',   label: 'ClassHub',     icon: '🏫', color: '#dbeafe', iconColor: '#1d4ed8', route: '/teacher/classhub'   },
    { id: 'timetable',  label: 'Timetable',    icon: '🗓️', color: C.accentLight, iconColor: '#065f46', route: '/teacher/timetable'  },
    { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', color: '#ede9fe', iconColor: '#6d28d9', route: '/teacher/lessonplan' },
    { id: 'attendance', label: 'Attendance',   icon: '✅', color: '#dcfce7', iconColor: '#166534', route: '/teacher/attendance' },
    { id: 'subjecthub', label: 'SubjectHub',   icon: '🔬', color: '#e0f2fe', iconColor: '#075985', route: '/teacher/subjecthub' },
    { id: 'results',    label: 'Results',      icon: '🏆', color: '#d1fae5', iconColor: '#065f46', route: '/teacher/results'   },
    { id: 'assessment', label: 'Assessment',   icon: '📊', color: '#fef3c7', iconColor: '#92400e', route: '/teacher/assessment' },
    { id: 'schoolhub',  label: 'SchoolHub',    icon: '🏛️', color: '#f3e8ff', iconColor: '#7e22ce', route: '/teacher/schoolhub'  },
  ]"""

new = """const QUICK_ACTION_DEFS = [
    { id: 'classhub',   label: 'ClassHub',     icon: '🏫', color: '#dbeafe', iconColor: '#1d4ed8', base: '/teacher/classhub',   useClass: false },
    { id: 'timetable',  label: 'Timetable',    icon: '🗓️', color: C.accentLight, iconColor: '#065f46', base: '/teacher/timetable',  useClass: true  },
    { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', color: '#ede9fe', iconColor: '#6d28d9', base: '/teacher/lessonplan', useClass: true  },
    { id: 'attendance', label: 'Attendance',   icon: '✅', color: '#dcfce7', iconColor: '#166534', base: '/teacher/attendance', useClass: true  },
    { id: 'subjecthub', label: 'SubjectHub',   icon: '🔬', color: '#e0f2fe', iconColor: '#075985', base: '/teacher/subjecthub', useClass: false },
    { id: 'results',    label: 'Results',      icon: '🏆', color: '#d1fae5', iconColor: '#065f46', base: '/teacher/results',    useClass: true  },
    { id: 'assessment', label: 'Assessment',   icon: '📊', color: '#fef3c7', iconColor: '#92400e', base: '/teacher/assessment', useClass: true  },
    { id: 'schoolhub',  label: 'SchoolHub',    icon: '🏛️', color: '#f3e8ff', iconColor: '#7e22ce', base: '/teacher/schoolhub',  useClass: false },
  ]"""

print('found' if old in c else 'NOT FOUND')
c = c.replace(old, new)
open(f, 'w').write(c)
print('done')
