f='app/teacher/lessonplan/page.tsx'
c=open(f).read()
old="                 .eq('day_of_week', dow)\n"
print('found' if old in c else 'NOT FOUND')
open(f,'w').write(c.replace(old, ''))
print('done')
