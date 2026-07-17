import { LayoutConfig, RowConfig } from "../../types";
import { getRowCategory } from "../../math/grid";
import { SkillBuilder } from "./SkillBuilder";

export function findMaxActiveRow(config: LayoutConfig): RowConfig | null {
  let maxActiveRow: RowConfig | null = null;
  config.rows.forEach(row => {
    const isAct = getRowCategory(row.purpose, row.name || "", config.rov_purpose) === "active";
    if (isAct) {
      if (!maxActiveRow || row.rows > maxActiveRow.rows) {
        maxActiveRow = row;
      }
    }
  });
  return maxActiveRow;
}

export function generateMosaics(builder: SkillBuilder, config: LayoutConfig, maxActiveRow: RowConfig | null): void {
  const reversedRows = [...config.rows].reverse();
  reversedRows.forEach((row, rev_idx) => {
    const orig_idx = config.rows.length - 1 - rev_idx;
    const row_num = orig_idx + 1;
    const purpose = row.purpose;
    const rowName = row.name || purpose;

    const cleanPurpose = purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_");
    const mosaicName = `M${row_num}_${cleanPurpose}`;

    builder.push(`  ; --- Creating ${rowName} Rows ---`);
    builder.push("  printf(");
    builder.push(`    "Creating ${rowName} (purpose: ${purpose}) rows=${row.rows} y=%L\\n"`);
    builder.push("    currentY");
    builder.push("  )");
    builder.push("");

    if (!row.segments || row.segments.length === 0) {
      generateSimpleMosaic(builder, config, row, maxActiveRow, mosaicName);
    } else {
      generateSegmentedMosaic(builder, config, row, maxActiveRow, row_num, cleanPurpose);
    }

    builder.push(`    currentY = currentY + (${row.rows} * ${config.y_pitch})`);
    builder.push("");
  });
}

function generateSimpleMosaic(builder: SkillBuilder, config: LayoutConfig, row: RowConfig, maxActiveRow: RowConfig | null, mosaicName: string) {
  const purpose = row.purpose;
  const cellInfo = config.cell_map[purpose.toLowerCase()];
  builder.push("  master =");
  builder.push("    dbOpenCellViewByType(");
  builder.push(`      "${cellInfo.lib}"`);
  builder.push(`      "${cellInfo.cell}"`);
  builder.push("      \"layout\"");
  builder.push("      \"maskLayout\"");
  builder.push("      \"r\"");
  builder.push("    )");
  builder.push("");
  builder.push("  when(");
  builder.push("    master == nil");
  builder.push("    error(");
  builder.push(`      "Cannot open master ${cellInfo.cell}\\n"`);
  builder.push("    )");
  builder.push("  )");
  builder.push("");
  builder.push(`  inst = dbCreateSimpleMosaic(`);
  builder.push("    cv");
  builder.push("    master");
  builder.push(`    "${mosaicName}"`);
  builder.push("    list(0.0 0.0)");
  builder.push("    \"R180\"");
  builder.push(`    ${row.rows}`);
  builder.push(`    ${config.total_cols}`);
  builder.push(`    ${config.y_pitch}`);
  builder.push(`    ${config.x_pitch}`);
  builder.push("  )");
  builder.push("  unless(inst");
  builder.push(`    inst = dbCreateMosaic(`);
  builder.push("      cv");
  builder.push("      master");
  builder.push(`      "${mosaicName}"`);
  builder.push("      list(0.0 0.0)");
  builder.push("      \"R180\"");
  builder.push(`      ${row.rows}`);
  builder.push(`      ${config.total_cols}`);
  builder.push(`      ${config.y_pitch}`);
  builder.push(`      ${config.x_pitch}`);
  builder.push("    )");
  builder.push("  )");
  builder.push("");
  builder.push("  when(");
  builder.push("    inst == nil");
  builder.push("    error(");
  builder.push(`      "Failed creating ${purpose}\\n"`);
  builder.push("    )");
  builder.push("  )");
  builder.push("");
  builder.push("  when(inst");
  builder.push(`    dx = ${config.total_cols} * ${config.x_pitch}`);
  builder.push(`    dy = currentY + (${row.rows} * ${config.y_pitch})`);
  builder.push("    inst~>xy = list(dx dy)");
  builder.push("  )");
  builder.push("");
  builder.push("  allInsts =");
  builder.push("    cons(");
  builder.push("      list(inst \"R180\")");
  builder.push("      allInsts");
  builder.push("    )");
  builder.push("");
  
  const isRov = purpose.toLowerCase() === config.rov_purpose.toLowerCase();
  if (isRov && row === maxActiveRow) {
    builder.push("  printf(\"ACTIVE MOSAIC FOUND\\n\")");
    builder.push("  maxActiveInst = inst");
  }
}

function generateSegmentedMosaic(builder: SkillBuilder, config: LayoutConfig, row: RowConfig, maxActiveRow: RowConfig | null, row_num: number, cleanPurpose: string) {
  let currSegX = 0.0;
  row.segments!.forEach((seg, sIdx) => {
    const segPurpose = seg.purpose;
    const segCols = seg.cols;
    const cleanSegPurpose = segPurpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_");
    const segMosaicName = `M${row_num}_${cleanPurpose}_seg${sIdx + 1}_${cleanSegPurpose}`;
    
    let segCellInfo = config.cell_map[segPurpose.toLowerCase()];
    if (!segCellInfo) {
      segCellInfo = {
        name: segPurpose,
        lib: "pixel_lib",
        cell: `cell_${segPurpose}`,
        rot: "R0"
      };
    }

    builder.push(`  ; Segment ${sIdx + 1}: ${segPurpose} (cols=${segCols})`);
    builder.push("  master =");
    builder.push("    dbOpenCellViewByType(");
    builder.push(`      "${segCellInfo.lib}"`);
    builder.push(`      "${segCellInfo.cell}"`);
    builder.push("      \"layout\"");
    builder.push("      \"maskLayout\"");
    builder.push("      \"r\"");
    builder.push("    )");
    builder.push("");
    builder.push("  when(");
    builder.push("    master == nil");
    builder.push("    error(");
    builder.push(`      "Cannot open master ${segCellInfo.cell}\\n"`);
    builder.push("    )");
    builder.push("  )");
    builder.push("");
    builder.push(`  inst = dbCreateSimpleMosaic(`);
    builder.push("    cv");
    builder.push("    master");
    builder.push(`    "${segMosaicName}"`);
    builder.push("    list(0.0 0.0)");
    builder.push("    \"R180\"");
    builder.push(`    ${row.rows}`);
    builder.push(`    ${segCols}`);
    builder.push(`    ${config.y_pitch}`);
    builder.push(`    ${config.x_pitch}`);
    builder.push("  )");
    builder.push("  unless(inst");
    builder.push(`    inst = dbCreateMosaic(`);
    builder.push("      cv");
    builder.push("      master");
    builder.push(`      "${segMosaicName}"`);
    builder.push("      list(0.0 0.0)");
    builder.push("      \"R180\"");
    builder.push(`      ${row.rows}`);
    builder.push(`      ${segCols}`);
    builder.push(`      ${config.y_pitch}`);
    builder.push(`      ${config.x_pitch}`);
    builder.push("    )");
    builder.push("  )");
    builder.push("");
    builder.push("  when(");
    builder.push("    inst == nil");
    builder.push("    error(");
    builder.push(`      "Failed creating segment ${segPurpose}\\n"`);
    builder.push("    )");
    builder.push("  )");
    builder.push("");
    builder.push("  when(inst");
    builder.push(`    dx = ${currSegX.toFixed(4)} + (${segCols} * ${config.x_pitch})`);
    builder.push("    dy = currentY + (" + row.rows + " * " + config.y_pitch + ")");
    builder.push("    inst~>xy = list(dx dy)");
    builder.push("  )");
    builder.push("");
    builder.push("  allInsts =");
    builder.push("    cons(");
    builder.push("      list(inst \"R180\")");
    builder.push("      allInsts");
    builder.push("    )");
    builder.push("");
    
    const isRov = segPurpose.toLowerCase() === config.rov_purpose.toLowerCase();
    if (isRov && row === maxActiveRow) {
      builder.push("  printf(\"ACTIVE SEGMENT MOSAIC FOUND\\n\")");
      builder.push("  maxActiveInst = inst");
    }
    
    currSegX += segCols * config.x_pitch;
  });
}
