import { LayoutConfig, RowConfig } from '../types';
import { getRowCategory } from './grid';

/** Largest block containing the selected purpose; ties retain configuration order. */
export function findCenterRow(config: LayoutConfig): RowConfig | null {
  const matches = config.rows.filter(row => (row.segments?.length ? row.segments : [row])
    .some(part => part.purpose.toLowerCase() === config.rov_purpose.toLowerCase()));
  const candidates = matches.length ? matches : config.rows.filter(row =>
    getRowCategory(row.purpose, row.name ?? '', config.rov_purpose) === 'active');
  return candidates.reduce<RowConfig | null>((largest, row) => !largest || row.rows > largest.rows ? row : largest, null);
}

export function centerSegmentIndices(config: LayoutConfig, row: RowConfig): number[] {
  const segments = row.segments?.length ? row.segments : [{ purpose: row.purpose, cols: config.total_cols }];
  const exact = segments.flatMap((seg, idx) => seg.purpose.toLowerCase() === config.rov_purpose.toLowerCase() ? [idx] : []);
  return exact.length ? exact : segments.flatMap((seg, idx) => seg.purpose.toLowerCase() === row.purpose.toLowerCase() ? [idx] : []);
}

/** Nominal pitch envelope; master geometry is only available inside Virtuoso. */
export function nominalCenter(config: LayoutConfig): { x: number; y: number } {
  const target = findCenterRow(config);
  const idx = target ? config.rows.indexOf(target) : -1;
  let left = 0, right = config.total_cols;
  if (target?.segments?.length) {
    const selected = centerSegmentIndices(config, target);
    if (selected.length) {
      left = target.segments.slice(0, selected[0]).reduce((sum, seg) => sum + seg.cols, 0);
      right = target.segments.slice(0, selected[selected.length - 1] + 1).reduce((sum, seg) => sum + seg.cols, 0);
    }
  }
  const below = idx < 0 ? 0 : config.rows.slice(idx + 1).reduce((sum, row) => sum + row.rows, 0);
  const height = target?.rows ?? config.rows.reduce((sum, row) => sum + row.rows, 0);
  return { x: (left + right) / 2 * config.x_pitch, y: (below + height / 2) * config.y_pitch };
}
