import re

files = [
    "/data/data/com.termux/files/home/vibeschool/app/teacher/layout.tsx",
    "/data/data/com.termux/files/home/vibeschool/app/parent/layout.tsx",
]

teacher_old = """          <main style={{
            maxWidth:      768,
            margin:        "0 auto",
            padding:       "clamp(12px, 3vw, 20px) clamp(12px, 4vw, 20px) 0",
            paddingBottom: 160,
            minHeight:     "calc(100vh - 120px)",
          }}>"""

teacher_new = """          <main style={{
            maxWidth:      768,
            margin:        "0 auto",
            padding:       "clamp(12px, 3vw, 20px) clamp(12px, 4vw, 20px) 0",
            paddingBottom: 160,
            minHeight:     "calc(100vh - 120px)",
            color:         "#111827",
          }}>"""

parent_old = """      <main style={{ maxWidth: 768, margin: "0 auto", padding: "16px 16px 160px", background: "#f0f2f5" }}>"""
parent_new = """      <main style={{ maxWidth: 768, margin: "0 auto", padding: "16px 16px 160px", background: "#f0f2f5", color: "#111827" }}>"""

with open(files[0], "r") as f:
    tc = f.read()
assert tc.count(teacher_old) == 1, f"teacher match count: {tc.count(teacher_old)}"
tc = tc.replace(teacher_old, teacher_new)
with open(files[0], "w") as f:
    f.write(tc)
print("Patched teacher/layout.tsx")

with open(files[1], "r") as f:
    pc = f.read()
assert pc.count(parent_old) == 1, f"parent match count: {pc.count(parent_old)}"
pc = pc.replace(parent_old, parent_new)
with open(files[1], "w") as f:
    f.write(pc)
print("Patched parent/layout.tsx")
