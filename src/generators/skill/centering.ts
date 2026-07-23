import { LayoutConfig } from "../../types";
import { getRowCategory } from "../../math/grid";
import { SkillBuilder } from "./SkillBuilder";

export function generateCentering(builder: SkillBuilder, config: LayoutConfig): void {
  // -----------------------------------------------------------------------
  // Fallback: pure mathematical center (used when maxActiveInst is nil)
  // -----------------------------------------------------------------------
  let maxActiveIdx = -1;
  let maxRows = 0;
  config.rows.forEach((row, idx) => {
    const isAct =
      getRowCategory(row.purpose, row.name || "", config.rov_purpose) === "active" ||
      getRowCategory(row.purpose, row.name || "", config.rov_purpose) === "rov";
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

  const targetDx = -(config.total_cols / 2.0) * config.x_pitch;
  const targetDy =
    maxActiveIdx !== -1
      ? -((startY_rows + endY_rows) / 2.0) * config.y_pitch
      : -(config.rows.reduce((sum, r) => sum + r.rows, 0) / 2.0) * config.y_pitch;

  // -----------------------------------------------------------------------
  // Generate SKILL centering block
  // -----------------------------------------------------------------------
  const cLayer = config.center_layer || "BDTID";
  const cPurp = config.center_purpose || "drawing";
  const xPitch = config.x_pitch;
  const yPitch = config.y_pitch;

  builder.push("    ; --- Center Array at (0, 0) based on target layer ---");
  builder.push("    printf(\"\\nFinding Global Array Center...\\n\")");
  builder.push("    if(maxActiveInst then");
  builder.push(`      c_layer = "${cLayer}"`);
  builder.push(`      c_purp  = "${cPurp}"`);
  builder.push("");
  builder.push("      ; Open the master cell of the active (ROV) mosaic");
  builder.push("      master = dbOpenCellViewByType(");
  builder.push("        maxActiveInst~>libName");
  builder.push("        maxActiveInst~>cellName");
  builder.push("        \"layout\" \"maskLayout\" \"r\"");
  builder.push("      )");
  builder.push("");
  builder.push("      layerShapes = setof(sh master~>shapes");
  builder.push("        (sh~>layerName == c_layer && sh~>purpose == c_purp)");
  builder.push("      )");
  builder.push("");
  builder.push("      if(layerShapes then");
  builder.push("        ; --- Collect the bounding box of all matching shapes in local (master) space ---");
  builder.push("        llx = 1e6  lly = 1e6  urx = -1e6  ury = -1e6");
  builder.push("        foreach(sh layerShapes");
  builder.push("          llx = min(llx caar(sh~>bBox))");
  builder.push("          lly = min(lly cadar(sh~>bBox))");
  builder.push("          urx = max(urx caadr(sh~>bBox))");
  builder.push("          ury = max(ury cadadr(sh~>bBox))");
  builder.push("        )");
  builder.push("");
  builder.push("        ; Shape center in local (master cell) coordinate space");
  builder.push("        xc_local = (llx + urx) / 2.0");
  builder.push("        yc_local = (lly + ury) / 2.0");
  builder.push("        printf(\"  Layer '%s %s' local center: xc=%L yc=%L\\n\" c_layer c_purp xc_local yc_local)");
  builder.push("");
  builder.push("        ; ---------------------------------------------------------------");
  builder.push("        ; CORRECT centering formula for R180 mosaics");
  builder.push("        ;");
  builder.push("        ; For an R180 tile with origin (ox,oy), a local point (lx,ly)");
  builder.push("        ; maps to parent space as: (ox-lx, oy-ly).");
  builder.push("        ;");
  builder.push("        ; The mosaic's physical bBox gives us the full spatial extent.");
  builder.push("        ; Using m_llx, m_urx and the cell pitch, we can derive:");
  builder.push("        ;");
  builder.push("        ;   Physical left-most  shape center = m_llx + (cell_W - xc_local)");
  builder.push("        ;   Physical right-most shape center = m_urx - xc_local");
  builder.push("        ;   Layer center X = average of these two");
  builder.push("        ;                 = (m_llx + m_urx + cell_W - 2*xc_local) / 2");
  builder.push("        ;");
  builder.push("        ; This is INVARIANT to whether uX is stored as positive or negative");
  builder.push("        ; by Cadence, making it robust for all mosaic configurations.");
  builder.push("        ; ---------------------------------------------------------------");
  builder.push("");
  builder.push("        mBBox = maxActiveInst~>bBox");
  builder.push("        m_llx = caar(mBBox)");
  builder.push("        m_lly = cadar(mBBox)");
  builder.push("        m_urx = caadr(mBBox)");
  builder.push("        m_ury = cadadr(mBBox)");
  builder.push(`        pitch_X = ${xPitch}`);
  builder.push(`        pitch_Y = ${yPitch}`);
  builder.push("");
  builder.push("        cx = (m_llx + m_urx + pitch_X - 2.0 * xc_local) / 2.0");
  builder.push("        cy = (m_lly + m_ury + pitch_Y - 2.0 * yc_local) / 2.0");
  builder.push("        dx = 0.0 - cx");
  builder.push("        dy = 0.0 - cy");
  builder.push("        printf(\"  Mosaic bBox: [%L,%L]-[%L,%L]\\n\" m_llx m_lly m_urx m_ury)");
  builder.push("        printf(\"  Layer center in array: cx=%L cy=%L\\n\" cx cy)");
  builder.push("        printf(\"  Shift: dx=%L dy=%L\\n\" dx dy)");
  builder.push("        dbClose(master)");
  builder.push("");
  builder.push("      else");
  builder.push("        ; Layer not found — fall back to physical bBox center of the mosaic");
  builder.push("        printf(\"WARNING: Layer '%s %s' not found in '%s'. Using mosaic bBox center.\\n\" c_layer c_purp maxActiveInst~>cellName)");
  builder.push("        mBBox = maxActiveInst~>bBox");
  builder.push("        cx = (caar(mBBox) + caadr(mBBox)) / 2.0");
  builder.push("        cy = (cadar(mBBox) + cadadr(mBBox)) / 2.0");
  builder.push("        dx = 0.0 - cx");
  builder.push("        dy = 0.0 - cy");
  builder.push("        dbClose(master)");
  builder.push("      )");
  builder.push("");
  builder.push("    else");
  builder.push("      ; No active mosaic instance found — use pre-computed mathematical fallback");
  builder.push(`      dx = ${targetDx.toFixed(4)}`);
  builder.push(`      dy = ${targetDy.toFixed(4)}`);
  builder.push("      printf(\"Fallback mathematical center: cx=%L cy=%L\\n\" 0.0 - dx 0.0 - dy)");
  builder.push("    )");
  builder.push("");
  builder.push("    printf(\"Shifting all instances by dx=%L dy=%L\\n\" dx dy)");
  builder.push("");
  builder.push("    foreach(item allInsts");
  builder.push("      inst = car(item)");
  builder.push("      inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)");
  builder.push("    )");
  builder.push("");
  builder.push("    ; --- Rotations applied during creation ---");
  builder.push("");
  builder.push("    dbSave(cv)");
}
