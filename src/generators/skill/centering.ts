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
        ; 1. Calculate the robust physical bounding box of the mosaic's target layer
        ; We do this by evaluating the absolute placement of the 4 corner instances
        ; ---------------------------------------------------------------
        orient = maxActiveInst~>orient
        unless(orient orient = "R0")
        
        m_cols = maxActiveInst~>columns
        unless(m_cols m_cols = 1)
        m_rows = maxActiveInst~>rows
        unless(m_rows m_rows = 1)
        
        uX = maxActiveInst~>uX
        unless(uX uX = ${x_pitch})
        uY = maxActiveInst~>uY
        unless(uY uY = ${y_pitch})
        
        min_lx = 1e10
        min_ly = 1e10
        max_rx = -1e10
        max_ry = -1e10
        
        ; The 4 corner instance grid indices
        corners = list(
          list(0 0)
          list(m_cols - 1 0)
          list(0 m_rows - 1)
          list(m_cols - 1 m_rows - 1)
        )
        
        foreach(corner corners
          col = car(corner)
          row = cadr(corner)
          
          ; Calculate local placement offset of this instance in the mosaic
          local_pt = list(col * uX row * uY)
          
          ; Transform local placement to absolute global placement using the mosaic's origin and orientation
          global_pt = dbTransformPoint(local_pt list(maxActiveInst~>xy orient 1.0))
          
          ; Transform the master cell's target layer bBox to this instance's absolute placement
          inst_bBox = dbTransformBBox(local_bBox list(global_pt orient 1.0))
          
          if(caar(inst_bBox) < min_lx then min_lx = caar(inst_bBox))
          if(cadar(inst_bBox) < min_ly then min_ly = cadar(inst_bBox))
          if(caadr(inst_bBox) > max_rx then max_rx = caadr(inst_bBox))
          if(cadadr(inst_bBox) > max_ry then max_ry = cadadr(inst_bBox))
        )
        
        layer_left   = min_lx
        layer_bottom = min_ly
        layer_right  = max_rx
        layer_top    = max_ry
        
        ; Explicitly construct the calculated target layer bounding box
        layer_bBox = list(list(layer_left layer_bottom) list(layer_right layer_top))
        printf("  Mosaic Array target layer bBox (from robust 4-corner calculation): %L\\n" layer_bBox)
        
        ; ---------------------------------------------------------------
        ; Calculate center layer bBox of the mosaic via subtraction
        ; ---------------------------------------------------------------
        mosaic_layer_w = layer_right - layer_left
        mosaic_layer_h = layer_top - layer_bottom
        
        unit_layer_w = urx - llx
        unit_layer_h = ury - lly
        
        center_layer_left = layer_left + (mosaic_layer_w - unit_layer_w) / 2.0
        center_layer_bottom = layer_bottom + (mosaic_layer_h - unit_layer_h) / 2.0
        center_layer_right = center_layer_left + unit_layer_w
        center_layer_top = center_layer_bottom + unit_layer_h
        
        printf("  Center Layer bBox of the mosaic: [%L, %L] - [%L, %L]\\n" center_layer_left center_layer_bottom center_layer_right center_layer_top)
        
        ; Calculate final center
        cx = (center_layer_left + center_layer_right) / 2.0
        cy = (center_layer_bottom + center_layer_top) / 2.0
        
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
