import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExcelGuide } from './ExcelGuide';
import { EXCEL_GUIDE_CONFIG } from '../config/excelGuide';
import { exportToExcel } from '../exporters/excel';
import { parseExcelFile } from '../parsers/excel';
import { nominalCenter } from '../math/layout';

describe('illustrated Excel example', () => {
  it('downloads a workbook that produces the pictured 12 × 8 array and centered 8 × 4 active block', () => {
    const config = parseExcelFile(exportToExcel(EXCEL_GUIDE_CONFIG));
    expect(config.total_cols).toBe(12);
    expect(config.rows.reduce((sum, row) => sum + row.rows, 0)).toBe(8);
    expect(config.rows.map(row => row.rows)).toEqual([2, 4, 2]);
    expect(config.rows[1].segments).toEqual([
      { purpose: 'dummy', cols: 2 }, { purpose: 'idle', cols: 1 },
      { purpose: 'active', cols: 8 }, { purpose: 'dummy', cols: 1 },
    ]);
    expect(config.rov_purpose).toBe('active');
    expect(nominalCenter(config)).toEqual({ x: 17.5, y: 10 });
    expect(config.cell_map.active.rot).toBe('R180');
    expect(config.cell_map.dummy.rot).toBe('R0');
    expect(config.cell_map.idle.rot).toBe('MY');
  });

  it('shows one worksheet at a time while retaining the array illustration', () => {
    render(<ExcelGuide />);
    expect(screen.getByRole('region', { name: 'Cell mapping example table' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Set rows/ }));
    expect(screen.queryByRole('region', { name: 'Cell mapping example table' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Row layout example table' })).toBeDefined();
    expect(screen.getByRole('img', { name: /Twelve-column mixed array/ })).toBeDefined();
  });
});
