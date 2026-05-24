f='app/parent/learn/page.tsx'
c=open(f).read()
old='maxMarks:  r.exam_subject_config?.max_marks ?? 100,'
new='maxMarks:  100,'
print('found' if old in c else 'NOT FOUND')
c=c.replace(old,new)
open(f,'w').write(c)
print('done')
