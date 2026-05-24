f='app/teacher/lessonplan/page.tsx'
c=open(f).read()
old='  const dow        = new Date().getDay()'
new='  const rawDow     = new Date().getDay()\n  const dow         = rawDow === 0 || rawDow === 6 ? 1 : rawDow'
print('found' if old in c else 'NOT FOUND')
open(f,'w').write(c.replace(old, new))
print('done')
