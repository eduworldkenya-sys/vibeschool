f='app/parent/learn/page.tsx'
c=open(f).read()

old='''        const finalLessons: LessonItem[] = (plansRes.data ?? [])
          .filter(p => contentMap.has(p.id))
          .map(p => ({
            id:          p.id,
            title:       p.title,
            subject:     subjectMap.get(p.subject_id) ?? "Lesson",
            day_of_week: p.day_of_week,
            student_copy: contentMap.get(p.id)!,
          }));'''

new='''        // Fetch published notes from teacher_content
        const { data: publishedNotes } = await supabase
          .from("teacher_content")
          .select("id, title, body, subject_id, published_at")
          .eq("class_id", classId)
          .eq("published", true)
          .order("published_at", { ascending: false });

        const publishedLessons: LessonItem[] = (publishedNotes ?? []).map(n => ({
          id:           n.id,
          title:        n.title ?? "Lesson Notes",
          subject:      subjectMap.get(n.subject_id) ?? "Lesson",
          day_of_week:  new Date(n.published_at).getDay(),
          student_copy: n.body ?? "",
        }));

        const finalLessons: LessonItem[] = [
          ...(plansRes.data ?? [])
            .filter(p => contentMap.has(p.id))
            .map(p => ({
              id:           p.id,
              title:        p.title,
              subject:      subjectMap.get(p.subject_id) ?? "Lesson",
              day_of_week:  p.day_of_week,
              student_copy: contentMap.get(p.id)!,
            })),
          ...publishedLessons,
        ];'''

print('found' if old in c else 'NOT FOUND')
open(f,'w').write(c.replace(old, new))
print('done')
