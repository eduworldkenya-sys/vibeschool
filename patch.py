f='app/teacher/lessonplan/page.tsx'
c=open(f).read()
old="      setItems(mapped)\n                                                           setLoading(false)"
new="      console.log('[LessonPlan] slots:', slotsRes.data, 'user:', user.id)\n      setItems(mapped)\n                                                           setLoading(false)"
print('found' if old in c else 'NOT FOUND')
open(f,'w').write(c.replace(old,new))
print('done')
