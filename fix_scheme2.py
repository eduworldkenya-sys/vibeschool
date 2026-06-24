path = '/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx'
with open(path, 'r') as f:
    src = f.read()

# 1. Add selectedWeek to useCallback deps
src = src.replace(
    "  }, [selectedSubject, selectedClass, selectedTerm, schoolId, uid])",
    "  }, [selectedSubject, selectedClass, selectedTerm, selectedWeek, schoolId, uid])"
)

# 2. Replace the single useEffect with two — one for boot, one for week/term changes
src = src.replace(
    "  useEffect(() => {\n    if (!loading) loadStrands()\n  }, [loading, loadStrands])",
    """  useEffect(() => {
    if (!loading) loadStrands()
  }, [loading, loadStrands])

  useEffect(() => {
    if (!loading && selectedClass && selectedSubject) loadStrands()
  }, [selectedWeek, selectedTerm])"""
)

with open(path, 'w') as f:
    f.write(src)

print("Done")
