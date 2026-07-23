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
        
        xy_0 = maxActiveInst~>xy
        xy_last = list(car(xy_0) + (m_cols - 1) * uX cadr(xy_0) + (m_rows - 1) * uY)
        
        bBox_0 = dbTransformBBox(local_bBox list(xy_0 orient 1.0))
        bBox_last = dbTransformBBox(local_bBox list(xy_last orient 1.0))
        
        ; The global target layer bounds are the extremes of the first and last instance layer bounds!
        layer_left   = min(caar(bBox_0) caadr(bBox_0) caar(bBox_last) caadr(bBox_last))
        layer_right  = max(caar(bBox_0) caadr(bBox_0) caar(bBox_last) caadr(bBox_last))
        layer_bottom = min(cadar(bBox_0) cadadr(bBox_0) cadar(bBox_last) cadadr(bBox_last))
        layer_top    = max(cadar(bBox_0) cadadr(bBox_0) cadar(bBox_last) cadadr(bBox_last))
        
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
