import re

with open('src/utils.ts', 'r') as f:
    text = f.read()

# For generateSkillCode
insert_ts = """
  if (config.rotate180) {
    code.push('    ; --- Apply Final R180 Rotation to Entire Array ---');
    code.push('    printf("\\\\nApplying R180 rotation to entire array...\\\\n")');
    code.push('    foreach(item allInsts');
    code.push('      inst = car(item)');
    code.push('      C = centerBox(inst~>bBox)');
    code.push('      if( inst~>orient == "R0" then inst~>orient = "R180"');
    code.push('      else if( inst~>orient == "R180" then inst~>orient = "R0"');
    code.push('      else if( inst~>orient == "R90" then inst~>orient = "R270"');
    code.push('      else if( inst~>orient == "R270" then inst~>orient = "R90"');
    code.push('      else if( inst~>orient == "MY" then inst~>orient = "MX"');
    code.push('      else if( inst~>orient == "MX" then inst~>orient = "MY"');
    code.push('      else if( inst~>orient == "MYR90" then inst~>orient = "MXR90"');
    code.push('      else if( inst~>orient == "MXR90" then inst~>orient = "MYR90"');
    code.push('      ))))))))');
    code.push('      C_new = centerBox(inst~>bBox)');
    code.push('      inst~>xy = list(car(inst~>xy) - car(C) - car(C_new) cadr(inst~>xy) - cadr(C) - cadr(C_new))');
    code.push('    )');
    code.push('');
  }
"""

text = text.replace("  code.push('    dbSave(cv)');\n  code.push('    dbClose(cv)');\n  code.push('    printf(\"\\\\nPixel Array Generation Complete!\\\\n\")');\n  code.push('  )');\n  code.push(')');\n  code.push('');", insert_ts + "  code.push('    dbSave(cv)');\n  code.push('    dbClose(cv)');\n  code.push('    printf(\"\\\\nPixel Array Generation Complete!\\\\n\")');\n  code.push('  )');\n  code.push(')');\n  code.push('');")


with open('src/utils.ts', 'w') as f:
    f.write(text)

