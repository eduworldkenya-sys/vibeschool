path = '/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx'
with open(path, 'r') as f:
    src = f.read()

# 1. Add weekStrandCount to WeekGrid props
src = src.replace(
    """function WeekGrid({
  totalWks, currentWk, weekCoverage, selectedWeek, onSelect
}: {
  totalWks:     number
  currentWk:    number
  weekCoverage: Record<number, number>
  selectedWeek: number
  onSelect:     (w: number) => void
})""",
    """function WeekGrid({
  totalWks, currentWk, weekCoverage, weekStrandCount, selectedWeek, onSelect
}: {
  totalWks:        number
  currentWk:       number
  weekCoverage:    Record<number, number>
  weekStrandCount: Record<number, number>
  selectedWeek:    number
  onSelect:        (w: number) => void
})"""
)

# 2. Add count badge inside the dot, below the dot indicator
src = src.replace(
    """              }} />
          )
          })}""",
    """              }} />
              {(weekStrandCount[w] ?? 0) > 0 && (
                <div style={{
                  fontSize:   8,
                  fontWeight: 800,
                  color:      active ? C.indigo : C.text3,
                  lineHeight: 1,
                }}>{weekStrandCount[w]}</div>
              )}
          )
          })}"""
)

# 3. Compute weekStrandCount in the same useMemo as weekCoverage
src = src.replace(
    "  const weekCoverage = useMemo(() => {",
    "  const weekStrandCount = useMemo(() => {\n    const map: Record<number, number> = {}\n    if (!activeTerm || !selectedClass || !selectedSubject) return map\n    const cls  = classes.find(c => c.id === selectedClass)\n    const subj = subjects.find(s => s.id === selectedSubject)\n    if (!cls || !subj) return map\n    const totWks = totalWeeks(activeTerm)\n    for (let w = 1; w <= totWks; w++) {\n      map[w] = curriculum.filter(c =>\n        c.grade   === cls.grade &&\n        c.subject === subj.label &&\n        c.week    === w &&\n        c.term    === selectedTerm\n      ).length\n    }\n    return map\n  }, [activeTerm, selectedClass, selectedSubject, classes, subjects, curriculum, selectedTerm])\n\n  const weekCoverage = useMemo(() => {"
)

# 4. Pass weekStrandCount to WeekGrid
src = src.replace(
    """            <WeekGrid
              totalWks={totWks}
              currentWk={curWeek}
              weekCoverage={weekCoverage}
              selectedWeek={selectedWeek}
              onSelect={setSelectedWeek}
            />""",
    """            <WeekGrid
              totalWks={totWks}
              currentWk={curWeek}
              weekCoverage={weekCoverage}
              weekStrandCount={weekStrandCount}
              selectedWeek={selectedWeek}
              onSelect={setSelectedWeek}
            />"""
)

with open(path, 'w') as f:
    f.write(src)

print("Done")
