import re

with open('src/utils.ts', 'r') as f:
    text = f.read()

# Add ROTATE_180 to python script
text = text.replace(
    'FILE_PATH = "array_pixel.xlsx"',
    'FILE_PATH = "array_pixel.xlsx"\nROTATE_180 = False  # Set to True to apply final R180 rotation to the array'
)

py_insert = """
    if ROTATE_180:
        skill.append('''
 ; --- Apply Final R180 Rotation to Entire Array ---
 printf("\\\\nApplying R180 rotation to entire array...\\\\n")
 foreach(item allInsts
   inst = car(item)
   C = centerBox(inst~>bBox)
   if( inst~>orient == "R0" then inst~>orient = "R180"
   else if( inst~>orient == "R180" then inst~>orient = "R0"
   else if( inst~>orient == "R90" then inst~>orient = "R270"
   else if( inst~>orient == "R270" then inst~>orient = "R90"
   else if( inst~>orient == "MY" then inst~>orient = "MX"
   else if( inst~>orient == "MX" then inst~>orient = "MY"
   else if( inst~>orient == "MYR90" then inst~>orient = "MXR90"
   else if( inst~>orient == "MXR90" then inst~>orient = "MYR90"
   ))))))))
   C_new = centerBox(inst~>bBox)
   inst~>xy = list(car(inst~>xy) - car(C) - car(C_new) cadr(inst~>xy) - cadr(C) - cadr(C_new))
 )
''')
"""

text = text.replace(
    '    skill.append("""\n dbSave(cv)\n dbClose(cv)\n\n printf("\\\\\\\\nPixel Array Generation Complete!\\\\\\\\n")\n\n )\n""")',
    py_insert + '    skill.append("""\n dbSave(cv)\n dbClose(cv)\n\n printf("\\\\\\\\nPixel Array Generation Complete!\\\\\\\\n")\n\n )\n""")'
)

with open('src/utils.ts', 'w') as f:
    f.write(text)

