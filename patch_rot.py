import re

with open('src/utils.ts', 'r') as f:
    text = f.read()

# 1. TS code: replace cellInfo.rot with "R0" in dbCreateMosaic
text = re.sub(
    r'code\.push\(`\s*"\$\{cellInfo\.rot\}"`\);',
    r'code.push(\'            "R0"\');',
    text
)
# 2. TS code: replace segCellInfo.rot with "R0" in dbCreateMosaic
text = re.sub(
    r'code\.push\(`\s*"\$\{segCellInfo\.rot\}"`\);',
    r'code.push(\'            "R0"\');',
    text
)
# 3. TS code: update allInsts list format
text = re.sub(
    r"code\.push\('    allInsts = cons\(inst allInsts\)'\);",
    r'code.push(`    allInsts = cons(list(inst "${cellInfo.rot}") allInsts)`);',
    text,
    count=1
)
text = re.sub(
    r"code\.push\('    allInsts = cons\(inst allInsts\)'\);",
    r'code.push(`    allInsts = cons(list(inst "${segCellInfo.rot}") allInsts)`);',
    text,
    count=1
)

# 4. TS code: update centering and rotation loop
ts_foreach_old = r"""  code\.push\('    foreach\(inst allInsts'\);\n\s*code\.push\('      inst~>xy = list\(car\(inst~>xy\)\+dx cadr\(inst~>xy\)\+dy\)'\);\n\s*code\.push\('    \)'\);"""

ts_foreach_new = r"""  code.push('    foreach(item allInsts');
  code.push('      inst = car(item)');
  code.push('      inst~>xy = list(car(inst~>xy)+dx cadr(inst~>xy)+dy)');
  code.push('    )');
  code.push('');
  code.push('    ; --- Apply Rotations ---');
  code.push('    foreach(item allInsts');
  code.push('      inst = car(item)');
  code.push('      rot = cadr(item)');
  code.push('      if( rot != "R0" then');
  code.push('        C = centerBox(inst~>bBox)');
  code.push('        inst~>orient = rot');
  code.push('        C_new = centerBox(inst~>bBox)');
  code.push('        inst~>xy = list(car(inst~>xy) + car(C) - car(C_new) cadr(inst~>xy) + cadr(C) - cadr(C_new))');
  code.push('      )');
  code.push('    )');"""

text = re.sub(ts_foreach_old, ts_foreach_new, text)

# 5. Python code: replace "{cell_info["rot"]}" with "R0"
text = text.replace('"{cell_info[\\"rot\\"]}"', '"R0"')
text = text.replace('"{seg_cell_info[\\"rot\\"]}"', '"R0"')

# 6. Python code: update allInsts = cons(inst allInsts)
text = re.sub(
    r'allInsts = cons\(inst allInsts\)',
    r'allInsts = cons(list(inst "{cell_info[\\"rot\\"]}") allInsts)',
    text,
    count=1
)
text = re.sub(
    r'allInsts = cons\(inst allInsts\)',
    r'allInsts = cons(list(inst "{seg_cell_info[\\"rot\\"]}") allInsts)',
    text,
    count=1
)
text = re.sub(
    r'allInsts = cons\(inst allInsts\)',
    r'allInsts = cons(list(inst "{cell_info[\\"rot\\"]}") allInsts)',
    text,
    count=1
)

# 7. Python code: update centering and rotation loop
py_foreach_old1 = r""" foreach\(
   inst
   allInsts

   inst~>xy = list\(car\(inst~>xy\)\+dx cadr\(inst~>xy\)\+dy\)
 \)"""

py_foreach_new1 = r""" foreach(
   item
   allInsts

   inst = car(item)
   inst~>xy = list(car(inst~>xy)+dx cadr(inst~>xy)+dy)
 )
 
 ; --- Apply Rotations ---
 foreach(
   item
   allInsts
   
   inst = car(item)
   rot = cadr(item)
   if( rot != "R0" then
     C = centerBox(inst~>bBox)
     inst~>orient = rot
     C_new = centerBox(inst~>bBox)
     inst~>xy = list(car(inst~>xy) + car(C) - car(C_new) cadr(inst~>xy) + cadr(C) - cadr(C_new))
   )
 )"""

text = re.sub(py_foreach_old1, py_foreach_new1, text)

# 8. Python code: update centering and rotation loop (original)
py_foreach_old2 = r""" foreach\(
   inst
   allInsts

   inst~>xy = list\(car\(inst~>xy\)\+dx cadr\(inst~>xy\)\+dy\)
 \)"""

text = re.sub(py_foreach_old2, py_foreach_new1, text)

with open('src/utils.ts', 'w') as f:
    f.write(text)

print("Patched R180 logic!")
