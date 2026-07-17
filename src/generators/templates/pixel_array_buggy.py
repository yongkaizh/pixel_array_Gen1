#!/usr/bin/env python3

import pandas as pd
import re

EXCEL_FILE = "array_pixel.xlsx"
SKILL_FILE = "pixel_array.il"

# Initialize skill variable as an empty list to avoid NameError
skill = []

# =========================================================
# Utility Functions
# =========================================================

def norm(v):
    if pd.isna(v):
        return ""
    return str(v).strip()

def find_keyword(df, keyword):

    keyword = keyword.lower()

    for r in range(df.shape[0]):
        for c in range(df.shape[1]):

            txt = norm(df.iat[r, c]).lower()

            if txt == keyword:
                return (r, c)

    return None


def get_parameter(df, keyword):

    pos = find_keyword(df, keyword)

    if pos is None:
        raise RuntimeError(
            f"Cannot find keyword [{keyword}]"
        )

    r, c = pos

    return norm(df.iat[r, c + 1])


def extract_purpose(text):

    text = norm(text)

    m = re.search(r"\((.*?)\)", text)

    if m:
        return m.group(1).strip()

    return text.strip()

# =========================================================
# Read pix_tbl
# =========================================================

print("\nReading pix_tbl ...")

pix_df = pd.read_excel(
    EXCEL_FILE,
    sheet_name="pix_tbl",
    dtype=str
).fillna("")

cell_map = {}

for _, row in pix_df.iterrows():

    name = norm(row["Name"]).lower()

    if not name:
        continue

    cell_map[name] = {
        "lib": norm(row["library"]),
        "cell": norm(row["Cell"]),
        "rot": norm(row["rotation"])
    }

print(f"Loaded {len(cell_map)} cells")

# =========================================================
# Read format_template
# =========================================================

print("Reading format_template ...")

tmpl = pd.read_excel(
    EXCEL_FILE,
    sheet_name="format_template",
    header=None,
    dtype=str
).fillna("")

top_lib = get_parameter(tmpl, "library")
top_cell = get_parameter(tmpl, "cellname")

x_pitch = float(
    get_parameter(tmpl, "x pitch")
)

y_pitch = float(
    get_parameter(tmpl, "y pitch")
)

print("Library :", top_lib)
print("Cell    :", top_cell)
print("X Pitch :", x_pitch)
print("Y Pitch :", y_pitch)

# =========================================================
# Parse col_num table
# =========================================================

col_pos = find_keyword(
    tmpl,
    "col_num"
)

if col_pos is None:
    raise RuntimeError(
        "Cannot find col_num table."
    )

cr, cc = col_pos

total_cols = None

for r in range(cr + 1, min(cr + 20, tmpl.shape[0])):

    value = norm(
        tmpl.iat[r, cc]
    )

    if value == "":
        continue

    try:

        total_cols = int(
            float(value)
        )



        break

    except:
        pass

if total_cols is None:

    raise RuntimeError(
        "Failed to get TOTAL_COLS."
    )

print("TOTAL_COLS =", total_cols)

# =========================================================
# Parse row_num table
# =========================================================

row_pos = find_keyword(
    tmpl,
    "row_num"
)

if row_pos is None:
    raise RuntimeError(
        "Cannot find row_num table."
    )

rr, rc = row_pos

rows = []
rov_purpose = None

r = rr + 1

while r < tmpl.shaperow_count_txt = norm(
        tmpl.iat[r, rc]
    )

    if row_count_txt == "":
        break

    purpose_txt = ""

    if rc + 1 < tmpl.shapepurpose_txt = norm(
            tmpl.iat[r, rc + 1]
        )

    try:
        row_count = int(
            float(row_count_txt)
        )
    except:
        r += 1
        continue

    purpose = extract_purpose(
        purpose_txt
    )

    rows.append(
        {
            "purpose": purpose,
            "rows": row_count
        }
    )

    #
    # check nearby columns
    # for ROV marker
    #

    for c in range(
        rc + 2,
        min(rc + 10, tmpl.shape[1])
    ):

        marker = norm(
            tmpl.iat[r, c]
        ).upper()

        if marker == "ROV":
            rov_purpose = purpose

    r += 1

if rov_purpose is None:

    raise RuntimeError(
        "ROV marker not found."
    )

print("ROV PURPOSE =", rov_purpose)

# =========================================================
# Validate purpose names
# =========================================================

for row in reversed(rows):

    purpose = row["purpose"].lower()

    if purpose not in cell_map:

        raise RuntimeError(
            f"Purpose [{purpose}] "
            f"not found in pix_tbl"
        )

# =========================================================
# Helper for row categorization
# =========================================================

def get_row_category(purpose, name, rov_purpose):
    p = str(purpose).lower()
    n = str(name).lower()
    rov_lower = str(rov_purpose).lower()

    if p == 'top': return 'top'
    if p == 'bottom': return 'bottom'

    if 'blc' in n or 'blc' in p: return 'blc'
    if 'rov' in n or 'rov' in p: return 'rov'
    if n == 'c1' or 'active' in n or 'active' in p or p == 'act' or n == 'act' or (p == 'c1' and 'blc' not in n): return 'active'
    if p == rov_lower or 'ob' in p or 'black' in p: return 'rov'
    if 'cbar' in p or 'color' in p or 'color' in n or 'cbar' in n: return 'cbar'
    if 'clamp' in p or 'idle' in p or 'bsun' in p or 'ecl' in p or 'clamp' in n or 'idle' in n or 'bsun' in n or 'ecl' in n: return 'clamp'

    return 'dummy'

# =========================================================
# Generate SKILL
# =========================================================

skill = []

skill.append("; =====================================")
skill.append("; AUTO GENERATED")
skill.append("; =====================================")
skill.append("")

skill.append("procedure(createPixelArray()")

skill.append("""
 let((
      cv
      master
      inst
      allInsts
      center
      dx
      dy
      currentY
 ))
""")

skill.append(f'''
 printf("\\n===============================\\n")
 printf("Pixel Array Generation Start\\n")
 printf("===============================\\n")

 ; Ensure target library exists
 unless(
    ddGetObj("{top_lib}")
    error("Library {top_lib} does not exist!\\n")
 )

 ; Check if cell layout exists. If so open it, otherwise create it.
 if(
    ddGetObj("{top_lib}" "{top_cell}" "layout") then
    printf("Cellview {top_cell} layout already exists. Opening...\\n")
    cv =
      dbOpenCellViewByType(
         "{top_lib}"
         "{top_cell}"
         "layout"
         "maskLayout"
         "a"
      )
 else
    printf("Cellview {top_cell} layout does not exist. Creating new...\\n")
    cv =
      dbOpenCellViewByType(
         "{top_lib}"
         "{top_cell}"
         "layout"
         "maskLayout"
         "w"
      )
 )

 when(
    cv == nil
    error("Cannot create or open target layout\\n")
 )

 ; Clear any existing instances to avoid duplicates
 when(
    cv
    foreach(inst cv~>instances
       dbDeleteObject(inst)
    )
 )

 currentY = 0
 allInsts = nil
''')

# =========================================================
# Create rows
# =========================================================

for row in reversed(rows):

    purpose = row["purpose"]
    row_count = row["rows"]
    row_name = row.get("name", "")

    cell_info = cell_map[
        purpose.lower()
    ]

    skill.append(f'''
 printf(
  "Creating {purpose} rows={row_count} y=%L\\n"
  currentY
 )

 master =
  dbOpenCellViewByType(
     "{cell_info["lib"]}"
     "{cell_info["cell"]}"
     "layout"
      "maskLayout"
      "r"
  )

 when(
   master == nil
   error(
    "Cannot open master {cell_info["cell"]}\\n"
   )
 )

 inst =
  car(
   errset(
    dbCreateSimpleMosaic(
       cv
       master
       nil
       list(0 0)
       "{cell_info["rot"]}"
       {row_count}
       {total_cols}
       {y_pitch}
       {x_pitch}
    )
   )
  )
 unless(inst
  inst =
   car(
    errset(
     dbCreateMosaic(
        cv
        master
        nil
        list(0 0)
        "R180"
        {row_count}
        {total_cols}
        {y_pitch}
        {x_pitch}
  )
 )

 when(
   inst == nil
   error(
    "Failed creating {purpose}\\n"
   )
 )

 when(inst
    bBox = inst~>bBox
    ll = car(bBox)
    x_ll = car(ll)
    y_ll = cadr(ll)
    dx = 0.0 - x_ll
    dy = currentY - y_ll
    inst~>xy = list(dx dy)
 )

 allInsts =
   cons(
      list(inst "{cell_info["rot"]}")
      allInsts
   )
''')

    if purpose.lower() == rov_purpose.lower() and row == max_active_row:

        skill.append("""
 printf("ACTIVE MOSAIC FOUND\\n")
 rovInst = inst
""")

    skill.append(
        f" currentY = currentY + ({row_count} * {y_pitch})"
    )

# =========================================================
# Center Active Array
# =========================================================

skill.append(f"""
 printf("\\nFinding Global Array Center...\\n")
 if( rovInst != nil then
   C = centerBox(rovInst~>bBox)
   dx = 0.0 - ({total_cols * x_pitch} / 2.0)
   dy = 0.0 - cadr(C)
 else
   dx = 0.0 - ({total_cols * x_pitch} / 2.0)
   dy = 0.0 - (currentY / 2.0)
 )
 printf("Global Center: cx=%L cy=%L\\n" 0.0 - dx 0.0 - dy)
 printf("Move dx=%L dy=%L\\n" dx dy)
""")

skill.append("""

 foreach(
   item
   allInsts

   inst = car(item)
   inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
 )
 
 ; --- Rotations applied during creation ---

 dbSave(cv)

 printf("\\nPixel Array Generation Complete\\n")

 )
)

createPixelArray()
""")

# =========================================================
# Write file
# =========================================================

with open(SKILL_FILE, "w") as fp:
    fp.write(
        "\\n".join(skill)
    )

print()
print("Generated :", SKILL_FILE)
print("ROV       :", rov_purpose)
print("COLS      :", total_cols)
print("ROW TYPES :", len(rows))
print("Done.")
