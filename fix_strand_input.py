path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"

with open(path, "r") as f:
    content = f.read()

old1 = """                          border:       `1.5px solid ${C.border2}`,
                          fontSize:     13,
                          fontFamily:   'inherit',
                          outline:      'none',
                        }}
                      />
                      <input
                        value={newSubStrand}"""

new1 = """                          border:       `1.5px solid ${C.border2}`,
                          fontSize:     13,
                          fontFamily:   'inherit',
                          outline:      'none',
                          color:        C.text,
                          background:   '#ffffff',
                        }}
                      />
                      <input
                        value={newSubStrand}"""

old2 = """                          border:       `1.5px solid ${C.border2}`,
                          fontSize:     13,
                          fontFamily:   'inherit',
                          outline:      'none',
                        }}
                      />
                    </div>
                  ) : ("""

new2 = """                          border:       `1.5px solid ${C.border2}`,
                          fontSize:     13,
                          fontFamily:   'inherit',
                          outline:      'none',
                          color:        C.text,
                          background:   '#ffffff',
                        }}
                      />
                    </div>
                  ) : ("""

assert content.count(old1) == 1, f"old1 match count: {content.count(old1)}"
assert content.count(old2) == 1, f"old2 match count: {content.count(old2)}"

content = content.replace(old1, new1)
content = content.replace(old2, new2)

with open(path, "w") as f:
    f.write(content)

print("Patched both strand inputs: added explicit color + background.")
