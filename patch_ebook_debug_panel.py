import sys

path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"

with open(path, "r") as f:
    content = f.read()

old = """        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 5, lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
          {selectedTermObj ? `${termLabel(selectedTermObj)} · ${curWeek > 0 ? `Week ${curWeek} of ${totWks}` : `${totWks} weeks total`}` : "Track coverage across terms and weeks"}
        </div>"""

new = """        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 5, lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
          {selectedTermObj ? `${termLabel(selectedTermObj)} · ${curWeek > 0 ? `Week ${curWeek} of ${totWks}` : `${totWks} weeks total`}` : "Track coverage across terms and weeks"}
        </div>

        {debugTrace.length > 0 && (
          <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.3)', fontSize: 10, fontFamily: 'monospace', color: '#fef3c7', position: 'relative', zIndex: 1, lineHeight: 1.6 }}>
            {debugTrace.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}"""

count = content.count(old)
if count != 1:
    print(f"ERROR: expected 1 match, found {count}. Aborting.")
    sys.exit(1)

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)

print("Debug panel patch applied successfully.")
