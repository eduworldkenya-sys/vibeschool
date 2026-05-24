f='app/teacher/lessonplan/page.tsx'
lines = open(f).readlines()
publish = '''                {plan && (
                  <Btn small onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    await supabase.from('teacher_content').insert({
                      teacher_id:   user.id,
                      class_id:     slot.class_id,
                      subject_id:   slot.subject_id,
                      type:         'notes',
                      title:        plan.title,
                      body:         plan.body,
                      published:    true,
                      published_at: new Date().toISOString(),
                    })
                  }}>📤 Publish</Btn>
                )}
'''
lines.insert(242, publish)
open(f,'w').writelines(lines)
print('done')
