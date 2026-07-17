import * as XLSX from 'xlsx';
import { LayoutConfig } from '../types';
import { getLeftRightStringsFromSegments } from '../math/grid';

export function exportToExcel(config: LayoutConfig): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // 1. Create pix_tbl sheet data
  const pixRows = Object.values(config.cell_map).map(cell => ({
    'Name': cell.name,
    'library': cell.lib,
    'Cell': cell.cell,
    'rotation': cell.rot
  }));
  const pixSheet = XLSX.utils.json_to_sheet(pixRows);
  pixSheet['!cols'] = [
    { wch: 20 },
    { wch: 30 },
    { wch: 45 },
    { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, pixSheet, 'pix_tbl');

  // 2. Create format_template sheet data
  // We need to build a sheet grid manually containing our parameters in the layout found by find_keyword
  const formatData: any[][] = [
    ['--- ARRAY GLOBAL SETTINGS ---', '', '', '', '', '', ''],
    ['library', config.top_lib, '<-- Target library name', '', '', '', ''],
    ['cellname', config.top_cell, '<-- Target cell view name', '', '', '', ''],
    ['x pitch', config.x_pitch, '<-- x direction pixel unit pitch', '', '', '', ''],
    ['y pitch', config.y_pitch, '<-- y direction pixel unit pitch', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['--- ARRAY WIDTH ---', '', '', '', '', '', ''],
    ['col_num', '', '<-- Total number of columns', '', '', '', ''],
    [config.total_cols, '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['--- ROW STACK LAYOUT (ORDERED BOTTOM TO TOP) ---', '', '', '', '', '', ''],
    ['row_num', 'Row Block Purpose Name', 'Marker (ROV)', 'Left Columns (Padding)', 'Right Columns (Padding)', 'Notes / Address', ''],
    ['(Number of rows)', '(Which cell from pix_tbl?)', '(Type "ROV" here to mark)', '(e.g. dummy:20)', '(e.g. dummy:20)', '', '']
  ];

  config.rows.forEach(row => {
    const isRov = row.purpose.toLowerCase() === config.rov_purpose.toLowerCase();

    let leftStr = '';
    let rightStr = '';

    if (row.segments && row.segments.length > 0) {
      const mainIdx = row.segments.findIndex(s => s.purpose.toLowerCase() === row.purpose.toLowerCase());
      if (mainIdx !== -1) {
        const leftParts = row.segments.slice(0, mainIdx);
        const rightParts = row.segments.slice(mainIdx + 1);
        leftStr = leftParts.map(s => `${s.purpose}:${s.cols}`).join(', ');
        rightStr = rightParts.map(s => `${s.purpose}:${s.cols}`).join(', ');
      } else {
        leftStr = row.segments.map(s => `${s.purpose}:${s.cols}`).join(', ');
      }
    }

    const rowCells = [
      row.rows,
      row.name ? `${row.name} (${row.purpose})` : `${row.purpose} (${row.purpose})`,
      isRov ? 'ROV' : '',
      leftStr,
      rightStr,
      row.address || '',
      ''
    ];
    formatData.push(rowCells);
  });

  const tmplSheet = XLSX.utils.aoa_to_sheet(formatData);
  tmplSheet['!cols'] = [
    { wch: 20 }, // col A
    { wch: 30 }, // col B
    { wch: 35 }, // col C
    { wch: 25 }, // col D
    { wch: 25 }, // col E
    { wch: 30 }  // col F
  ];
  XLSX.utils.book_append_sheet(wb, tmplSheet, 'format_template');

  // Generate ArrayBuffer representation
  const wopts: XLSX.WritingOptions = { bookType: 'xlsx', bookSST: false, type: 'array' };
  const wbout = XLSX.write(wb, wopts);
  return wbout;
}
