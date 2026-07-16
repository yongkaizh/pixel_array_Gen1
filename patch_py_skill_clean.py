import re

with open('src/utils.ts', 'r') as f:
    text = f.read()

# Add ROTATE_180 to Python script
if "ROTATE_180 = False" not in text:
    text = text.replace('FILE_PATH = "array_pixel.xlsx"', 'FILE_PATH = "array_pixel.xlsx"\nROTATE_180 = False')

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

# Find where dbSave is inside Python generation block.
pattern1 = r'(1004-\n1005- dbSave\(cv\)\n1006- dbClose\(cv\))'
# I can't use line numbers in regex easily, let's just find the dbSave block.
pattern = r'(\n\s*dbSave\(cv\)\n\s*dbClose\(cv\)\n\s*printf\("\\\\\\\\nPixel Array Generation Complete!\\\\\\\\n"\)\n)'
if not re.search(pattern, text):
    pattern = r'( dbSave\(cv\)\n dbClose\(cv\)\n\n printf\("\\\\\\\\nPixel Array Generation Complete!\\\\\\\\n"\))'

if re.search(pattern, text):
    text = re.sub(pattern, py_insert + r'\1', text, count=1)
    
# for the non-corrected python script:
pattern2 = r'(\n dbSave\(cv\)\n\n printf\("\\\\\\\\nPixel Array Generation Complete\\\\\\\\n"\)\n)'
if re.search(pattern2, text):
    text = re.sub(pattern2, py_insert + r'\1', text, count=1)

with open('src/utils.ts', 'w') as f:
    f.write(text)
