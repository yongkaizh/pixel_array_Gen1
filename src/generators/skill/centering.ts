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
        ; This bypasses any master~>bBox inaccuracies (e.g. text labels or PR boundaries)
        ; ---------------------------------------------------------------
        ; Hardcoding "R180" because Cadence maxActiveInst~>orient can incorrectly report "R0"
        orient = "R180"
        
        m_cols = maxActiveInst~>columns
        m_rows = maxActiveInst~>rows
        uX = maxActiveInst~>uX
        unless(uX uX = 0.0)
        uY = maxActiveInst~>uY
        unless(uY uY = 0.0)
        
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
        
        printf("  Mosaic Array EXACT target layer bBox: [%L, %L] - [%L, %L]\\n" layer_left layer_bottom layer_right layer_top)
        
        layer_bBox = list(list(layer_left layer_bottom) list(layer_right layer_top))
        
        ; Calculate final center
        cx = (layer_left + layer_right) / 2.0
        cy = (layer_bottom + layer_top) / 2.0
        
        dx = 0.0 - cx
        dy = 0.0 - cy
        
        printf("  Mosaic bounds: [%L, %L] - [%L, %L] Orient: %s\\n" m_llx m_lly m_urx m_ury orient)
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
