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

        ; Find the master cell physical bounding box
        cbBBox = master~>bBox
        c_llx = caar(cbBBox)
        c_lly = cadar(cbBBox)
        c_urx = caadr(cbBBox)
        c_ury = cadadr(cbBBox)
        
        ; Calculate the 4 insets of the target layer relative to the master cell bounds
        inset_left   = llx - c_llx
        inset_bottom = lly - c_lly
        inset_right  = c_urx - urx
        inset_top    = c_ury - ury
        
        printf("  Master Cell bBox: [%L, %L] - [%L, %L]\\n" c_llx c_lly c_urx c_ury)
        printf("  Layer Insets: L=%L B=%L R=%L T=%L\\n" inset_left inset_bottom inset_right inset_top)

        ; ---------------------------------------------------------------
        ; ORIENTATION-AWARE MOSAIC INSET ALGORITHM
        ;
        ; We take the physical bounding box of the mosaic instance and mathematically
        ; inset it by the exact offsets calculated from the master cell.
        ; ---------------------------------------------------------------
        mBBox = maxActiveInst~>bBox
        m_llx = caar(mBBox)
        m_lly = cadar(mBBox)
        m_urx = caadr(mBBox)
        m_ury = cadadr(mBBox)
        
        orient = maxActiveInst~>orient
        unless(orient orient = "R0")
        
        ; Map insets to the mosaic bounds based on orientation
        case(orient
          ("R0"
            layer_left   = m_llx + inset_left
            layer_right  = m_urx - inset_right
            layer_bottom = m_lly + inset_bottom
            layer_top    = m_ury - inset_top
          )
          ("R90"
            layer_left   = m_llx + inset_top
            layer_right  = m_urx - inset_bottom
            layer_bottom = m_lly + inset_left
            layer_top    = m_ury - inset_right
          )
          ("R180"
            layer_left   = m_llx + inset_right
            layer_right  = m_urx - inset_left
            layer_bottom = m_lly + inset_top
            layer_top    = m_ury - inset_bottom
          )
          ("R270"
            layer_left   = m_llx + inset_bottom
            layer_right  = m_urx - inset_top
            layer_bottom = m_lly + inset_right
            layer_top    = m_ury - inset_left
          )
          ("MY"
            layer_left   = m_llx + inset_right
            layer_right  = m_urx - inset_left
            layer_bottom = m_lly + inset_bottom
            layer_top    = m_ury - inset_top
          )
          ("MX"
            layer_left   = m_llx + inset_left
            layer_right  = m_urx - inset_right
            layer_bottom = m_lly + inset_top
            layer_top    = m_ury - inset_bottom
          )
          ("MYR90"
            layer_left   = m_llx + inset_top
            layer_right  = m_urx - inset_bottom
            layer_bottom = m_lly + inset_right
            layer_top    = m_ury - inset_left
          )
          ("MXR90"
            layer_left   = m_llx + inset_bottom
            layer_right  = m_urx - inset_top
            layer_bottom = m_lly + inset_left
            layer_top    = m_ury - inset_right
          )
          (t
            printf("WARNING: Unknown orientation %s, assuming R0\\n" orient)
            layer_left   = m_llx + inset_left
            layer_right  = m_urx - inset_right
            layer_bottom = m_lly + inset_bottom
            layer_top    = m_ury - inset_top
          )
        )
        
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

    ; --- Rotations applied during creation ---

    dbSave(cv)
  `);
}
