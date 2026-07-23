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
        ; Calculate Mosaic Target Layer bBox using L, R, B, T margins
        ; ---------------------------------------------------------------
        orient = maxActiveInst~>orient
        unless(orient orient = "R0")
        
        uBBox = master~>bBox
        u_llx = caar(uBBox)
        u_lly = cadar(uBBox)
        u_urx = caadr(uBBox)
        u_ury = cadadr(uBBox)
        
        ; Margins from cell boundary to layer boundary in the master cell
        L_margin = llx - u_llx
        R_margin = u_urx - urx
        B_margin = lly - u_lly
        T_margin = u_ury - ury
        
        mBBox = maxActiveInst~>bBox
        m_llx = caar(mBBox)
        m_lly = cadar(mBBox)
        m_urx = caadr(mBBox)
        m_ury = cadadr(mBBox)
        
        ; Apply margins to the mosaic physical bounding box based on orientation
        case( orient
          ( "R0"
            layer_left   = m_llx + L_margin
            layer_right  = m_urx - R_margin
            layer_bottom = m_lly + B_margin
            layer_top    = m_ury - T_margin
          )
          ( "R90"
            layer_left   = m_llx + B_margin
            layer_right  = m_urx - T_margin
            layer_bottom = m_lly + R_margin
            layer_top    = m_ury - L_margin
          )
          ( "R180"
            layer_left   = m_llx + R_margin
            layer_right  = m_urx - L_margin
            layer_bottom = m_lly + T_margin
            layer_top    = m_ury - B_margin
          )
          ( "R270"
            layer_left   = m_llx + T_margin
            layer_right  = m_urx - B_margin
            layer_bottom = m_lly + L_margin
            layer_top    = m_ury - R_margin
          )
          ( "MY"
            layer_left   = m_llx + R_margin
            layer_right  = m_urx - L_margin
            layer_bottom = m_lly + B_margin
            layer_top    = m_ury - T_margin
          )
          ( "MX"
            layer_left   = m_llx + L_margin
            layer_right  = m_urx - R_margin
            layer_bottom = m_lly + T_margin
            layer_top    = m_ury - B_margin
          )
          ( "MYR90"
            layer_left   = m_llx + B_margin
            layer_right  = m_urx - T_margin
            layer_bottom = m_lly + L_margin
            layer_top    = m_ury - R_margin
          )
          ( "MXR90"
            layer_left   = m_llx + T_margin
            layer_right  = m_urx - B_margin
            layer_bottom = m_lly + R_margin
            layer_top    = m_ury - L_margin
          )
          ( t
            layer_left   = m_llx + L_margin
            layer_right  = m_urx - R_margin
            layer_bottom = m_lly + B_margin
            layer_top    = m_ury - T_margin
          )
        )
        
        layer_bBox = list(list(layer_left layer_bottom) list(layer_right layer_top))
        printf("  Mosaic Array target layer bBox (Margin calc): %L\\n" layer_bBox)
        
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
