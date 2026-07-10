path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"

with open(path, "r") as f:
    content = f.read()

old = """                        placeholder="Strand name, e.g. Numbers"
                        style={{
                          padding:      '9px 12px',
                          borderRadius: 10,
                          border:       `1.5px solid ${C.border2}`,
                          fontSize:     13,
                          fontFamily:   'inherit',
                          outline:      'none',
                        }}
                      />
                      <input
                        value={newSubStrand}"""

new = """                        placeholder="Strand name, e.g. Numbers"
                        style={{
                          padding:      '9px 12px',
                          borderRadius: 10,
                          border:       `1.5px solid ${C.border2}`,
                          fontSize:     13,
                          fontFamily:   'inherit',
                          outline:      'none',
                          color:        C.text,
                          background:   '#ffffff',
                        }}
                      />
                      <input
                        value={newSubStrand}"""

assert content.count(old) == 1, f"match count: {content.count(old)}"
content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)

print("Patched strand-name input: added explicit color + background.")
