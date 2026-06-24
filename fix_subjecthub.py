import re

path = 'app/teacher/subjecthub/page.tsx'
with open(path, 'r') as f:
    src = f.read()

src = src.replace(
    "import { Card, SectionLabel, Btn, C, ReadinessChip } from '@/components/teacher/ui'",
    "import { Card, C } from '@/components/teacher/ui'"
)

old_classes_fetch = """    // Load classes for add-subject modal (best-effort, MVP)
    const clQuery = supabase.from('classes').select('id,name,stream,school_id')
    const { data: clData } = await clQuery.eq('teacher_id', user.id)
    setAllClasses(clData ?? [])"""

new_classes_fetch = """    // Load classes for add-subject modal via teacher_classes join
    const { data: tcClassData } = await supabase
      .from('teacher_classes')
      .select('class_id, classes(id, name, stream, school_id)')
      .eq('teacher_id', user.id)
    const seenIds = new Set<string>()
    const clData = (tcClassData ?? [])
      .map((r: { classes: { id: string; name: string; stream: string | null; school_id: string | null } | null }) => r.classes)
      .filter((c): c is { id: string; name: string; stream: string | null; school_id: string | null } => {
        if (!c || seenIds.has(c.id)) return false
        seenIds.add(c.id)
        return true
      })
    setAllClasses(clData)"""

src = src.replace(old_classes_fetch, new_classes_fetch)

old_att = "      supabase.from('attendance').select('id, date').eq('teacher_id', currentId).gte('date', weekAgo),"
new_att = "      supabase.from('attendance').select('id, date').eq('teacher_id', currentId).eq('subject_id', subjectId).gte('date', weekAgo),"
src = src.replace(old_att, new_att)

old_claude = """    // Daily fact + AI suggestion via Claude
    const subjectName = activeSubject?.name ?? 'your subject'
    try {
      const [factRes, suggRes] = await Promise.all([
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: `Give me one powerful, surprising, globally relevant fact about ${subjectName} that would make a teacher feel proud and inspired to teach it. Maximum 2 sentences. No preamble. Just the fact.` }]
          })
        }),
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: `You are a professional teaching coach. A teacher teaches ${subjectName}. They have created ${lCount} lesson plans, assessed ${aCount} students, marked attendance ${atCount} times, and published ${rCount} resources this term. Give them ONE specific, actionable, encouraging suggestion to grow professionally. Reference global teaching research or global statistics. Maximum 2 sentences. Make them feel like a world-class professional. No preamble.` }]
          })
        })
      ])

      const factData = await factRes.json()
      const suggData = await suggRes.json()
      setDailyFact(factData.content?.[0]?.text ?? null)
      setAiSuggestion(suggData.content?.[0]?.text ?? null)
    } catch {
      setDailyFact(null)
      setAiSuggestion(null)
    }"""

new_claude = """    // Daily fact + AI suggestion via secure API route
    const subjectName = activeSubject?.name ?? 'your subject'
    try {
      const insightRes = await fetch('/api/subject-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectName, lCount, aCount, atCount, rCount }),
      })
      if (insightRes.ok) {
        const { fact, suggestion } = await insightRes.json()
        setDailyFact(fact ?? null)
        setAiSuggestion(suggestion ?? null)
      } else {
        setDailyFact(null)
        setAiSuggestion(null)
      }
    } catch {
      setDailyFact(null)
      setAiSuggestion(null)
    }"""

src = src.replace(old_claude, new_claude)

with open(path, 'w') as f:
    f.write(src)
print("✅ subjecthub/page.tsx fixed")
