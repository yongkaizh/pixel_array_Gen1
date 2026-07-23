import { LayoutConfig } from "../../types";
import { getRowCategory } from "../../math/grid";
import { SkillBuilder } from "./SkillBuilder";

// ---------------------------------------------------------------------------
// Fallback center computation (TypeScript side)
// Used when no active mosaic instance is identified at SKILL runtime.
// ---------------------------------------------------------------------------
function computeFallbackCenter(config: LayoutConfig): { dx: number; dy: number } {
  let maxActiveIdx = -1;
  let maxRows = 0;
  config.rows.forEach((row, idx) => {
    const cat = getRowCategory(row.purpose, row.name ?? "", config.rov_purpose);
    const isAct = cat === "active" || cat === "rov";
    if (isAct && row.rows > maxRows) {
      maxRows = row.rows;
      maxActiveIdx = idx;
    }
  });

  let startY_rows = 0;
  let endY_rows = 0;
  if (maxActiveIdx !== -1) {
    for (let i = maxActiveIdx + 1; i < config.rows.length; i++) {
      startY_rows += config.rows[i].rows;
    }
    endY_rows = startY_rows + config.rows[maxActiveIdx].rows;
  }

  const totalRows = config.rows.reduce((s, r) => s + r.rows, 0);
  return {
    dx: -(config.total_cols / 2.0) * config.x_pitch,
    dy:
      maxActiveIdx !== -1
        ? -((startY_rows + endY_rows) / 2.0) * config.y_pitch
        : -(totalRows / 2.0) * config.y_pitch,
  };
}

// ---------------------------------------------------------------------------
// SKILL code generator
// ---------------------------------------------------------------------------
export function generateCentering(builder: SkillBuilder, config: LayoutConfig): void {
  const cLayer  = config.center_layer  || "BDTID";
  const cPurp   = config.center_purpose || "drawing";
  const { x_pitch, y_pitch } = config;
  const fallback = computeFallbackCenter(config);

  builder.append(`
    ; --- Center Array at (0, 0) based on target layer ---
    printf("\\nFinding Global Array Center...\\n")
    if(maxActiveInst then
      c_layer = "${cLayer}"
      c_purp  = "${cPurp}"

      ; Open the master cell of the active (ROV) mosaic
      master = dbOpenCellViewByType(
        maxActiveInst~>libName
        maxActiveInst~>cellName
        "layout" "maskLayout" "r"
      )

      layerShapes = setof(sh master~>shapes
        (sh~>layerName == c_layer && sh~>purpose == c_purp)
      )

      if(layerShapes then
        ; Collect the bounding box of all matching shapes in local (master cell) space
        llx = 1e6  lly = 1e6  urx = -1e6  ury = -1e6
        foreach(sh layerShapes
          llx = min(llx caar(sh~>bBox))
          lly = min(lly cadar(sh~>bBox))
          urx = max(urx caadr(sh~>bBox))
          ury = max(ury cadadr(sh~>bBox))
        )

        ; Shape bounding box in local (master cell) coordinate space
        local_bBox = list(list(llx lly) list(urx ury))
        printf("  Layer '%s %s' local bBox: %L\\n" c_layer c_purp local_bBox)

        ; ---------------------------------------------------------------
        ; NATIVE CELLVIEW BBOX TRANSFER ALGORITHM
        ;
        ; We calculate the center by transferring the layer's local bBox
        ; directly into the current (top-level) cellview using Cadence's
        ; native geometric transformation engine (dbTransformBBox).
        ;
        ; This perfectly handles R180 offset behaviors idiomaticaly and 
        ; ignores any stray shapes outside the target layer.
        ; ---------------------------------------------------------------
        gx = car(maxActiveInst~>xy)
        gy = cadr(maxActiveInst~>xy)
        cols = maxActiveInst~>columns
        rows = maxActiveInst~>rows
        
        uX = maxActiveInst~>uX
        uY = maxActiveInst~>uY
        orient = maxActiveInst~>orient
        unless(orient orient = "R180")
        
        ; Transform layer bBox for the (0,0) mosaic cell
        transform_0 = list(list(gx gy) orient 1.0)
        bBox_0 = dbTransformBBox(local_bBox transform_0)
        
        ; Transform layer bBox for the (cols-1, rows-1) mosaic cell
        gx_end = gx + (cols - 1) * uX
        gy_end = gy + (rows - 1) * uY
        transform_end = list(list(gx_end gy_end) orient 1.0)
        bBox_end = dbTransformBBox(local_bBox transform_end)
        
        ; Determine the absolute total bounds of the layer in the top cell
        global_llx = min(caar(bBox_0) caar(bBox_end))
        global_lly = min(cadar(bBox_0) cadar(bBox_end))
        global_urx = max(caadr(bBox_0) caadr(bBox_end))
        global_ury = max(cadadr(bBox_0) cadadr(bBox_end))
        
        cx = (global_llx + global_urx) / 2.0
        cy = (global_lly + global_ury) / 2.0
        
        dx = 0.0 - cx
        dy = 0.0 - cy
        
        printf("  Mosaic Grid: Origin=(%L, %L) Cols=%L Rows=%L uX=%L uY=%L\\n" gx gy cols rows uX uY)
        printf("  Layer center in array: cx=%L cy=%L\\n" cx cy)
        printf("  Shift: dx=%L dy=%L\\n" dx dy)
        dbClose(master)

      else
        ; Layer not found — fall back to the physical bBox center of the mosaic
        printf("WARNING: Layer '%s %s' not found in '%s'. Using mosaic bBox center.\\n"
          c_layer c_purp maxActiveInst~>cellName)
        mBBox = maxActiveInst~>bBox
        cx = (caar(mBBox) + caadr(mBBox)) / 2.0
        cy = (cadar(mBBox) + cadadr(mBBox)) / 2.0
        dx = 0.0 - cx
        dy = 0.0 - cy
        dbClose(master)
      )

    else
      ; No active mosaic instance found — use pre-computed mathematical fallback
      dx = ${fallback.dx.toFixed(4)}
      dy = ${fallback.dy.toFixed(4)}
      printf("Fallback mathematical center: cx=%L cy=%L\\n" 0.0 - dx 0.0 - dy)
    )

    printf("Shifting all instances by dx=%L dy=%L\\n" dx dy)

    foreach(item allInsts
      inst = car(item)
      inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
    )

    ; --- Rotations applied during creation ---

    dbSave(cv)
  `);
}
