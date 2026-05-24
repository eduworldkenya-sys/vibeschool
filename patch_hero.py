f = 'app/teacher/page.tsx'
c = open(f).read()

# 1. Add className and classSubject to DashboardData interface
old = '''interface DashboardData {
  fullName:      string
  initials:      string
  school:        string
  lessonsToday:  number
  unreadFlags:   number
  attendancePct: number
  nextLesson:    Slot | null
  currentLesson: Slot | null
  flags:         Flag[]
  slots:         Slot[]
}'''
new = '''interface DashboardData {
  fullName:      string
  initials:      string
  school:        string
  lessonsToday:  number
  unreadFlags:   number
  attendancePct: number
  studentCount:  number
  className:     string
  classSubject:  string
  nextLesson:    Slot | null
  currentLesson: Slot | null
  flags:         Flag[]
  slots:         Slot[]
}'''
print('1:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

# 2. Fetch class name and subject alongside other queries
old = '''      const [schoolRes, attBatchRes, studentCountRes, attTodayRes] = await Promise.all([
        schoolId
          ? supabase.from('schools').select('name').eq('id', schoolId).single()
          : Promise.resolve({ data: null }),'''
new = '''      const [schoolRes, attBatchRes, studentCountRes, attTodayRes, classInfoRes] = await Promise.all([
        schoolId
          ? supabase.from('schools').select('name').eq('id', schoolId).single()
          : Promise.resolve({ data: null }),'''
print('2:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

# 3. Add classInfoRes query at end of Promise.all
old = '''        classTeacherId
          ? supabase.from('attendance').select('status').eq('class_id', classTeacherId).eq('date', today)
          : Promise.resolve({ data: [] }),
      ])'''
new = '''        classTeacherId
          ? supabase.from('attendance').select('status').eq('class_id', classTeacherId).eq('date', today)
          : Promise.resolve({ data: [] }),
        classTeacherId
          ? supabase.from('classes').select('name, stream, subject').eq('id', classTeacherId).single()
          : Promise.resolve({ data: null }),
      ])'''
print('3:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

# 4. Extract className and classSubject from classInfoRes
old = '''      const total         = studentCountRes.count ?? 0'''
new = '''      const classInfo    = (classInfoRes as { data: { name: string; stream: string | null; subject: string } | null }).data
      const className    = classInfo ? classInfo.name + (classInfo.stream ? ` ${classInfo.stream}` : '') : ''
      const classSubject = classInfo?.subject ?? ''
      const total         = studentCountRes.count ?? 0'''
print('4:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

# 5. Add to setData
old = '''      setData({
        fullName, initials,
        school:        (schoolRes.data as { name: string } | null)?.name ?? '',
        lessonsToday:  mappedSlots.length,
        unreadFlags:   0,
        attendancePct,
        nextLesson,
        currentLesson,
        flags:         [],
        slots:         mappedSlots,
      })'''
new = '''      setData({
        fullName, initials,
        school:        (schoolRes.data as { name: string } | null)?.name ?? '',
        lessonsToday:  mappedSlots.length,
        unreadFlags:   0,
        attendancePct,
        studentCount:  total,
        className,
        classSubject,
        nextLesson,
        currentLesson,
        flags:         [],
        slots:         mappedSlots,
      })'''
print('5:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

# 6. Update hero UI to show class info like ClassHub
old = '''      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 1 }}>
            {greeting()}, {firstName} 👋
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{data.school}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[
              { label: 'Lessons Today', value: data.lessonsToday },
              { label: 'Flags',         value: data.unreadFlags  },
              { label: 'Attendance',    value: `${data.attendancePct}%` },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}'''
new = '''      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 1 }}>
            {greeting()}, {firstName} 👋
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{data.school}</div>
          {data.className && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 20 }}>🏫</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{data.className}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{data.classSubject}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[
              { label: 'Students',    value: data.studentCount  },
              { label: 'Lessons',     value: data.lessonsToday  },
              { label: 'Attendance',  value: `${data.attendancePct}%` },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}'''
print('6:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

open(f, 'w').write(c)
print('done')
