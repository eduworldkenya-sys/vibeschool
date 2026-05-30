const fs = require('fs')

let code = fs.readFileSync('app/parent/learn/page.tsx', 'utf8')

// Fix 1: add body to lesson_plans select + status filter
code = code.replace(
  `.from("lesson_plans")
            .select("id, title, subject_id, day_of_week")
            .eq("class_id", classId)
            .order("day_of_week", { ascending: true }),`,
  `.from("lesson_plans")
            .select("id, title, subject_id, day_of_week, body")
            .eq("class_id", classId)
            .eq("status", "published")
            .order("day_of_week", { ascending: true }),`
)

// Fix 2: replace lesson_content block — read body directly instead
code = code.replace(
  `        const planIds = (plansRes.data ?? []).map(p => p.id);
        const contentMap = new Map<string, string>();
        
        if (planIds.length > 0) {
          const { data: content, error: contentError } = await supabase
            .from("lesson_content")
            .select("lesson_plan_id, student_copy")
            .in("lesson_plan_id", planIds);
                                                                        if (contentError) throw new Error(contentError.message);
          (content ?? []).forEach(c =>
            contentMap.set(c.lesson_plan_id, c.student_copy)
          );
        }`,
  `        // Read student summary directly from lesson_plans.body
        const contentMap = new Map<string, string>()
        ;(plansRes.data ?? []).forEach((p: any) => {
          if (p.body) {
            // extract objectives + development as parent-readable summary
            const obj = p.body.match(/<objectives>([\s\S]*?)<\/objectives>/)
            const dev = p.body.match(/<development>([\s\S]*?)<\/development>/)
            const summary = [
              obj ? 'What we learned:\n' + obj[1].trim() : '',
              dev ? '\nClassroom activity:\n' + dev[1].trim().slice(0, 300) + '...' : '',
            ].filter(Boolean).join('\n')
            contentMap.set(p.id, summary)
          }
        })`
)

// Fix 3: update LessonItem interface — student_copy is still the field name, no change needed
// Fix 4: update finalLessons — remove contentMap.has filter so published plans always show
code = code.replace(
  `        const finalLessons: LessonItem[] = [
          ...(plansRes.data ?? [])
            .filter(p => contentMap.has(p.id))
            .map(p => ({                                                    id:           p.id,
              title:        p.title,                                        subject:      subjectMap.get(p.subject_id) ?? "Lesson",
              day_of_week:  p.day_of_week,                                  student_copy: contentMap.get(p.id)!,                        })),                                                      ];`,
  `        const finalLessons: LessonItem[] = (plansRes.data ?? []).map((p: any) => ({
          id:           p.id,
          title:        p.title,
          subject:      subjectMap.get(p.subject_id) ?? 'Lesson',
          day_of_week:  p.day_of_week,
          student_copy: contentMap.get(p.id) ?? '',
        }))`
)

fs.writeFileSync('app/parent/learn/page.tsx', code)
console.log('fix-parent-learn: done — status filter + body reader applied')
