import sys
path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"
with open(path, "r") as f:
    content = f.read()

old = "  const [fetching,         setFetching]         = useState(false)\n  const [fetchError,       setFetchError]       = useState<string | null>(null)"
new = "  const [fetching,         setFetching]         = useState(false)\n  const [fetchError,       setFetchError]       = useState<string | null>(null)\n  const [debugTrace,       setDebugTrace]       = useState<string[]>([])"

count = content.count(old)
if count != 1:
    print(f"ERROR: expected 1 match, found {count}.")
    sys.exit(1)

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)
print("debugTrace state added — build should pass now.")
