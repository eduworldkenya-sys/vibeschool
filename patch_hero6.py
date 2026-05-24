import re
f = 'app/teacher/page.tsx'
c = open(f).read()

old = """          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[
              { label: 'Lessons Today', value: data.lessonsToday },
              { label: 'Flags',         value: data.unreadFlags  },
              { label: 'Attendance',    value: `${data.attendancePct}%` },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>"""

print('found' if old in c else 'NOT FOUND')
