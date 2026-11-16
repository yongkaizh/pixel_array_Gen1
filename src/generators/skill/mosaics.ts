import { LayoutConfig, RowConfig, CellInfo } from "../../types";
import { centerSegmentIndices } from "../../math/layout";
import { mosaicGeometry } from "../../math/orientation";
import { SkillBuilder, escapeSkill } from "./SkillBuilder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export { findCenterRow as findMaxActiveRow } from "../../math/layout";

/** Layout validation guarantees that every placed purpose has an explicit mapping. */
function cellInfoFor(config: LayoutConfig, purpose: string): CellInfo {
  return config.cell_map[purpose.toLowerCase()];
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
      ; --- Creating ${rowName.replace(/[\r\n]/g, " ")} Rows ---
      printf("Creating %s (purpose: %s) rows=%L y=%L\\n" "${escapeSkill(rowName)}" "${escapeSkill(row.purpose)}" ${row.rows} currentY)
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
  const g = mosaicGeometry(ci.rot, config.total_cols, row.rows, config.x_pitch, config.y_pitch);

  builder.append(`
    master =
      dbOpenCellViewByType(
        "${escapeSkill(ci.lib)}"
        "${escapeSkill(ci.cell)}"
        "layout"
        "maskLayout"
        "r"
      )

    when(
      master == nil
      error(
        "Cannot open master %s\\n" "${escapeSkill(ci.cell)}"
      )
    )

    inst = dbCreateSimpleMosaic(
      cv
      master
      "${mosaicName}"
      list(0.0 0.0)
      "${g.orient}"
      ${g.rows}
      ${g.cols}
      ${g.yStep}
      ${g.xStep}
    )
    unless(inst
      inst = dbCreateMosaic(
        cv
        master
        "${mosaicName}"
        list(0.0 0.0)
        "${g.orient}"
        ${g.rows}
        ${g.cols}
        ${g.yStep}
        ${g.xStep}
      )
    )

    when(
      inst == nil
      error(
        "Failed creating %s\\n" "${escapeSkill(row.purpose)}"
      )
    )

    when(inst
      dx = ${g.offsetX}
      dy = currentY + ${g.offsetY}
      placementBox = paLayerBBox(master list("${escapeSkill(config.center_layer || 'BDTID')}" "${escapeSkill(config.center_purpose || 'drawing')}"))
      unless(placementBox placementBox = master~>bBox)
      unless(placementBox error("Master has no placement geometry\\n"))
      actualBox = dbTransformBBox(placementBox list(list(0.0 0.0) "${g.orient}" 1.0))
      nominalBox = dbTransformBBox(list(list(0.0 0.0) list(${g.xStep} ${g.yStep})) list(list(0.0 0.0) "${g.orient}" 1.0))
      ; Pitch spaces origins; the reference cell size and local origin come from its geometry.
      dx = dx + caar(nominalBox) - caar(actualBox)
      dy = dy + cadar(nominalBox) - cadar(actualBox)
      inst~>xy = list(dx dy)
    )

    allInsts =
      cons(
        list(inst "${g.orient}" ${g.cols} ${g.rows} ${g.xStep} ${g.yStep} placementBox)
        allInsts
      )
    dbClose(master)
  `);

  if (row === maxActiveRow) {
    builder.append(`
      printf("ACTIVE MOSAIC FOUND\\n")
      maxActiveInst = inst
      maxActiveData = car(allInsts)
      targetInsts = cons(maxActiveData targetInsts)
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
    const g = mosaicGeometry(ci.rot, seg.cols, row.rows, config.x_pitch, config.y_pitch);
    const cleanSeg = seg.purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "_");
    const segName  = `M${rowNum}_${cleanPurpose}_seg${sIdx + 1}_${cleanSeg}`;

    builder.append(`
      ; Segment ${sIdx + 1}: ${seg.purpose} (cols=${seg.cols})
      master =
        dbOpenCellViewByType(
          "${escapeSkill(ci.lib)}"
          "${escapeSkill(ci.cell)}"
          "layout"
          "maskLayout"
          "r"
        )

      when(
        master == nil
        error(
          "Cannot open master %s\\n" "${escapeSkill(ci.cell)}"
        )
      )

      inst = dbCreateSimpleMosaic(
        cv
        master
        "${segName}"
        list(0.0 0.0)
        "${g.orient}"
        ${g.rows}
        ${g.cols}
        ${g.yStep}
        ${g.xStep}
      )
      unless(inst
        inst = dbCreateMosaic(
          cv
          master
          "${segName}"
          list(0.0 0.0)
          "${g.orient}"
          ${g.rows}
          ${g.cols}
          ${g.yStep}
          ${g.xStep}
        )
      )

      when(
        inst == nil
        error(
          "Failed creating segment %s\\n" "${escapeSkill(seg.purpose)}"
        )
      )

      when(inst
        dx = ${currSegX} + ${g.offsetX}
        dy = currentY + ${g.offsetY}
        placementBox = paLayerBBox(master list("${escapeSkill(config.center_layer || 'BDTID')}" "${escapeSkill(config.center_purpose || 'drawing')}"))
        unless(placementBox placementBox = master~>bBox)
        unless(placementBox error("Master has no placement geometry\\n"))
        actualBox = dbTransformBBox(placementBox list(list(0.0 0.0) "${g.orient}" 1.0))
        nominalBox = dbTransformBBox(list(list(0.0 0.0) list(${g.xStep} ${g.yStep})) list(list(0.0 0.0) "${g.orient}" 1.0))
        ; Pitch spaces origins; the reference cell size and local origin come from its geometry.
        dx = dx + caar(nominalBox) - caar(actualBox)
        dy = dy + cadar(nominalBox) - cadar(actualBox)
        inst~>xy = list(dx dy)
      )

      allInsts =
        cons(
          list(inst "${g.orient}" ${g.cols} ${g.rows} ${g.xStep} ${g.yStep} placementBox)
          allInsts
        )
      dbClose(master)
    `);

    if (row === maxActiveRow && centerSegmentIndices(config, row).includes(sIdx)) {
      builder.append(`
        printf("ACTIVE SEGMENT MOSAIC FOUND\\n")
        maxActiveInst = inst
        maxActiveData = car(allInsts)
        targetInsts = cons(maxActiveData targetInsts)
      `);
    }

    currSegX += seg.cols * config.x_pitch;
  });
}
