import React from 'react';
import * as XLSX from 'xlsx';
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ExcelGuide } from './ExcelGuide';
import { EXCEL_GUIDE_CONFIG } from '../config/excelGuide';
import { exportToExcel } from '../exporters/excel';
import { parseExcelFile } from '../parsers/excel';
import { nominalCenter } from '../math/layout';

describe('illustrated Excel example', () => {
  afterEach(cleanup);
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

  it('shows exported cells with a generic center-layer label in the guide', () => {
    const workbook = XLSX.read(exportToExcel(EXCEL_GUIDE_CONFIG), { type: 'array' });
    render(<ExcelGuide />);
    const steps = [
      { button: /Map cells/, region: 'Cell mapping example table', sheet: 'pix_tbl', first: 0, last: 3, columns: 5 },
      { button: /Set size/, region: 'Array settings example table', sheet: 'format_template', first: 0, last: 10, columns: 3 },
      { button: /Set rows/, region: 'Row layout example table', sheet: 'format_template', first: 12, last: 17, columns: 6 },
    ];
    for (const step of steps) {
      fireEvent.click(screen.getByRole('button', { name: step.button }));
      const table = screen.getByRole('region', { name: step.region });
      expect(table.textContent).not.toContain('BDTID drawing');
      for (let row = step.first; row <= step.last; row++) {
        for (let col = 0; col < step.columns; col++) {
          const section = String(workbook.Sheets[step.sheet][`A${row + 1}`]?.v).startsWith('---');
          if (section && col > 0) continue; // Empty cells are visually merged into the section heading.
          const address = XLSX.utils.encode_cell({ r: row, c: col });
          expect(table.querySelector(`[data-cell="${address}"]`)?.textContent)
            .toBe(step.sheet === 'format_template' && address === 'B7' ? 'center layer' : String(workbook.Sheets[step.sheet][address]?.v ?? ''));
        }
      }
    }
  });
});
