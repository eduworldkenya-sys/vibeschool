path = '/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx'
with open(path, 'r') as f:
    src = f.read()

old = "              }} />\n            </div>\n          )\n        })}"

new = """              }} />
              {(weekStrandCount[w] ?? 0) > 0 && (
                <div style={{
                  fontSize:   8,
                  fontWeight: 800,
                  color:      active ? C.indigo : C.text3,
                  lineHeight: 1,
                }}>{weekStrandCount[w]}</div>
              )}
            </div>
          )
        })}"""

if old in src:
    src = src.replace(old, new)
    print("Replaced OK")
else:
    print("NOT FOUND")

with open(path, 'w') as f:
    f.write(src)
