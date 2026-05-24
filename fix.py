filepath = "app/teacher/classhub/[id]/page.tsx"

with open(filepath, "r") as f:
    content = f.read()

# Wrap siblings in a fragment
old = "return (\n    <Suspense fallback={"
new = "return (\n    <>\n    <Suspense fallback={"
content = content.replace(old, new, 1)

# Find </Suspense> and add closing fragment after the entire modal block
# The return statement ends with );  we add </> before the last );
last = content.rfind("\n    );")
content = content[:last] + "\n    </>\n    );" + content[last+7:]

with open(filepath, "w") as f:
    f.write(content)

print("Fixed! Verifying..."filepath = "app/teacher/classhub/[id]/page.tsx"

with open(filepath, "r") as f:
    content = f.read()

# Wrap siblings in a fragment
old = "return (\n    <Suspense fallback={"
new = "return (\n    <>\n    <Suspense fallback={"
content = content.replace(old, new, 1)

# Find </Suspense> and add closing fragment after the entire modal block
# The return statement ends with );  we add </> before the last );
last = content.rfind("\n    );")
content = content[:last] + "\n    </>\n    );" + content[last+7:]

with open(filepath, "w") as f:
    f.write(content)

print("Fixed! Verifying...")import re

filepath = "app/teacher/classhub/[id]/page.tsx"

with open(filepath, "r") as f:
    content = f.read()

# Find the return ( and add fragment
content = content.replace("return (\n  <Suspense", "return (\n  <>\n    <Suspense", 1)

# Find the last closing ) of return and add </>
# We insert </> before the final closing paren of the return
last_paren = content.rfind("\n)")
content = content[:last_paren] + "\n  </>\n)" + content[last_paren+2:]

with open(filepath, "w") as f:
    f.write(content)

print("Done! Check the file:")
print("  nano app/teacher/classhub/\\[id\\]/page.tsx")
