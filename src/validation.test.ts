import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { getDefaultLayoutConfig } from './config/defaults';
import { validateLayoutConfig } from './math/validation';
import { parseExcelFile } from './parsers/excel';
import { exportToExcel } from './exporters/excel';
import { PRESET_CONFIGS } from './config/defaults';

function workbookWith(field: string, value: any) {
  const wb = XLSX.read(exportToExcel(getDefaultLayoutConfig()), { type: 'array' });
  const ws = wb.Sheets.format_template;
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  const row = matrix.findIndex(r => r[0] === field);
  if (field === 'col_num' || field === 'row_num') matrix[row + (field === 'col_num' ? 1 : 2)][0] = value;
  else matrix[row][1] = value;
  wb.Sheets.format_template = XLSX.utils.aoa_to_sheet(matrix);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('strict layout inputs', () => {
  it.each([0, -1, Infinity, NaN])('rejects invalid pitch %s before generation', value => {
    expect(() => validateLayoutConfig({ ...getDefaultLayoutConfig(), x_pitch: value })).toThrow('X pitch');
  });
  it.each(['2.5um', 'Infinity', 'NaN', '-3', '0'])('rejects malformed Excel pitch %s', value => {
    expect(() => parseExcelFile(workbookWith('x pitch', value))).toThrow();
  });
  it.each(['2.5', '-2', '0', '20columns'])('does not truncate invalid Excel counts %s', value => {
    expect(() => parseExcelFile(workbookWith('col_num', value))).toThrow();
    expect(() => parseExcelFile(workbookWith('row_num', value))).toThrow();
  });
  it('rejects a row whose segment width differs from the full array', () => {
    expect(() => validateLayoutConfig({ ...getDefaultLayoutConfig(), rows: [{ purpose: 'core', rows: 1, segments: [{ purpose: 'core', cols: 10 }] }] })).toThrow('sum');
  });
  it('rejects invalid padding left in a draft while old segments are still present', () => {
    expect(() => validateLayoutConfig({ ...getDefaultLayoutConfig(), rows: [{ purpose: 'core', rows: 1, leftStr: 'dummy:99999', rightStr: '' }] })).toThrow('padding');
    expect(() => validateLayoutConfig({ ...getDefaultLayoutConfig(), rows: [{ purpose: 'core', rows: 1, leftStr: 'dummy:2', rightStr: '' }] })).toThrow('apply valid padding');
  });
  it('rejects missing physical cell mappings and recursive array masters', () => {
    const config = getDefaultLayoutConfig();
    delete config.cell_map.core;
    expect(() => validateLayoutConfig(config)).toThrow('Missing cell mapping');
    const recursive = getDefaultLayoutConfig();
    recursive.cell_map.core.lib = recursive.top_lib;
    recursive.cell_map.core.cell = recursive.top_cell;
    expect(() => validateLayoutConfig(recursive)).toThrow('unit cell');
  });
  it('round-trips default and preset mapping keys separately from display names', () => {
    for (const config of [getDefaultLayoutConfig(), ...PRESET_CONFIGS.map(preset => preset.config())]) {
      const parsed = parseExcelFile(exportToExcel(config));
      expect(parsed.cell_map).toEqual(config.cell_map);
      expect(parsed.rov_purpose).toBe(config.rov_purpose);
    }
  });
  it('preserves centering targets present only in padding segments', () => {
    const base = getDefaultLayoutConfig();
    const config = { ...base, total_cols: 10, rov_purpose: 'core', rows: [{ purpose: 'dummy', rows: 5,
      segments: [{ purpose: 'core', cols: 2 }, { purpose: 'dummy', cols: 8 }] }] };
    const parsed = parseExcelFile(exportToExcel(config));
    expect(parsed.rov_purpose).toBe('core');
    expect(parsed.rows[0].segments).toEqual(config.rows[0].segments);
  });
  it('notes containing ROV do not replace the target selected in the marker column', () => {
    const config = getDefaultLayoutConfig();
    config.rows[0].address = 'ROV';
    expect(parseExcelFile(exportToExcel(config)).rov_purpose).toBe('core');
  });
});
