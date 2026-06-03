import os

home = os.path.expanduser("~")
path = os.path.join(home, "vibeschool/app/parent/learn/performance/page.tsx")

with open(path, "r") as f:
    content = f.read()

old = """    let frameId1: number; // eslint-disable-line prefer-const
    let frameId2: number;

    frameId1 = requestAnimationFrame(() => {
      frameId2 = requestAnimationFrame(() => {"""

new = """    let frameId2: number;

    const frameId1 = requestAnimationFrame(() => {
      frameId2 = requestAnimationFrame(() => {"""

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)
print("Done")
