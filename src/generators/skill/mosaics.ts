import { LayoutConfig, RowConfig, CellInfo } from "../../types";
import { getRowCategory } from "../../math/grid";
import { SkillBuilder } from "./SkillBuilder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the row with the most physical rows among "active" rows, or null. */
export function findMaxActiveRow(config: LayoutConfig): RowConfig | null {
  let maxRow: RowConfig | null = null;
  for (const row of config.rows) {
    if (getRowCategory(row.purpose, row.name ?? "", config.rov_purpose) === "active") {
      if (!maxRow || row.rows > maxRow.rows) maxRow = row;
    }
  }
  return maxRow;
}

/** Returns the CellInfo for a given purpose, creating a placeholder if missing. */
function cellInfoFor(config: LayoutConfig, purpose: string): CellInfo {
  return (
    config.cell_map[purpose.toLowerCase()] ?? {
      name: purpose,
      lib: "pixel_lib",
      cell: `cell_${purpose.toLowerCase()}`,
      rot: "R0",
    }
  );
}

// ---------------------------------------------------------------------------
// Top-level mosaic generator
// ---------------------------------------------------------------------------

export function generateMosaics(
  builder: SkillBuilder,
  config: LayoutConfig,
  maxActiveRow: RowConfig | null
): void {
  // Rows are placed bottom-to-top in the Cadence view, so we iterate reversed.
  const reversed = [...config.rows].reverse();

  reversed.forEach((row, revIdx) => {
    const origIdx = config.rows.length - 1 - revIdx;
    const rowNum  = origIdx + 1;
    const rowName = row.name || row.purpose;
    const cleanPurpose = row.purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_");

    builder.append(`
      ; --- Creating ${rowName} Rows ---
      printf("Creating ${rowName} (purpose: ${row.purpose}) rows=${row.rows} y=%L\\n" currentY)
    `);

    if (!row.segments || row.segments.length === 0) {
      emitSimpleMosaic(builder, config, row, maxActiveRow, `M${rowNum}_${cleanPurpose}`);
    } else {
      emitSegmentedMosaic(builder, config, row, maxActiveRow, rowNum, cleanPurpose);
    }

    builder.append(`
      currentY = currentY + (${row.rows} * ${config.y_pitch})
    `);
    builder.push("");
  });
}

// ---------------------------------------------------------------------------
// Simple (non-segmented) mosaic
// ---------------------------------------------------------------------------

function emitSimpleMosaic(
  builder: SkillBuilder,
  config: LayoutConfig,
  row: RowConfig,
  maxActiveRow: RowConfig | null,
  mosaicName: string
): void {
  const ci = cellInfoFor(config, row.purpose);

  builder.append(`
    master =
      dbOpenCellViewByType(
        "${ci.lib}"
        "${ci.cell}"
        "layout"
        "maskLayout"
        "r"
      )

    when(
      master == nil
      error(
        "Cannot open master ${ci.cell}\\n"
      )
    )

    inst = dbCreateSimpleMosaic(
      cv
      master
      "${mosaicName}"
      list(0.0 0.0)
      "R180"
      ${row.rows}
      ${config.total_cols}
      ${config.y_pitch}
      ${config.x_pitch}
    )
    unless(inst
      inst = dbCreateMosaic(
        cv
        master
        "${mosaicName}"
        list(0.0 0.0)
        "R180"
        ${row.rows}
        ${config.total_cols}
        ${config.y_pitch}
        ${config.x_pitch}
      )
    )

    when(
      inst == nil
      error(
        "Failed creating ${row.purpose}\\n"
      )
    )

    when(inst
      dx = ${config.total_cols} * ${config.x_pitch}
      dy = currentY + (${row.rows} * ${config.y_pitch})
      inst~>xy = list(dx dy)
    )

    allInsts =
      cons(
        list(inst "R180")
        allInsts
      )
  `);

  if (row.purpose.toLowerCase() === config.rov_purpose.toLowerCase() && row === maxActiveRow) {
    builder.append(`
      printf("ACTIVE MOSAIC FOUND\\n")
      maxActiveInst = inst
    `);
  }
}

// ---------------------------------------------------------------------------
// Segmented mosaic (row with left/right padding cells)
// ---------------------------------------------------------------------------

function emitSegmentedMosaic(
  builder: SkillBuilder,
  config: LayoutConfig,
  row: RowConfig,
  maxActiveRow: RowConfig | null,
  rowNum: number,
  cleanPurpose: string
): void {
  let currSegX = 0.0;

  row.segments!.forEach((seg, sIdx) => {
    const ci = cellInfoFor(config, seg.purpose);
    const cleanSeg = seg.purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_");
    const segName  = `M${rowNum}_${cleanPurpose}_seg${sIdx + 1}_${cleanSeg}`;

    builder.append(`
      ; Segment ${sIdx + 1}: ${seg.purpose} (cols=${seg.cols})
      master =
        dbOpenCellViewByType(
          "${ci.lib}"
          "${ci.cell}"
          "layout"
          "maskLayout"
          "r"
        )

      when(
        master == nil
        error(
          "Cannot open master ${ci.cell}\\n"
        )
      )

      inst = dbCreateSimpleMosaic(
        cv
        master
        "${segName}"
        list(0.0 0.0)
        "R180"
        ${row.rows}
        ${seg.cols}
        ${config.y_pitch}
        ${config.x_pitch}
      )
      unless(inst
        inst = dbCreateMosaic(
          cv
          master
          "${segName}"
          list(0.0 0.0)
          "R180"
          ${row.rows}
          ${seg.cols}
          ${config.y_pitch}
          ${config.x_pitch}
        )
      )

      when(
        inst == nil
        error(
          "Failed creating segment ${seg.purpose}\\n"
        )
      )

      when(inst
        dx = ${currSegX.toFixed(4)} + (${seg.cols} * ${config.x_pitch})
        dy = currentY + (${row.rows} * ${config.y_pitch})
        inst~>xy = list(dx dy)
      )

      allInsts =
        cons(
          list(inst "R180")
          allInsts
        )
    `);

    if (
      seg.purpose.toLowerCase() === config.rov_purpose.toLowerCase() &&
      row === maxActiveRow
    ) {
      builder.append(`
        printf("ACTIVE SEGMENT MOSAIC FOUND\\n")
        maxActiveInst = inst
      `);
    }

    currSegX += seg.cols * config.x_pitch;
  });
}
