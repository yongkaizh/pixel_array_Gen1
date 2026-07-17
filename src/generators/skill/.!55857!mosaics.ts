import { LayoutConfig, RowConfig } from '../../types';
import { getRowCategory } from '../../math/grid';
import { SkillBuilder } from './SkillBuilder';

export function findMaxActiveRow(config: LayoutConfig): RowConfig | null {
  let maxActiveRow: RowConfig | null = null;
  config.rows.forEach(row => {
    const isAct = getRowCategory(row.purpose, row.name || '', config.rov_purpose) === 'active';
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

    const cleanPurpose = purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
    const mosaicName = `M${row_num}_${cleanPurpose}`;

    builder.push(`  ; --- Creating ${rowName} Rows ---`);
    builder.push('  printf(');
    builder.push(`    "Creating ${rowName} (purpose: ${purpose}) rows=${row.rows} y=%L\\n"`);
    builder.push('    currentY');
    builder.push('  )');
    builder.push('');

    if (!row.segments || row.segments.length === 0) {
      generateSimpleMosaic(builder, config, row, maxActiveRow, mosaicName);
    } else {
      generateSegmentedMosaic(builder, config, row, maxActiveRow, row_num, cleanPurpose);
    }

    builder.push(`    currentY = currentY + (${row.rows} * ${config.y_pitch})`);
    builder.push('');
  });
}

function generateSimpleMosaic(builder: SkillBuilder, config: LayoutConfig, row: RowConfig, maxActiveRow: RowConfig | null, mosaicName: string) {
  const purpose = row.purpose;
  const cellInfo = config.cell_map[purpose.toLowerCase()];
  builder.push('  master =');
  builder.push('    dbOpenCellViewByType(');
  builder.push(`      "${cellInfo.lib}"`);
  builder.push(`     "${cellInfo.cell}"`);
  builder.push('      "layout"');
  builder.push('      "maskLayout"');
  builder.push('      "r"');
  builder.push('    )');
