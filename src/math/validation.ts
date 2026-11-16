import { LayoutConfig } from '../types';
import { normalizeRotation } from './orientation';

import { positiveNumber } from './numbers';
import { parseSegmentsString } from './segments';
import { getLeftRightStringsFromSegments } from './grid';

export function validateLayoutConfig(config: LayoutConfig): void {
  positiveNumber(config.x_pitch, 'X pitch');
  positiveNumber(config.y_pitch, 'Y pitch');
  positiveNumber(config.total_cols, 'Column count', true);
  if (!config.top_lib.trim() || !config.top_cell.trim()) throw new Error('Target library and cell are required.');
  if (!config.rows.length) throw new Error('At least one row block is required.');
  let totalRows = 0;
  for (const row of config.rows) {
    positiveNumber(row.rows, `Rows for ${row.purpose}`, true);
    if (!row.purpose.trim()) throw new Error('Each row needs a purpose.');
    totalRows += row.rows;
    if (row.leftStr !== undefined || row.rightStr !== undefined) {
      const derived = getLeftRightStringsFromSegments(row.segments, row.purpose);
      const left = parseSegmentsString(row.leftStr ?? derived.leftStr);
      const right = parseSegmentsString(row.rightStr ?? derived.rightStr);
      const padding = [...left, ...right].reduce((sum, seg) => sum + seg.cols, 0);
      if (padding >= config.total_cols) throw new Error(`Row ${row.purpose}: padding must leave at least one main cell.`);
      const expected = [...left, { purpose: row.purpose.toLowerCase(), cols: config.total_cols - padding }, ...right];
      const actual = row.segments?.length ? row.segments : [{ purpose: row.purpose.toLowerCase(), cols: config.total_cols }];
      if (JSON.stringify(expected) !== JSON.stringify(actual.map(seg => ({ purpose: seg.purpose.toLowerCase(), cols: seg.cols })))) {
        throw new Error(`Row ${row.purpose}: apply valid padding before generating the layout.`);
      }
    }
    if (row.segments?.length) {
      const cols = row.segments.reduce((sum, seg) => sum + positiveNumber(seg.cols, `Columns for ${seg.purpose}`, true), 0);
      if (cols !== config.total_cols) throw new Error(`Row ${row.purpose}: segment columns must sum to ${config.total_cols}.`);
    }
    for (const part of row.segments?.length ? row.segments : [row]) {
      const cell = config.cell_map[part.purpose.toLowerCase()];
      if (!cell || !cell.lib.trim() || !cell.cell.trim()) throw new Error(`Missing cell mapping for ${part.purpose}.`);
      normalizeRotation(cell.rot);
      if (cell.lib === config.top_lib && cell.cell === config.top_cell) throw new Error('A unit cell cannot be the target array cell.');
    }
  }
  positiveNumber(totalRows, 'Total rows', true);
  if (!Number.isFinite(config.total_cols * config.x_pitch) || !Number.isFinite(totalRows * config.y_pitch)) {
    throw new Error('Array dimensions exceed the supported numeric range.');
  }
}
