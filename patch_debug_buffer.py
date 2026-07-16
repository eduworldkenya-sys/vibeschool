import sys
path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"
with open(path, "r") as f:
    content = f.read()
count = content.count("t.slice(-9)")
if count == 0:
    print("ERROR: no t.slice(-9) found — paste me a grep of 'setDebugTrace' instead.")
    sys.exit(1)
content = content.replace("t.slice(-9)", "t.slice(-39)")
with open(path, "w") as f:
    f.write(content)
print(f"Patched {count} occurrence(s) — buffer bumped to 40 entries.")
