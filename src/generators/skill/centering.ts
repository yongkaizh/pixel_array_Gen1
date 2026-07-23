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
        ; PRECISE BBOX PROJECTION ALGORITHM
        ;
        ; We completely bypass maxActiveInst~>bBox because Cadence's
        ; mosaic bounding boxes are often bloated by grid snapping or
        ; invisible cell properties. Instead, we mathematically project the 
        ; exact layer bounds across the array pitch to get perfect bounds.
        ; ---------------------------------------------------------------
        gx = car(maxActiveInst~>xy)
        gy = cadr(maxActiveInst~>xy)
        cols = maxActiveInst~>columns
        rows = maxActiveInst~>rows
        uX = maxActiveInst~>uX
        uY = maxActiveInst~>uY
        
        orient = maxActiveInst~>orient
        unless(orient orient = "R0")
        
        ; Project the exact layer bBox to the first cell (0,0)
        transform_0 = list(list(gx gy) orient 1.0)
        bBox_0 = dbTransformBBox(local_bBox transform_0)
        
        ; Calculate step vectors for the (cols-1, rows-1) mosaic cell, respecting grid rotation!
        col_step = (cols - 1) * uX
        row_step = (rows - 1) * uY
        
        case(orient
          ("R0"
            gx_end = gx + col_step
            gy_end = gy + row_step
          )
          ("R90"
            gx_end = gx - row_step
            gy_end = gy + col_step
          )
          ("R180"
            gx_end = gx - col_step
            gy_end = gy - row_step
          )
          ("R270"
            gx_end = gx + row_step
            gy_end = gy - col_step
          )
          ("MY"
            gx_end = gx - col_step
            gy_end = gy + row_step
          )
          ("MX"
            gx_end = gx + col_step
            gy_end = gy - row_step
          )
          ("MYR90"
            gx_end = gx - row_step
            gy_end = gy - col_step
          )
          ("MXR90"
            gx_end = gx + row_step
            gy_end = gy + col_step
          )
          (t
            gx_end = gx + col_step
            gy_end = gy + row_step
          )
        )
        
        ; Project the exact layer bBox to the last cell (cols-1, rows-1)
        transform_end = list(list(gx_end gy_end) orient 1.0)
        bBox_end = dbTransformBBox(local_bBox transform_end)
        
        ; The absolute precise bounds of the target layer across the array
        layer_left   = min(caar(bBox_0) caar(bBox_end))
        layer_bottom = min(cadar(bBox_0) cadar(bBox_end))
        layer_right  = max(caadr(bBox_0) caadr(bBox_end))
        layer_top    = max(cadadr(bBox_0) cadadr(bBox_end))
        
        ; Explicitly construct the calculated target layer bounding box
        layer_bBox = list(list(layer_left layer_bottom) list(layer_right layer_top))
        printf("  Mosaic Array precise target layer bBox: %L\\n" layer_bBox)
        
        ; Calculate final center from the explicit layer_bBox
        cx = (layer_left + layer_right) / 2.0
        cy = (layer_bottom + layer_top) / 2.0
        
        dx = 0.0 - cx
        dy = 0.0 - cy
        
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
  `);
}
