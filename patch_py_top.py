import re

with open('src/utils.ts', 'r') as f:
    text = f.read()

text = text.replace('EXCEL_FILE = "array_pixel.xlsx"', 'EXCEL_FILE = "array_pixel.xlsx"\nROTATE_180 = False  # Set to True to apply final R180 rotation to the array')

with open('src/utils.ts', 'w') as f:
    f.write(text)

