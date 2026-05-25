path = 'app/teacher/attendance/page.tsx'
with open(path) as f:
    src = f.read()

old = """  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const urlClassId   = searchParams.get('classId')"""

new = """  const router       = useRouter()
  const searchParams = useSearchParams()
  const urlClassId   = searchParams.get('classId')
  const urlDate      = searchParams.get('date')
  const today        = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(urlDate ?? today)"""

assert old in src, 'BLOCK NOT FOUND'
src = src.replace(old, new, 1)

with open(path, 'w') as f:
    f.write(src)
print('Done: attendance/page.tsx patched')
