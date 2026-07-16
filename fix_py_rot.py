with open('src/utils.ts', 'r') as f:
    text = f.read()

# ============================================================
# Fix corrected Python embedded script (lines ~893-1067)
# Replace cell_info["rot"] and seg_cell_info["rot"] with "R180"
# Only in the CORRECTED Python block (before line ~1152 end of corrected block)
# ============================================================

# 1. Replace rotation arg in corrected Python - non-segmented SimpleMosaic
#    "{cell_info["rot"]}" on line 915
old_py1 = '        "{cell_info["rot"]}"\n        {row_count}\n        {total_cols}'
new_py1 = '        "R180"\n        {row_count}\n        {total_cols}'

# 2. Replace rotation arg in corrected Python - non-segmented Mosaic fallback
#    "{cell_info["rot"]}" on line 932
old_py2 = '         "{cell_info["rot"]}"\n         {row_count}\n         {total_cols}'
new_py2 = '         "R180"\n         {row_count}\n         {total_cols}'

# 3. Replace allInsts cons for non-segmented
old_py3 = '       list(inst "{cell_info["rot"]}")\n       allInsts'
new_py3 = '       list(inst "R180")\n       allInsts'

# 4. Replace rotation arg in corrected Python - segmented SimpleMosaic
old_py4 = '        "{seg_cell_info["rot"]}"\n        {row_count}\n        {seg_cols}'
new_py4 = '        "R180"\n        {row_count}\n        {seg_cols}'

# 5. Replace rotation arg in corrected Python - segmented Mosaic fallback
old_py5 = '         "{seg_cell_info["rot"]}"\n         {row_count}\n         {seg_cols}'
new_py5 = '         "R180"\n         {row_count}\n         {seg_cols}'

# 6. Replace allInsts cons for segments
old_py6 = '       list(inst "{seg_cell_info["rot"]}")\n       allInsts'
new_py6 = '       list(inst "R180")\n       allInsts'

replacements = [
    (old_py1, new_py1),
    (old_py2, new_py2),
    (old_py3, new_py3),
    (old_py4, new_py4),
    (old_py5, new_py5),
    (old_py6, new_py6),
]

for old, new in replacements:
    count = text.count(old)
    print(f"Occurrences of pattern: {count} -> {'OK' if count > 0 else 'NOT FOUND'}")
    if count > 0:
        text = text.replace(old, new)

with open('src/utils.ts', 'w') as f:
    f.write(text)

print("\nDone patching corrected Python rotation args!")
