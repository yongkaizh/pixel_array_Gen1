with open('src/utils.ts', 'r') as f:
    text = f.read()

# Non-segmented rows: cellInfo.rot -> R180 (appears exactly 2 times, both replaced)
old_cell = '      code.push(`          "${cellInfo.rot}"`);\n'
new_cell = '      code.push(\'          "R180"\');\n'

# Segmented rows: segCellInfo.rot -> R180 (appears exactly 2 times, both replaced)
old_seg = '        code.push(`          "${segCellInfo.rot}"`);\n'
new_seg = '        code.push(\'          "R180"\');\n'

c1 = text.count(old_cell)
c2 = text.count(old_seg)
print(f"cellInfo.rot occurrences: {c1}")
print(f"segCellInfo.rot occurrences: {c2}")

text = text.replace(old_cell, new_cell)
text = text.replace(old_seg, new_seg)

with open('src/utils.ts', 'w') as f:
    f.write(text)

print("Done patching rotation args!")
