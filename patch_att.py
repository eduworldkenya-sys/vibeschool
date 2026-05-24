f = 'app/teacher/attendance/page.tsx'
c = open(f).read()

# When urlClassId is present and no slots found, still show the class
old = "  ) : slots.length === 0 ? (\n                <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>\n                  No classes scheduled today\n                </div>"
new = "  ) : slots.length === 0 ? (\n                <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>\n                  No classes scheduled today{urlClassId ? ' — try a different date or add a timetable slot' : ''}\n                </div>"
print('1:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

open(f, 'w').write(c)
print('done')
