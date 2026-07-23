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

EXCEL_FILE = "array_pixel.xlsx"
SKILL_FILE = "pixel_array.il"

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
    if n == 'c1' or 'active' in n or 'active' in p or p == 'act' or n == 'act' or (p == 'c1' and 'blc' not in n): return 'active'
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
    skill = []

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
        x_pitch = float(get_parameter(tmpl, "x pitch"))
        y_pitch = float(get_parameter(tmpl, "y pitch"))
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
    print("Center  :", f"{center_layer} {center_purpose}")

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
                total_cols = int(float(val))
                found_col_num = True
                break
            except:
                pass

    # If not found on same row, check subsequent rows
    if not found_col_num:
        for r in range(cr + 1, min(cr + 20, tmpl.shape[0])):
            value = norm(tmpl.iat[r, cc])
            if value == "":
                continue
            try:
                total_cols = int(float(value))

                found_col_num = True
                break
            except Exception as e:
                pass



    if total_cols is None:
        raise RuntimeError("Failed to get TOTAL_COLS.")

    print("TOTAL_COLS =", total_cols)
    
    # =========================================================
    # Parse row_num table
    # =========================================================
    row_pos = find_keyword(tmpl, "row_num")
    if row_pos is None:
        raise RuntimeError("Cannot find row_num table.")

    rr, rc = row_pos
    rows = []
    rov_purpose = None

    def parse_segments_string(txt, default_purpose='dummy'):
        if not txt:
            return []
        parts = txt.split(',')
        segs = []
        for part in parts:
            clean = part.strip()
            if not clean:
                continue
            if clean.isdigit():
                cols = int(clean)
                if cols > 0:
                    segs.append({"purpose": default_purpose, "cols": cols})
            else:
                m = re.match(r"^([a-zA-Z0-9_]+):(\d+)$", clean)
                if m:
                    purp = m.group(1).strip().lower()
                    cols = int(m.group(2))
                    if cols > 0:
                        segs.append({"purpose": purp, "cols": cols})
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
            row_count = int(float(row_count_txt))
        except:
            r += 1
            continue

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
        for c in range(rc + 1, min(rc + 10, tmpl.shape[1])):
            marker = norm(tmpl.iat[r, c]).upper()
            if marker == "ROV":
                rov_purpose = purpose

        r += 1

    if rov_purpose is None:
        raise RuntimeError("ROV marker not found in rows table.")

    print("ROV PURPOSE =", rov_purpose)

    # =========================================================
    # Validate purpose names & auto-populate missing cells
    # =========================================================
    for row in reversed(rows):
        purpose = row["purpose"].lower()
        if purpose not in cell_map:
            cell_map[purpose] = {
                "lib": "pixel_lib",
                "cell": f"cell_{purpose}",
                "rot": "R0"
            }

        # Also check segments
        for seg in row.get("segments", []):
            seg_purp = seg["purpose"].lower()
            if seg_purp not in cell_map:
                cell_map[seg_purp] = {
                    "lib": "pixel_lib",
                    "cell": f"cell_{seg_purp}",
                    "rot": "R0"
                }

    # =========================================================
    # Generate SKILL Content
    # =========================================================
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
    skill.append(" ))")

    skill.append(f"""
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

 unwindProtect(
  {{
   ; Clear any existing instances to avoid duplicates
   when(
      cv
      foreach(inst cv~>instances
         dbDeleteObject(inst)
      )
   )

   currentY = 0
   allInsts = nil
""")

    # Create rows
    # Identify the true active block with the maximum row count
    active_rows = [r for r in rows if get_row_category(r["purpose"], r.get("name", ""), rov_purpose) == 'active']
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
  ; --- Creating {row_name} Rows ---
  printf(
   "Creating {row_name} (purpose: {purpose}) rows={row_count} y=%L\\n"
   currentY
  )
""")

        if len(segments) == 0:
            cell_info = cell_map[purpose.lower()]
            skill.append(f"""
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

  inst = dbCreateSimpleMosaic(
        cv
        master
        "{mosaic_name}"
        list(0.0 0.0)
        "R180"
        {row_count}
        {total_cols}
        {y_pitch}
        {x_pitch}
  )
  unless(inst
   inst = dbCreateMosaic(
         cv
         master
         "{mosaic_name}"
         list(0.0 0.0)
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
     dx = {total_cols} * {x_pitch}
     dy = currentY + ({row_count} * {y_pitch})
     inst~>xy = list(dx dy)
  )

  allInsts =
    cons(
       list(inst "R180")
       allInsts
    )
""")
            if purpose.lower() == rov_purpose.lower() and row == max_active_row:
                skill.append("""
  printf("ACTIVE MOSAIC FOUND\\n")
  maxActiveInst = inst
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
                skill.append(f"""
  ; Segment {s_idx + 1}: {seg_purpose} (cols={seg_cols})
  master =
   dbOpenCellViewByType(
      "{seg_cell_info["lib"]}"
      "{seg_cell_info["cell"]}"
      "layout"
      "maskLayout"
      "r"
   )

  when(
     master == nil
     error(
      "Cannot open master {seg_cell_info["cell"]}\\n"
     )
  )

  inst = dbCreateSimpleMosaic(
        cv
        master
        "{seg_mosaic_name}"
        list(0.0 0.0)
        "R180"
        {row_count}
        {seg_cols}
        {y_pitch}
        {x_pitch}
  )
  unless(inst
   inst = dbCreateMosaic(
         cv
         master
         "{seg_mosaic_name}"
         list(0.0 0.0)
         "R180"
         {row_count}
         {seg_cols}
         {y_pitch}
         {x_pitch}
  )
  )

  when(
     inst == nil
     error(
      "Failed creating segment {seg_purpose}\\n"
     )
  )

  when(inst
     dx = {curr_seg_x:.4f} + ({seg_cols} * {x_pitch})
     dy = currentY + ({row_count} * {y_pitch})
     inst~>xy = list(dx dy)
  )

  allInsts =
    cons(
       list(inst "R180")
       allInsts
    )
""")
                if seg_purpose.lower() == rov_purpose.lower() and row == max_active_row:
                    skill.append("""
  printf("ACTIVE SEGMENT MOSAIC FOUND\\n")
  maxActiveInst = inst
""")
                curr_seg_x += seg_cols * x_pitch

        skill.append(f" currentY = currentY + ({row_count} * {y_pitch})")

    # Calculate true geometric center of the ROV active block
    first_active_idx = -1
    last_active_idx = -1
    for i, r in enumerate(rows):
        is_act = get_row_category(r["purpose"], r.get("name", ""), rov_purpose) in ("active", "rov")
        if is_act:
            if first_active_idx == -1:
                first_active_idx = i
            last_active_idx = i

    left_cols = 0
    active_cols = total_cols
    
    # Strictly find the exact ROV segment to ignore paddings
    rov_row = None
    for r in rows:
        if r.get("segments") and any(s["purpose"].lower() == rov_purpose.lower() for s in r["segments"]):
            rov_row = r
            break
            
    if rov_row:
        segments = rov_row["segments"]
        active_seg_idx = -1
        for s_idx, seg in enumerate(segments):
            if seg["purpose"].lower() == rov_purpose.lower():
                active_seg_idx = s_idx
                break
        if active_seg_idx != -1:
            left_cols = sum(seg["cols"] for seg in segments[:active_seg_idx])
            active_cols = segments[active_seg_idx]["cols"]
    elif first_active_idx != -1:
        first_active_row = rows[first_active_idx]
        segments = first_active_row.get("segments", [])
        if segments:
            active_seg_idx = -1
            for s_idx, seg in enumerate(segments):
                if get_row_category(seg["purpose"], "", rov_purpose) in ("active", "rov"):
                    active_seg_idx = s_idx
                    break
            if active_seg_idx != -1:
                left_cols = sum(seg["cols"] for seg in segments[:active_seg_idx])
                active_cols = segments[active_seg_idx]["cols"]

    target_dx = - (left_cols + active_cols / 2.0) * x_pitch

    max_active_idx = -1
    max_rows = 0
    for i, r in enumerate(rows):
        is_act = get_row_category(r["purpose"], r.get("name", ""), rov_purpose) in ("active", "rov")
        if is_act and r["rows"] > max_rows:
            max_rows = r["rows"]
            max_active_idx = i

    start_y_rows = 0
    end_y_rows = 0
    if max_active_idx != -1:
        for i in range(max_active_idx + 1, len(rows)):
            start_y_rows += rows[i]["rows"]
        end_y_rows = start_y_rows + rows[max_active_idx]["rows"]
        
        target_dy = - (start_y_rows + end_y_rows) / 2.0 * y_pitch
    else:
        target_dy = - (sum(r["rows"] for r in rows) / 2.0) * y_pitch

    # Center Array at (0, 0)
    skill.append(f"""
 printf("\\nFinding Global Array Center...\\n")
 if(maxActiveInst then
   c_layer = "{center_layer}"
   c_purp  = "{center_purpose}"

   ; Open the master cell of the active (ROV) mosaic
   master = dbOpenCellViewByType(
     maxActiveInst~>libName
     maxActiveInst~>cellName
     "layout" "maskLayout" "r"
   )

   ; ---------------------------------------------------------------
   ; LAYER BBOX EXTRACTION via dbShapeQuery
   ; 
   ; We use Cadence's native dbShapeQuery to rapidly find all shapes
   ; on the target layer in the master cell up to 32 levels deep.
   ; ---------------------------------------------------------------
   shapes = dbShapeQuery(master list(c_layer c_purp) master~>bBox 0 32)
   llx = 1e6 lly = 1e6 urx = -1e6 ury = -1e6
   
   foreach(path shapes
     if(listp(path) then
       sh = car(last(path))
       shBox = sh~>bBox
       ; Safely transform the shape's local bBox up the hierarchy to the master cell
       foreach(item reverse(path)
         if(item~>objType == "inst" then
           shBox = dbTransformBBox(shBox item~>transform)
         )
       )
     else
       sh = path
       shBox = sh~>bBox
     )
     
     ; Filter by polygon/rect/path to avoid weird layer artifacts, as requested
     if(shBox && (sh~>objType == "polygon" || sh~>objType == "rect" || sh~>objType == "path") then
       llx = min(llx caar(shBox))
       lly = min(lly cadar(shBox))
       urx = max(urx caadr(shBox))
       ury = max(ury cadadr(shBox))
     )
   )
   
   local_bBox = nil
   if(llx < 1e5 then
     local_bBox = list(list(llx lly) list(urx ury))
   )

   if(local_bBox then
     printf("  SUCCESS: Found target layer '%s %s' bBox via dbShapeQuery: %L\\n" c_layer c_purp local_bBox)
     llx = caar(local_bBox)
     lly = cadar(local_bBox)
     urx = caadr(local_bBox)
     ury = cadadr(local_bBox)

     ; ---------------------------------------------------------------
     ; Calculate Mosaic Target Layer bBox EXACTLY using instance transforms
     ; This bypasses any master~>bBox inaccuracies (e.g. text labels)
     ; ---------------------------------------------------------------
     orient = maxActiveInst~>orient
     unless(orient orient = "R0")
     
     m_cols = maxActiveInst~>columns
     unless(m_cols m_cols = 1)
     m_rows = maxActiveInst~>rows
     unless(m_rows m_rows = 1)
     
     uX = maxActiveInst~>uX
     unless(uX uX = 0.0)
     uY = maxActiveInst~>uY
     unless(uY uY = 0.0)
     
     ; --- Diagnostic Printf for the user's reference ---
     trans_diag = list(list(0.0 0.0) orient 1.0)
     rot_local_raw = dbTransformBBox(local_bBox trans_diag)
     llx_rot = min(caar(rot_local_raw) caadr(rot_local_raw))
     urx_rot = max(caar(rot_local_raw) caadr(rot_local_raw))
     lly_rot = min(cadar(rot_local_raw) cadadr(rot_local_raw))
     ury_rot = max(cadar(rot_local_raw) cadadr(rot_local_raw))
     rot_local_diag = list(list(llx_rot lly_rot) list(urx_rot ury_rot))
     printf("  Local Layer bBox (rotated to %s and normalized): %L\\n" orient rot_local_diag)
     ; ---------------------------------------------------
     
     ; Calculate the 4 corner points of the local unrotated grid
     pt_00 = list(0.0 0.0)
     pt_c0 = list((m_cols - 1) * uX 0.0)
     pt_0r = list(0.0 (m_rows - 1) * uY)
     pt_cr = list((m_cols - 1) * uX (m_rows - 1) * uY)
     
     xy_0 = maxActiveInst~>xy
     
     ; Transform them to absolute top-cell coordinates using the mosaic's transform
     xy_00 = dbTransformPoint(pt_00 list(xy_0 orient 1.0))
     xy_c0 = dbTransformPoint(pt_c0 list(xy_0 orient 1.0))
     xy_0r = dbTransformPoint(pt_0r list(xy_0 orient 1.0))
     xy_cr = dbTransformPoint(pt_cr list(xy_0 orient 1.0))
     
     ; Transform the target layer bounding box to each of the 4 extreme instances
     bB_00 = dbTransformBBox(local_bBox list(xy_00 orient 1.0))
     bB_c0 = dbTransformBBox(local_bBox list(xy_c0 orient 1.0))
     bB_0r = dbTransformBBox(local_bBox list(xy_0r orient 1.0))
     bB_cr = dbTransformBBox(local_bBox list(xy_cr orient 1.0))
     
     ; The global target layer bounds are the absolute minimum and maximum across all 4 corners!
     layer_left   = min(caar(bB_00) caar(bB_c0) caar(bB_0r) caar(bB_cr) caadr(bB_00) caadr(bB_c0) caadr(bB_0r) caadr(bB_cr))
     layer_right  = max(caar(bB_00) caar(bB_c0) caar(bB_0r) caar(bB_cr) caadr(bB_00) caadr(bB_c0) caadr(bB_0r) caadr(bB_cr))
     layer_bottom = min(cadar(bB_00) cadar(bB_c0) cadar(bB_0r) cadar(bB_cr) cadadr(bB_00) cadadr(bB_c0) cadadr(bB_0r) cadadr(bB_cr))
     layer_top    = max(cadar(bB_00) cadar(bB_c0) cadar(bB_0r) cadar(bB_cr) cadadr(bB_00) cadadr(bB_c0) cadadr(bB_0r) cadadr(bB_cr))
     
     layer_bBox = list(list(layer_left layer_bottom) list(layer_right layer_top))
     printf("  Mosaic Array EXACT target layer bBox: %L\\n" layer_bBox)
     
     ; ---------------------------------------------------------------
     ; Align the left-bottom of the layer to the ideal centered left-bottom
     ; (Implementing user's specific alignment logic)
     ; ---------------------------------------------------------------
     layer_width  = layer_right - layer_left
     layer_height = layer_top - layer_bottom
     
     ideal_llx = 0.0 - (layer_width / 2.0)
     ideal_lly = 0.0 - (layer_height / 2.0)
     
     dx = ideal_llx - layer_left
     dy = ideal_lly - layer_bottom
     
     printf("  Layer actual left-bottom: %L, %L\\n" layer_left layer_bottom)
     printf("  Layer ideal left-bottom for centering: %L, %L\\n" ideal_llx ideal_lly)
     printf("  Shift required: dx=%L dy=%L\\n" dx dy)
     dbClose(master)

   else
     ; Layer not found — fall back to bBox center of the mosaic
     printf("WARNING: Layer '%s %s' not found in '%s'. Using mosaic bBox center.\\n" c_layer c_purp maxActiveInst~>cellName)
     mBBox = maxActiveInst~>bBox
     cx = (caar(mBBox) + caadr(mBBox)) / 2.0
     cy = (cadar(mBBox) + cadadr(mBBox)) / 2.0
     dx = 0.0 - cx
     dy = 0.0 - cy
     dbClose(master)
   )
 else
   ; No active mosaic found — use pre-computed mathematical fallback
   dx = - ({total_cols} / 2.0) * {x_pitch}
   dy = {target_dy:.4f}
   printf("No active mosaic. Fallback center: cx=%L cy=%L\\n" 0.0 - dx 0.0 - dy)
 )
 printf("Shifting all instances by dx=%L dy=%L\\n" dx dy)

 foreach(
   item
   allInsts

   inst = car(item)
   inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
 )

 ; ---------------------------------------------------------------
 ; VERIFICATION RECTANGLE
 ; ---------------------------------------------------------------
 if(boundp('layer_left) && layer_left then
   v_llx = layer_left + dx
   v_lly = layer_bottom + dy
   v_urx = layer_right + dx
   v_ury = layer_top + dy
   dbCreateRect(cv list("M1" "pin") list(list(v_llx v_lly) list(v_urx v_ury)))
   printf("  Drew verification rectangle on 'M1' 'pin' covering all target layers in the array: [%L, %L] - [%L, %L]\\n" v_llx v_lly v_urx v_ury)
 )
 
 ; --- Rotations applied during creation ---

 dbSave(cv)
  }}
  when(cv
     dbClose(cv)
  )
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
