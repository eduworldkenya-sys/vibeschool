path = '/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx'
with open(path, 'r') as f:
    src = f.read()

# 1. Add onGenerate prop to StrandCard
src = src.replace(
    """function StrandCard({
  strand, status, isSaving, onUpdate
}: {
  strand:   Strand
  status:   string
  isSaving: boolean
  onUpdate: (strandId: string, status: string) => void
})""",
    """function StrandCard({
  strand, status, isSaving, onUpdate, onGenerate
}: {
  strand:     Strand
  status:     string
  isSaving:   boolean
  onUpdate:   (strandId: string, status: string) => void
  onGenerate: () => void
})"""
)

# 2. Add Generate Plan button inside StrandCard after the status buttons div
src = src.replace(
    """        </div>
      </div>
    </div>
  )
}

// ── CHIP""",
    """        </div>
        <button
          onClick={onGenerate}
          style={{
            marginTop:    8,
            width:        '100%',
            padding:      '7px',
            background:   'linear-gradient(135deg, #4f46e5, #6366f1)',
            color:        '#fff',
            border:       'none',
            borderRadius: 8,
            fontSize:     11,
            fontWeight:   700,
            cursor:       'pointer',
            fontFamily:   'inherit',
            letterSpacing: 0.3,
          }}
        >✨ Generate Lesson Plan</button>
      </div>
    </div>
  )
}

// ── CHIP"""
)

# 3. Add useRouter import
src = src.replace(
    "import { useSearchParams } from 'next/navigation'",
    "import { useSearchParams, useRouter } from 'next/navigation'"
)

# 4. Add useRouter hook after useState declarations
src = src.replace(
    "  const [uid,           setUid]           = useState<string | null>(null)",
    "  const router = useRouter()\n  const [uid,           setUid]           = useState<string | null>(null)"
)

# 5. Add handleGenerate function before the return statement
src = src.replace(
    "  // ── Render ────────────────────────────────────────────────",
    """  function handleGenerate(strand: Strand) {
    const cls  = classes.find(c => c.id === selectedClass)
    const subj = subjects.find(s => s.id === selectedSubject)
    if (!cls || !subj || !selectedClass || !selectedSubject) return
    const params = new URLSearchParams({
      classId:    selectedClass,
      subjectId:  selectedSubject,
      grade:      cls.grade,
      subject:    subj.label,
      strand:     strand.name,
      subStrand:  strand.sub_strand ?? '',
      topic:      strand.topic ?? '',
      week:       String(selectedWeek),
      term:       String(selectedTerm),
    })
    router.push(`/teacher/scheme/generate?${params.toString()}`)
  }

  // ── Render ────────────────────────────────────────────────"""
)

# 6. Pass onGenerate to StrandCard at call site
src = src.replace(
    """                  <StrandCard
                    key={strand.id}
                    strand={strand}
                    status={getStatus(strand.id)}
                    isSaving={saving === strand.id}
                    onUpdate={updateStatus}
                  />""",
    """                  <StrandCard
                    key={strand.id}
                    strand={strand}
                    status={getStatus(strand.id)}
                    isSaving={saving === strand.id}
                    onUpdate={updateStatus}
                    onGenerate={() => handleGenerate(strand)}
                  />"""
)

with open(path, 'w') as f:
    f.write(src)

print("Done")
