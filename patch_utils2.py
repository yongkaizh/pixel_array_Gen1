import re

with open('src/utils.ts', 'r') as f:
    text = f.read()

# Replace config.y_pitch and config.x_pitch in the dbCreateMosaic pushing logic ONLY
# TS code: 
pattern1 = r'code\.push\(`\s*\$\{config\.y_pitch\}`\);\n\s*code\.push\(`\s*\$\{config\.x_pitch\}`\);'
repl1 = r'code.push(`            ${config.x_pitch}`);\n      code.push(`            ${config.y_pitch}`);'
text = re.sub(pattern1, repl1, text)

# Python string code
pattern2 = r'\{y_pitch\}\n\s*\{x_pitch\}'
repl2 = r'{x_pitch}\n        {y_pitch}'
text = re.sub(pattern2, repl2, text)

with open('src/utils.ts', 'w') as f:
    f.write(text)

print("Done patching utils.ts")
