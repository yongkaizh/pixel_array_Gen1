#!/usr/bin/env python3
"""
Pixel Array CAD SKILL Generator
Author: Yongkai Zhang
Copyright (c) 2026 Yongkai Zhang
=========================================
Corrected and robust python script to parse pixel array specifications from Excel
and output Cadence SKILL commands.

Bug Fixes Applied:
1. Fixed typo 'tmpl.shapeactive_col_purpose' -> 'tmpl.shape[1]' boundary check.
2. Fixed truncated 'tmpl.shaperow_count_txt = norm' -> 'while r < tmpl.shape[0]' with correct indentation.
3. Fixed typo 'tmpl.shapepurpose_txt' -> 'tmpl.shape[1]' bounds safety.
4. Ensured robust variable initialization for 'skill' to guarantee definition even during exception states.
"""

import pandas as pd
import re
import sys
import math
import json

SKILL_RUNTIME = r'''
; Geometry helpers shared by the browser and standalone Python exports.
procedure(paUnionBBox(a b)
  if(a then
    if(b then
      list(list(min(caar(a) caar(b)) min(cadar(a) cadar(b)))
           list(max(caadr(a) caadr(b)) max(cadadr(a) cadadr(b))))
    else a)
  else b)
)

procedure(paLeafShape(path)
  if(listp(path) then paLeafShape(cadr(path)) else path)
)

procedure(paLayerBBox(master lpp)
  let((bounds shape shapeBox path)
    foreach(path dbShapeQuery(master lpp master~>bBox 0 32)
      shape = paLeafShape(path)
      when(shape && member(shape~>objType list("rect" "polygon" "path" "pathSeg" "ellipse" "donut"))
        shapeBox = dbTransformBBox(shape~>bBox dbGetHierPathTransform(path))
        bounds = paUnionBBox(bounds shapeBox)
      )
    )
    bounds
  )
)

; Metadata: instance, configured orientation, local columns/rows, X/Y pitch, reference bbox.
procedure(paMosaicBBox(item)
  let((inst orient cols rows xp yp bounds xy pt)
    inst = car(item)
    orient = cadr(item)
    cols = nth(2 item)
    rows = nth(3 item)
    xp = nth(4 item)
    yp = nth(5 item)
    foreach(pt list(list(0.0 0.0) list((cols - 1) * xp 0.0)
                    list(0.0 (rows - 1) * yp) list((cols - 1) * xp (rows - 1) * yp))
      xy = dbTransformPoint(pt list(inst~>xy orient 1.0))
      bounds = paUnionBBox(bounds dbTransformBBox(nth(6 item) list(xy orient 1.0)))
    )
    bounds
  )
)
'''

EXCEL_FILE = "array_pixel.xlsx"
SKILL_FILE = "pixel_array.il"

# =========================================================
# Utility Functions
# =========================================================

ORIENTATION_MATRICES = {
    "R0": (1, 0, 0, 1), "R90": (0, -1, 1, 0),
    "R180": (-1, 0, 0, -1), "R270": (0, 1, -1, 0),
    "MX": (1, 0, 0, -1), "MY": (-1, 0, 0, 1),
    "MXR90": (0, 1, 1, 0), "MYR90": (0, -1, -1, 0),
}

def mosaic_geometry(rotation, cols, rows, x_pitch, y_pitch):
    orient = (rotation or "R0").strip().upper() or "R0"
    if orient not in ORIENTATION_MATRICES:
        raise ValueError(f"Unsupported cell rotation: {rotation}")
    a, b, c, d = ORIENTATION_MATRICES[orient]
    if a == 0:
        cols, rows, x_pitch, y_pitch = rows, cols, y_pitch, x_pitch
    width, height = cols * x_pitch, rows * y_pitch
    return dict(orient=orient, cols=cols, rows=rows, xStep=x_pitch, yStep=y_pitch,
                offsetX=-(min(0, a * width) + min(0, b * height)),
                offsetY=-(min(0, c * width) + min(0, d * height)))

def positive_number(value, label, integer=False):
    number = float(value)
    if not math.isfinite(number) or number <= 0 or (integer and (not number.is_integer() or number > 9007199254740991)):
        raise ValueError(f"{label} must be a positive {'safe integer' if integer else 'finite number'}")
    return int(number) if integer else number

def skill_content(value):
    return json.dumps(str(value), ensure_ascii=False)[1:-1]

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
        raise RuntimeError(f"Cannot find keyword [{keyword}]")
    r, c = pos
    # Search cells to the right for first non-empty value
    for col in range(c + 1, df.shape[1]):
        val = norm(df.iat[r, col])
        if val != "":
            return val
    return ""

def get_row_category(purpose, name, rov_purpose):
    p = str(purpose).lower()
    n = str(name).lower()
    rov_lower = str(rov_purpose).lower()

    if p == 'top': return 'top'
    if p == 'bottom': return 'bottom'

    if 'blc' in n or 'blc' in p: return 'blc'
    if 'rov' in n or 'rov' in p: return 'rov'
    if n == 'c1' or 'active' in n or 'active' in p or p == 'act' or n == 'act' or (p == 'c1' and 'blc' not in n) or 'core' in p or 'core' in n: return 'active'
    if p == rov_lower or 'ob' in p or 'black' in p: return 'rov'
    if 'cbar' in p or 'color' in p or 'color' in n or 'cbar' in n: return 'cbar'
    if 'clamp' in p or 'idle' in p or 'bsun' in p or 'ecl' in p or 'clamp' in n or 'idle' in n or 'bsun' in n or 'ecl' in n: return 'clamp'

    return 'dummy'

def extract_purpose(text):
    text = norm(text)
    m = re.search(r"\((.*?)\)", text)
    if m:
        return m.group(1).strip()
    return text.strip()

# =========================================================
# Main Code Runner
# =========================================================

def main():
    # Fix: Ensure 'skill' is defined beforehand
    skill = [SKILL_RUNTIME]

    print("\nReading pix_tbl ...")
    try:
        pix_df = pd.read_excel(
            EXCEL_FILE,
            sheet_name="pix_tbl",
            dtype=str
        ).fillna("")
    except Exception as e:
        print(f"Error: Could not read sheet 'pix_tbl' from {EXCEL_FILE}. {e}")
        sys.exit(1)

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
    try:
        tmpl = pd.read_excel(
            EXCEL_FILE,
            sheet_name="format_template",
            header=None,
            dtype=str
        ).fillna("")
    except Exception as e:
        print(f"Error: Could not read sheet 'format_template' from {EXCEL_FILE}. {e}")
        sys.exit(1)

    try:
        top_lib = get_parameter(tmpl, "library")
        top_cell = get_parameter(tmpl, "cellname")
        x_pitch = positive_number(get_parameter(tmpl, "x pitch"), "X pitch")
        y_pitch = positive_number(get_parameter(tmpl, "y pitch"), "Y pitch")
    except Exception as e:
        print(f"Error parsing metadata parameters: {e}")
        sys.exit(1)

    try:
        center_layer_raw = get_parameter(tmpl, "center layer")
        if not center_layer_raw:
            center_layer_raw = get_parameter(tmpl, "centering layer")
    except Exception:
        center_layer_raw = ""
    
    if not center_layer_raw:
        center_layer_raw = "BDTID drawing"
    
    center_parts = center_layer_raw.split()
    center_layer = center_parts[0] if len(center_parts) > 0 else "BDTID"
    center_purpose = center_parts[1] if len(center_parts) > 1 else "drawing"

    print("Library :", top_lib)
    print("Cell    :", top_cell)
    print("X Pitch :", x_pitch)
    print("Y Pitch :", y_pitch)
    print("Center  :", f"{skill_content(center_layer)} {skill_content(center_purpose)}")

    # =========================================================
    # Parse col_num table
    # =========================================================
    col_pos = find_keyword(tmpl, "col_num")
    if col_pos is None:
        raise RuntimeError("Cannot find col_num table.")

    cr, cc = col_pos
    total_cols = None
    found_col_num = False

    # Check same row first for numeric column count
    for c in range(cc + 1, tmpl.shape[1]):
        val = norm(tmpl.iat[cr, c])
        if val != "":
            try:
                total_cols = float(val)
                found_col_num = True
                break
            except:
                pass

    # If not found on same row, check subsequent rows
    if not found_col_num:
        for r in range(cr + 1, min(cr + 20, tmpl.shape[0])):
            value = norm(tmpl.iat[r, cc])
            if value.lower() == "row_num":
                break
            if value == "":
                continue
            try:
                total_cols = float(value)

                found_col_num = True
                break
            except Exception as e:
                pass



    if total_cols is None:
        raise RuntimeError("Failed to get TOTAL_COLS.")

    total_cols = positive_number(total_cols, "Column count", True)
    print("TOTAL_COLS =", total_cols)
    
    # =========================================================
    # Parse row_num table
    # =========================================================
    row_pos = find_keyword(tmpl, "row_num")
    if row_pos is None:
        raise RuntimeError("Cannot find row_num table.")

    rr, rc = row_pos
    rows = []
    target_pos = find_keyword(tmpl, "rov purpose")
    rov_purpose = norm(tmpl.iat[target_pos[0], target_pos[1] + 1]) if target_pos and target_pos[1] + 1 < tmpl.shape[1] else None

    def parse_segments_string(txt, default_purpose='dummy'):
        if not txt or not txt.strip():
            return []
        segs = []
        for part in txt.split(','):
            match = re.fullmatch(r"(?:([a-zA-Z0-9_]+)\s*:\s*)?(\d+)", part.strip())
            if not match:
                raise ValueError(f"Invalid padding segment: {part}")
            segs.append({"purpose": (match.group(1) or default_purpose).lower(),
                         "cols": positive_number(match.group(2), "Padding columns", True)})
        return segs

    r = rr + 1
    while r < tmpl.shape[0]:
        row_count_txt = norm(tmpl.iat[r, rc])
        if row_count_txt == "":
            break

        purpose_txt = ""
        if rc + 1 < tmpl.shape[1]:
            purpose_txt = norm(tmpl.iat[r, rc + 1])

        try:
            row_count = float(row_count_txt)
        except ValueError:
            if r == rr + 1 and row_count_txt.startswith("("):
                r += 1
                continue
            raise ValueError(f"Invalid row count: {row_count_txt}")

        row_count = positive_number(row_count, "Row count", True)
        purpose = extract_purpose(purpose_txt)

        # Extract row name (e.g. "BLC (c1)" -> name="BLC", purpose="c1")
        row_name = purpose_txt
        m = re.match(r"^(.*?)\s*\((.*?)\)", purpose_txt)
        if m:
            row_name = m.group(1).strip()
            purpose = m.group(2).strip()

        # Parse left and right segments
        left_txt = ""
        if rc + 3 < tmpl.shape[1]:
            left_txt = norm(tmpl.iat[r, rc + 3])

        right_txt = ""
        if rc + 4 < tmpl.shape[1]:
            right_txt = norm(tmpl.iat[r, rc + 4])

        left_segs = parse_segments_string(left_txt, 'dummy')
        right_segs = parse_segments_string(right_txt, 'dummy')
        left_sum = sum(s['cols'] for s in left_segs)
        right_sum = sum(s['cols'] for s in right_segs)

        segments = []
        if len(left_segs) > 0 or len(right_segs) > 0:
            if left_sum + right_sum >= total_cols:
                raise RuntimeError(f"Row {purpose} padding exceeds total columns!")

            for s in left_segs:
                segments.append(s)
            
            center_cols = total_cols - left_sum - right_sum
            segments.append({"purpose": purpose.lower(), "cols": center_cols})
            
            for s in right_segs:
                segments.append(s)

        row_data = {
            "purpose": purpose,
            "rows": row_count,
            "name": row_name
        }
        if len(segments) > 0:
            row_data["segments"] = segments

        rows.append(row_data)

        # Check nearby columns for ROV marker (starts from Column G which is rc + 1)
        for c in range(rc + 2, min(rc + 3, tmpl.shape[1])):
            marker = norm(tmpl.iat[r, c]).upper()
            if marker == "ROV":
                if rov_purpose and rov_purpose.lower() != purpose.lower():
                    raise ValueError("ROV markers must select a single target purpose")
                rov_purpose = purpose

        r += 1

    if not rows:
        raise RuntimeError("At least one row block is required.")
    if rov_purpose is None:
        rov_purpose = ""

    print("ROV PURPOSE =", rov_purpose)

    # =========================================================
    # Require explicit physical mappings before opening or clearing any layout.
    for row in rows:
        for part in row.get("segments") or [row]:
            purpose = part["purpose"].lower()
            info = cell_map.get(purpose)
            if not info or not info["lib"] or not info["cell"]:
                raise ValueError(f"Missing cell mapping for {purpose}")
            mosaic_geometry(info.get("rot"), 1, 1, x_pitch, y_pitch)
            if info["lib"] == top_lib and info["cell"] == top_cell:
                raise ValueError("A unit cell cannot be the target array cell")
    total_rows = sum(row["rows"] for row in rows)
    positive_number(total_rows, "Total rows", True)
    if not math.isfinite(total_rows * y_pitch) or not math.isfinite(total_cols * x_pitch):
        raise ValueError("Array dimensions exceed the supported numeric range")

    skill.append("; =====================================")
    skill.append("; AUTO GENERATED")
    skill.append("; =====================================")
    skill.append("")
    skill.append("procedure(createPixelArray()")
    skill.append(" let((")
    skill.append("      cv")
    skill.append("      master")
    skill.append("      inst")
    skill.append("      rovInst")
    skill.append("      allInsts")
    skill.append("      center")
    skill.append("      dx")
    skill.append("      dy")
    skill.append("      currentY")
    skill.append("      maxActiveInst")
    skill.append("      cx")
    skill.append("      cy")
    skill.append("      bBox")
    skill.append("      maxActiveData mosaic item path sh shBox shapes verificationRect placementBox actualBox nominalBox targetInsts matchesTarget target")
    skill.append("      c_layer c_purp local_bBox llx lly urx ury orient")
    skill.append("      m_cols m_rows uX uY pt_00 pt_c0 pt_0r pt_cr xy_0")
    skill.append("      xy_00 xy_c0 xy_0r xy_cr bB_00 bB_c0 bB_0r bB_cr")
    skill.append("      layer_left layer_right layer_bottom layer_top layer_bBox mBBox")
    skill.append("      targetCellName v_llx v_lly v_urx v_ury")
    skill.append(" ))")

    skill.append(f"""
 printf("\\n===============================\\n")
 printf("Pixel Array Generation Start\\n")
 printf("===============================\\n")

 ; Ensure target library exists
 unless(
    ddGetObj("{skill_content(top_lib)}")
    error("Library %s does not exist!\\n" "{skill_content(top_lib)}")
 )

 ; Check if cell layout exists. If so open it, otherwise create it.
 if(
    ddGetObj("{skill_content(top_lib)}" "{skill_content(top_cell)}" "layout") then
    printf("Cellview %s layout already exists. Opening...\\n" "{skill_content(top_cell)}")
    cv =
      dbOpenCellViewByType(
         "{skill_content(top_lib)}"
         "{skill_content(top_cell)}"
         "layout"
         "maskLayout"
         "a"
      )
 else
    printf("Cellview %s layout does not exist. Creating new...\\n" "{skill_content(top_cell)}")
    cv =
      dbOpenCellViewByType(
         "{skill_content(top_lib)}"
         "{skill_content(top_cell)}"
         "layout"
         "maskLayout"
         "w"
      )
 )

 when(
    cv == nil
    error("Cannot create or open target layout\\n")
 )

 unwindProtect(
  {{
   ; Clear any existing instances to avoid duplicates
   when(
      cv
      foreach(inst cv~>instances
         dbDeleteObject(inst)
      )
      foreach(sh cv~>shapes
         when(sh~>pixelArrayVerification
            dbDeleteObject(sh)
         )
      )
      foreach(mosaic cv~>mosaics
         dbDeleteObject(mosaic)
      )
   )

   currentY = 0
   allInsts = nil
   maxActiveInst = nil
   maxActiveData = nil
   local_bBox = nil
   targetInsts = nil
""")

    # Create rows
    # Identify the true active block with the maximum row count
    active_rows = [r for r in rows if get_row_category(r["purpose"], r.get("name", ""), rov_purpose) == 'active']
    target_rows = [r for r in rows if (
        any(seg["purpose"].lower() == rov_purpose.lower() for seg in r["segments"])
        if r.get("segments") else r["purpose"].lower() == rov_purpose.lower())]
    active_rows = target_rows or active_rows
    max_active_row = None
    if active_rows:
        max_active_row = max(active_rows, key=lambda r: r["rows"])
    for rev_idx, row in enumerate(reversed(rows)):
        orig_idx = len(rows) - 1 - rev_idx
        row_num = orig_idx + 1
        purpose = row["purpose"]
        row_name = row.get("name", purpose)
        row_count = row["rows"]
        segments = row.get("segments", [])

        clean_purpose = re.sub(r'[^a-zA-Z0-9_]', '_', purpose.lower())
        mosaic_name = f"M{row_num}_{clean_purpose}"

        skill.append(f"""
  ; --- Creating {row_name.replace(chr(10), " ").replace(chr(13), " ")} Rows ---
  printf(
   "Creating %s (purpose: %s) rows=%L y=%L\\n"
   "{skill_content(row_name)}" "{skill_content(purpose)}" {row_count} currentY
  )
""")

        if len(segments) == 0:
            cell_info = cell_map[purpose.lower()]
            g = mosaic_geometry(cell_info.get("rot"), total_cols, row_count, x_pitch, y_pitch)
            skill.append(f"""
  master =
   dbOpenCellViewByType(
      "{skill_content(cell_info["lib"])}"
      "{skill_content(cell_info["cell"])}"
      "layout"
      "maskLayout"
      "r"
   )

  when(
     master == nil
     error(
      "Cannot open master %s\\n" "{skill_content(cell_info["cell"])}"
     )
  )

  inst = dbCreateSimpleMosaic(
        cv
        master
        "{mosaic_name}"
        list(0.0 0.0)
        "{g["orient"]}"
        {g["rows"]}
        {g["cols"]}
        {g["yStep"]}
        {g["xStep"]}
  )
  unless(inst
   inst = dbCreateMosaic(
         cv
         master
         "{mosaic_name}"
         list(0.0 0.0)
         "{g["orient"]}"
         {g["rows"]}
         {g["cols"]}
         {g["yStep"]}
         {g["xStep"]}
  )
  )

  when(
     inst == nil
     error(
      "Failed creating %s\\n" "{skill_content(purpose)}"
     )
  )

  when(inst
     dx = {g["offsetX"]}
     dy = currentY + {g["offsetY"]}
     placementBox = paLayerBBox(master list("{skill_content(center_layer)}" "{skill_content(center_purpose)}"))
     unless(placementBox placementBox = master~>bBox)
     unless(placementBox error("Master has no placement geometry\\n"))
     actualBox = dbTransformBBox(placementBox list(list(0.0 0.0) "{g["orient"]}" 1.0))
     nominalBox = dbTransformBBox(list(list(0.0 0.0) list({g["xStep"]} {g["yStep"]})) list(list(0.0 0.0) "{g["orient"]}" 1.0))
     dx = dx + caar(nominalBox) - caar(actualBox)
     dy = dy + cadar(nominalBox) - cadar(actualBox)
     inst~>xy = list(dx dy)
  )

  allInsts =
    cons(
       list(inst "{g["orient"]}" {g["cols"]} {g["rows"]} {g["xStep"]} {g["yStep"]} placementBox)
       allInsts
    )
  dbClose(master)
""")
            if row is max_active_row:
                skill.append("""
  printf("ACTIVE MOSAIC FOUND\\n")
  maxActiveInst = inst
  maxActiveData = car(allInsts)
  targetInsts = cons(maxActiveData targetInsts)
""")
        else:
            curr_seg_x = 0.0
            for s_idx, seg in enumerate(segments):
                seg_purpose = seg["purpose"]
                seg_cols = seg["cols"]
                clean_seg_purpose = re.sub(r'[^a-zA-Z0-9_]', '_', seg_purpose.lower())
                seg_mosaic_name = f"M{row_num}_{clean_purpose}_seg{s_idx + 1}_{clean_seg_purpose}"

                seg_cell_info = cell_map.get(seg_purpose.lower(), {
                    "lib": "pixel_lib",
                    "cell": f"cell_{seg_purpose}",
                    "rot": "R0"
                })
                g = mosaic_geometry(seg_cell_info.get("rot"), seg_cols, row_count, x_pitch, y_pitch)
                skill.append(f"""
  ; Segment {s_idx + 1}: {seg_purpose} (cols={seg_cols})
  master =
   dbOpenCellViewByType(
      "{skill_content(seg_cell_info["lib"])}"
      "{skill_content(seg_cell_info["cell"])}"
      "layout"
      "maskLayout"
      "r"
   )

  when(
     master == nil
     error(
      "Cannot open master %s\\n" "{skill_content(seg_cell_info["cell"])}"
     )
  )

  inst = dbCreateSimpleMosaic(
        cv
        master
        "{seg_mosaic_name}"
        list(0.0 0.0)
        "{g["orient"]}"
        {g["rows"]}
        {g["cols"]}
        {g["yStep"]}
        {g["xStep"]}
  )
  unless(inst
   inst = dbCreateMosaic(
         cv
         master
         "{seg_mosaic_name}"
         list(0.0 0.0)
         "{g["orient"]}"
         {g["rows"]}
         {g["cols"]}
         {g["yStep"]}
         {g["xStep"]}
  )
  )

  when(
     inst == nil
     error(
      "Failed creating segment %s\\n" "{skill_content(seg_purpose)}"
     )
  )

  when(inst
     dx = {curr_seg_x} + {g["offsetX"]}
     dy = currentY + {g["offsetY"]}
     placementBox = paLayerBBox(master list("{skill_content(center_layer)}" "{skill_content(center_purpose)}"))
     unless(placementBox placementBox = master~>bBox)
     unless(placementBox error("Master has no placement geometry\\n"))
     actualBox = dbTransformBBox(placementBox list(list(0.0 0.0) "{g["orient"]}" 1.0))
     nominalBox = dbTransformBBox(list(list(0.0 0.0) list({g["xStep"]} {g["yStep"]})) list(list(0.0 0.0) "{g["orient"]}" 1.0))
     dx = dx + caar(nominalBox) - caar(actualBox)
     dy = dy + cadar(nominalBox) - cadar(actualBox)
     inst~>xy = list(dx dy)
  )

  allInsts =
    cons(
       list(inst "{g["orient"]}" {g["cols"]} {g["rows"]} {g["xStep"]} {g["yStep"]} placementBox)
       allInsts
    )
  dbClose(master)
""")
                if row is max_active_row and (seg_purpose.lower() == rov_purpose.lower() or (
                    not any(seg["purpose"].lower() == rov_purpose.lower() for seg in segments)
                    and seg_purpose.lower() == purpose.lower())):
                    skill.append("""
  printf("ACTIVE SEGMENT MOSAIC FOUND\\n")
  maxActiveInst = inst
  maxActiveData = car(allInsts)
  targetInsts = cons(maxActiveData targetInsts)
""")
                curr_seg_x += seg_cols * x_pitch

        skill.append(f" currentY = currentY + ({row_count} * {y_pitch})")

    # Fallback uses the same selected row/segment as runtime layer centering.
    left_cols = 0
    active_cols = total_cols
    if max_active_row and max_active_row.get("segments"):
        segments = max_active_row["segments"]
        idx = next((i for i, seg in enumerate(segments) if seg["purpose"].lower() == rov_purpose.lower()), -1)
        if idx < 0:
            idx = next((i for i, seg in enumerate(segments) if seg["purpose"].lower() == max_active_row["purpose"].lower()), -1)
        selected = [i for i, seg in enumerate(segments) if seg["purpose"].lower() == rov_purpose.lower()]
        if not selected:
            selected = [i for i, seg in enumerate(segments) if seg["purpose"].lower() == max_active_row["purpose"].lower()]
        if selected:
            left_cols = sum(seg["cols"] for seg in segments[:selected[0]])
            active_cols = sum(seg["cols"] for seg in segments[selected[0]:selected[-1] + 1])
    target_dx = -(left_cols + active_cols / 2.0) * x_pitch
    if max_active_row:
        max_active_idx = next(i for i, row in enumerate(rows) if row is max_active_row)
        start_y_rows = sum(row["rows"] for row in rows[max_active_idx + 1:])
        end_y_rows = start_y_rows + max_active_row["rows"]
        target_dy = - (start_y_rows + end_y_rows) / 2.0 * y_pitch
    else:
        target_dy = -(sum(row["rows"] for row in rows) / 2.0) * y_pitch

    # Center the union of the selected segment bounds; keep the complete array rigid.
    skill.append(f"""
 layer_bBox = nil
 foreach(item targetInsts
   layer_bBox = paUnionBBox(layer_bBox paMosaicBBox(item))
 )
 if(layer_bBox then
   dx = -(caar(layer_bBox) + caadr(layer_bBox)) / 2.0
   dy = -(cadar(layer_bBox) + cadadr(layer_bBox)) / 2.0
 else
   dx = {target_dx}
   dy = {target_dy}
   printf("Fallback mathematical center: cx=%L cy=%L\\n" 0.0 - dx 0.0 - dy)
 )
 foreach(item allInsts
   inst = car(item)
   inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
 )
 foreach(item allInsts
   inst = car(item)
   matchesTarget = nil
   foreach(target targetInsts
     when(inst~>libName == car(target)~>libName && inst~>cellName == car(target)~>cellName
       matchesTarget = t
     )
   )
   when(matchesTarget
     bBox = paMosaicBBox(item)
     verificationRect = dbCreateRect(cv list("M1" "pin") bBox)
     when(verificationRect
       dbReplaceProp(verificationRect "pixelArrayVerification" "boolean" t)
     )
   )
 )
 dbSave(cv)
  }}
  when(cv dbClose(cv))
 )
 printf("\\nPixel Array Generation Complete!\\n")
 )
)
createPixelArray()
""")

    # =========================================================
    # Write file
    # =========================================================
    try:
        with open(SKILL_FILE, "w") as fp:
            fp.write("\n".join(skill))
        print(f"\nGenerated : {SKILL_FILE}")
        print("ROV       :", rov_purpose)
        print("COLS      :", total_cols)
        print("ROW TYPES :", len(rows))
        print("Done successfully.")
    except Exception as e:
        print(f"Error writing to file {SKILL_FILE}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
