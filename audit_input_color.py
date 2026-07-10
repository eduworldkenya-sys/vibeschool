import re
import os

root = "/data/data/com.termux/files/home/vibeschool/app"
results = []

for dirpath, _, filenames in os.walk(root):
    for fname in filenames:
        if not fname.endswith((".tsx", ".ts")):
            continue
        fpath = os.path.join(dirpath, fname)
        with open(fpath, "r", errors="ignore") as f:
            lines = f.readlines()

        for i, line in enumerate(lines):
            if re.search(r"<(input|textarea)\b", line):
                # scan forward up to 20 lines for the style={{ ... }} block close
                block = lines[i:i+20]
                block_text = "".join(block)
                style_match = re.search(r"style=\{\{(.*?)\}\}", block_text, re.DOTALL)
                if style_match:
                    style_block = style_match.group(1)
                    has_color = re.search(r"\bcolor\s*:", style_block)
                    if not has_color:
                        results.append((fpath.replace(root, "app"), i + 1))
                else:
                    # input with no inline style at all — relies entirely on inherited/global styles
                    results.append((fpath.replace(root, "app"), i + 1, "no inline style"))

print(f"Found {len(results)} <input>/<textarea> tags with no explicit color:\n")
for r in results:
    if len(r) == 3:
        print(f"  {r[0]}:{r[1]}  ({r[2]})")
    else:
        print(f"  {r[0]}:{r[1]}")
