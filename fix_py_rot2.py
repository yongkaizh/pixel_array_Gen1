with open('src/utils.ts', 'r') as f:
    lines = f.readlines()

# Fix corrected Python block only (lines 893-1150 approx, i.e., indices 892-1149)
# Lines to fix (0-indexed): 914, 960, 1008, 1054
# (These are in the corrected Python, NOT the original buggy Python at ~1555, ~1601)

changes = {
    914: ('       "{cell_info[\\"rot\\"]}"', '       "R180"'),
    960: ('      list(inst "{cell_info[\\"rot\\"]}") ', '      list(inst "R180") '),
    1008: ('       "{seg_cell_info[\\"rot\\"]}"', '       "R180"'),
    1054: ('      list(inst "{seg_cell_info[\\"rot\\"]}") ', '      list(inst "R180") '),
}

# Since we can't rely on exact escape sequences, let's just do a targeted replacement
# on lines in the range 890-1150 (corrected Python block)
import re

text = ''.join(lines)

# Find corrected Python block boundaries
# It starts around line 484 (return `` string start) and ends ~line 1151
# The original buggy Python starts at ~1151

# Split by finding the boundary marker
# The corrected block ends at line ~1151 with: `;\n  } else {\n
split_marker = '`;\n  } else {'
parts = text.split(split_marker, 1)
if len(parts) != 2:
    print("ERROR: Could not find split marker")
    exit(1)

corrected_block = parts[0]
rest = split_marker + parts[1]

print(f"Corrected block ends at char {len(corrected_block)}")

# Now fix in the corrected block only
fixes_corrected = [
    ('       "{cell_info["rot"]}"\n', '       "R180"\n'),
    ('      list(inst "{cell_info[\\"rot\\"]}")\n', '      list(inst "R180")\n'),
    ('       "{seg_cell_info["rot"]}"\n', '       "R180"\n'),
    ('      list(inst "{seg_cell_info[\\"rot\\"]}")\n', '      list(inst "R180")\n'),
]

# Use simpler approach - search for exact strings in the file
import json

# Print some context to understand exact byte content
for target in ['cell_info["rot"]', 'seg_cell_info["rot"]']:
    idx = corrected_block.find(target)
    while idx != -1:
        print(f"Found '{target}' at pos {idx}: ...{repr(corrected_block[max(0,idx-30):idx+50])}...")
        idx = corrected_block.find(target, idx+1)

# Do the actual replacements using simple string replace
# Pattern 1: rotation arg in SimpleMosaic (has 7 spaces indent)
corrected_block = corrected_block.replace(
    '       "{cell_info["rot"]}"\n',
    '       "R180"\n',
    2  # replace first 2 occurrences (SimpleMosaic + Mosaic fallback)
)

# Pattern 2: allInsts cons list
corrected_block = corrected_block.replace(
    'list(inst "{cell_info["rot"]}")',
    'list(inst "R180")',
)

# Pattern 3: seg rotation arg
corrected_block = corrected_block.replace(
    '       "{seg_cell_info["rot"]}"\n',
    '       "R180"\n',
    2
)

# Pattern 4: seg allInsts cons
corrected_block = corrected_block.replace(
    'list(inst "{seg_cell_info["rot"]}")',
    'list(inst "R180")',
)

final_text = corrected_block + rest

with open('src/utils.ts', 'w') as f:
    f.write(final_text)

# Verify: check remaining cell_info["rot"] occurrences
remaining = [i+1 for i, l in enumerate(final_text.splitlines()) if 'cell_info["rot"]' in l]
print(f"\nRemaining cell_info[\"rot\"] occurrences at lines: {remaining}")
print("Done!")
