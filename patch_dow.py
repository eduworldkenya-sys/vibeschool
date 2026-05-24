f = 'app/teacher/page.tsx'
c = open(f).read()

# 1. Fix dow mapping for Sunday
old = "      const today = new Date().toISOString().split('T')[0]\n      const dow   = new Date().getDay()"
new = "      const today = new Date().toISOString().split('T')[0]\n      const rawDow = new Date().getDay()\n      const dow   = rawDow === 0 ? 7 : rawDow"
print('1:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

# 2. Add day_of_week to select
old = ".select(`id, start_time, end_time, room, subjects ( name ), classes ( name, stream )`)"
new = ".select(`id, day_of_week, start_time, end_time, room, subjects ( name ), classes ( name, stream )`)"
print('2:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

# 3. Fix lessonsToday to filter by today's dow
old = "        lessonsToday:  mappedSlots.length,"
new = "        lessonsToday:  mappedSlots.filter((_s, i) => (slotsRes.data?.[i] as { day_of_week?: number } | undefined)?.day_of_week === dow).length,"
print('3:', 'found' if old in c else 'NOT FOUND')
c = c.replace(old, new)

open(f, 'w').write(c)
print('done')
