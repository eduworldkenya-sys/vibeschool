with open('app/teacher/layout.tsx', 'r') as f:
    lines = f.readlines()
print(f"Total lines: {len(lines)}")
print("Line 268:", repr(lines[267]))
print("Line 375:", repr(lines[374]))
