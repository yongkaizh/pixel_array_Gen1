import { LayoutConfig } from "../../types";
import { getRowCategory } from "../../math/grid";
import { SkillBuilder } from "./SkillBuilder";

export function generateCentering(builder: SkillBuilder, config: LayoutConfig): void {
  // Calculate true geometric center of the ROV active block
  let firstActiveIdx = -1;
  let lastActiveIdx = -1;
  config.rows.forEach((row, idx) => {
    const isAct = getRowCategory(row.purpose, row.name || "", config.rov_purpose) === "active" || getRowCategory(row.purpose, row.name || "", config.rov_purpose) === "rov";
    if (isAct) {
      if (firstActiveIdx === -1) firstActiveIdx = idx;
      lastActiveIdx = idx;
    }
  });

  let left_cols = 0;
  let active_cols = config.total_cols;
  
  // Find the exact ROV segment by strictly matching rov_purpose to ignore paddings
  const rovRow = config.rows.find(r => r.segments && r.segments.some(s => s.purpose.toLowerCase() === config.rov_purpose.toLowerCase()));
  if (rovRow && rovRow.segments) {
    const activeSegIdx = rovRow.segments.findIndex(s => s.purpose.toLowerCase() === config.rov_purpose.toLowerCase());
    for (let i = 0; i < activeSegIdx; i++) {
      left_cols += rovRow.segments[i].cols;
    }
    active_cols = rovRow.segments[activeSegIdx].cols;
  } else if (firstActiveIdx !== -1) {
    // Fallback if no exact match
    const firstActiveRow = config.rows[firstActiveIdx];
    if (firstActiveRow.segments && firstActiveRow.segments.length > 0) {
      const activeSegIdx = firstActiveRow.segments.findIndex(s => getRowCategory(s.purpose, "", config.rov_purpose) === "active");
      if (activeSegIdx !== -1) {
        for (let i = 0; i < activeSegIdx; i++) {
          left_cols += firstActiveRow.segments[i].cols;
        }
        active_cols = firstActiveRow.segments[activeSegIdx].cols;
      }
    }
  }
  // With R180 rotation, the mosaic`s physical lower-left is at (origin.x - cols*xPitch, origin.y - rows*yPitch).
  // We place origin at (currSegX + segCols*xPitch, currentY + rows*yPitch) so LL lands at (currSegX, currentY).
  // For the centering calculation, the physical left edge of the ROV content is at:
  //   left_physical_x = left_cols * x_pitch
  // And the physical center X of the ROV content is:
  //   center_x = (left_cols + active_cols/2) * x_pitch
  // We want center_x + targetDx = 0, so targetDx = -(left_cols + active_cols/2) * x_pitch
  // BUT: since each mosaic origin is at (segCols*xPitch + currSegX), the actual content X range is
  //   [currSegX, currSegX + segCols*xPitch]
  // So the centering math below remains the same (left_cols in column units, active_cols in column units).
  const targetDx = - (config.total_cols / 2.0) * config.x_pitch;

  let startY_rows = 0;
  let endY_rows = 0;
  let maxActiveIdx = -1;
  let maxRows = 0;
  config.rows.forEach((row, idx) => {
    const isAct = getRowCategory(row.purpose, row.name || "", config.rov_purpose) === "active" || getRowCategory(row.purpose, row.name || "", config.rov_purpose) === "rov";
    if (isAct && row.rows > maxRows) {
      maxRows = row.rows;
      maxActiveIdx = idx;
    }
  });

  if (maxActiveIdx !== -1) {
    for (let i = maxActiveIdx + 1; i < config.rows.length; i++) {
      startY_rows += config.rows[i].rows;
    }
    endY_rows = startY_rows + config.rows[maxActiveIdx].rows;
  }

  const targetDy = (maxActiveIdx !== -1)
    ? - (startY_rows + endY_rows) / 2.0 * config.y_pitch
    : - (config.rows.reduce((sum, r) => sum + r.rows, 0) / 2.0) * config.y_pitch;

  builder.push("    ; --- Center Array at (0, 0) ---");
  builder.push("    printf(\"\\nFinding Global Array Center...\\n\")");
  builder.push("    if(maxActiveInst then");
  builder.push("      bBox = maxActiveInst~>bBox");
  builder.push("      cx = (caar(bBox) + caadr(bBox)) / 2.0");
  builder.push("      cy = (cadar(bBox) + cadadr(bBox)) / 2.0");
  builder.push("      dx = 0.0 - cx");
  builder.push("      dy = 0.0 - cy");
  builder.push("      printf(\"Max Active Array measured center: cx=%L cy=%L\\n\" cx cy)");
  builder.push("    else");
  builder.push(`      dx = ${targetDx.toFixed(4)}`);
  builder.push(`      dy = ${targetDy.toFixed(4)}`);
  builder.push("      printf(\"Fallback mathematical center: cx=%L cy=%L\\n\" 0.0 - dx 0.0 - dy)");
  builder.push("    )");
  builder.push("");
  builder.push("    printf(\"Shifting all parts by dx=%L dy=%L\\n\" dx dy)");
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
