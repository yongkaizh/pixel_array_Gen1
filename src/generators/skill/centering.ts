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
        ; PURE GRID TRANSFORM ALGORITHM (INDEPENDENT OF MOSAIC BBOX)
        ;
        ; Find target layer bBox in cell (0,0) (bBox_0) and cell (cols-1, rows-1) (bBox_end)
        ; using grid pitch, cols, rows, and orient, then compute the big center layer bBox.
        ; ---------------------------------------------------------------
        gx = car(maxActiveInst~>xy)
        gy = cadr(maxActiveInst~>xy)
        cols = maxActiveInst~>columns
        rows = maxActiveInst~>rows
        uX = maxActiveInst~>uX
        uY = maxActiveInst~>uY
        
        orient = maxActiveInst~>orient
        unless(orient orient = "R0")
        
        ; Transform layer bBox for cell (0,0)
        transform_0 = list(list(gx gy) orient 1.0)
        bBox_0 = dbTransformBBox(local_bBox transform_0)
        
        ; Calculate opposite corner cell (cols-1, rows-1) position, respecting grid orientation
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
        
        ; Transform layer bBox for cell (cols-1, rows-1)
        transform_end = list(list(gx_end gy_end) orient 1.0)
        bBox_end = dbTransformBBox(local_bBox transform_end)
        
        ; Compute exact big center layer bBox across entire active array
        layer_left   = min(caar(bBox_0) caar(bBox_end))
        layer_bottom = min(cadar(bBox_0) cadar(bBox_end))
        layer_right  = max(caadr(bBox_0) caadr(bBox_end))
        layer_top    = max(cadadr(bBox_0) cadadr(bBox_end))
        
        layer_bBox = list(list(layer_left layer_bottom) list(layer_right layer_top))
        printf("  Big Array center layer bBox: %L\\n" layer_bBox)
        
        ; Calculate final center
        cx = (layer_left + layer_right) / 2.0
        cy = (layer_bottom + layer_top) / 2.0
        
        dx = 0.0 - cx
        dy = 0.0 - cy
        
        printf("  Big layer center in array: cx=%L cy=%L\\n" cx cy)
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

    printf("Initial shift: dx=%L dy=%L\\n" dx dy)

    foreach(item allInsts
      inst = car(item)
      inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
    )

    ; ---------------------------------------------------------------
    ; SECONDARY VERIFICATION & FINE-TUNING CONVERGENCE LOOP
    ; Re-reads active mosaic xy after shift and applies fine-tune
    ; adjustment if target layer center is not perfectly at (0, 0).
    ; ---------------------------------------------------------------
    if(boundp('local_bBox) && local_bBox then
      max_iter = 5
      iter = 0
      converged = nil
      
      while(iter < max_iter && !converged
        iter = iter + 1
        v_gx = car(maxActiveInst~>xy)
        v_gy = cadr(maxActiveInst~>xy)
        
        v_transform_0 = list(list(v_gx v_gy) orient 1.0)
        v_bBox_0 = dbTransformBBox(local_bBox v_transform_0)
        
        case(orient
          ("R0"    v_gx_end = v_gx + col_step v_gy_end = v_gy + row_step)
          ("R90"   v_gx_end = v_gx - row_step v_gy_end = v_gy + col_step)
          ("R180"  v_gx_end = v_gx - col_step v_gy_end = v_gy - row_step)
          ("R270"  v_gx_end = v_gx + row_step v_gy_end = v_gy - col_step)
          ("MY"    v_gx_end = v_gx - col_step v_gy_end = v_gy + row_step)
          ("MX"    v_gx_end = v_gx + col_step v_gy_end = v_gy - row_step)
          ("MYR90" v_gx_end = v_gx - row_step v_gy_end = v_gy - col_step)
          ("MXR90" v_gx_end = v_gx + row_step v_gy_end = v_gy + col_step)
          (t       v_gx_end = v_gx + col_step v_gy_end = v_gy + row_step)
        )
        
        v_transform_end = list(list(v_gx_end v_gy_end) orient 1.0)
        v_bBox_end = dbTransformBBox(local_bBox v_transform_end)
        
        l_left   = min(caar(v_bBox_0) caar(v_bBox_end))
        l_bottom = min(cadar(v_bBox_0) cadar(v_bBox_end))
        l_right  = max(caadr(v_bBox_0) caadr(v_bBox_end))
        l_top    = max(cadadr(v_bBox_0) cadadr(v_bBox_end))
        
        curr_cx = (l_left + l_right) / 2.0
        curr_cy = (l_bottom + l_top) / 2.0
        
        printf("  Verification Iteration %d: Current layer center at cx=%L cy=%L\\n" iter curr_cx curr_cy)
        
        if(abs(curr_cx) < 1e-4 && abs(curr_cy) < 1e-4 then
          converged = t
          printf("  SUCCESS: Target layer center is verified at (0.0, 0.0)!\\n")
          layer_left = l_left
          layer_bottom = l_bottom
          layer_right = l_right
          layer_top = l_top
        else
          fine_dx = 0.0 - curr_cx
          fine_dy = 0.0 - curr_cy
          printf("  Fine-tuning array position by dx=%L dy=%L...\\n" fine_dx fine_dy)
          foreach(item allInsts
            inst = car(item)
            inst~>xy = list(car(inst~>xy) + fine_dx cadr(inst~>xy) + fine_dy)
          )
          layer_left = l_left + fine_dx
          layer_bottom = l_bottom + fine_dy
          layer_right = l_right + fine_dx
          layer_top = l_top + fine_dy
        )
      )
    )

    ; ---------------------------------------------------------------
    ; VERIFICATION RECTANGLE
    ; ---------------------------------------------------------------
    if(boundp('layer_left) && layer_left then
      dbCreateRect(cv list("M1" "pin") list(list(layer_left layer_bottom) list(layer_right layer_top)))
      printf("  Drew verification rectangle on 'M1' 'pin' covering all target layers in the array: [%L, %L] - [%L, %L]\\n" layer_left layer_bottom layer_right layer_top)
    )

    ; --- Rotations applied during creation ---

    dbSave(cv)
  `);
}
