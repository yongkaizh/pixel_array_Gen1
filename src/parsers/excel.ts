import { validateLayoutConfig } from '../math/validation';
import { positiveNumber } from '../math/numbers';
import * as XLSX from 'xlsx';
import { normalizeRotation } from '../math/orientation';
import { LayoutConfig, RowConfig, CellInfo, RowSegment } from '../types';

export { parseSegmentsString } from '../math/segments';
import { parseSegmentsString } from '../math/segments';


export function parseExcelFile(fileBuffer: ArrayBuffer): LayoutConfig {
  let workbook;
  try {
    workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
  } catch (readErr: any) {
    throw new Error(
      `CRITICAL: Could not read Excel file container structure. This might be a corrupted file, a standard CSV, or a different file type.

` +
      `Diagnostic advice:
` +
      `1. Please make sure the file you uploaded is a valid Excel spreadsheet ending in '.xlsx' or '.xls'.
` +
      `2. Do not upload empty files or renamed zip/text archives.
` +
      `3. Try downloading the pre-configured 'Active Excel Template' from the action bar below to use as your baseline.`
    );
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error(
      `EMPTY WORKBOOK: The uploaded Excel file does not contain any sheets.

` +
      `A valid Silicon Layout workbook requires at least two distinct sheets:
` +
      `- 'pix_tbl' (containing the logical-to-physical cell mapping tables)
` +
      `- 'format_template' (containing physical parameters and stacked row block arrays)

` +
      `Recommendation: Click the 'Download Template' button below to download a fully valid starting sheet.`
    );
  }

  const sheetNames = workbook.SheetNames;
  const hasPixTbl = sheetNames.includes('pix_tbl');
  const hasFormatTemplate = sheetNames.includes('format_template');

  if (!hasPixTbl && !hasFormatTemplate) {
    throw new Error(
      `INVALID SPREADSHEET STRUCTURE: The uploaded workbook is completely missing both required sheets: 'pix_tbl' AND 'format_template'.

` +
      `• Detected sheets in your file: [${sheetNames.join(', ') || 'none'}]
` +
      `• Required sheets: 'pix_tbl' AND 'format_template'

` +
      `What to correct:
` +
      `- If you created a blank Excel file from scratch, it will not work without our template structure. Please click the 'Download Template' button below, populate your specs in those exact tabs, and re-upload.`
    );
  }

  if (!hasPixTbl) {
    throw new Error(
      `MISSING SHEET 'pix_tbl': We found 'format_template' but 'pix_tbl' is missing in this file.

` +
      `• Detected sheets: [${sheetNames.join(', ')}]

` +
      `Why this sheet is needed:
` +
      `The 'pix_tbl' sheet tells the generator how to map logical cell names in the rows (e.g. 'active', 'dummy', 'idle') to actual physical cell layouts and libraries (e.g. Cell: 'pixel_active', Library: 'pixel_lib', Rotation: 'R0').

` +
      `To fix: Add a sheet named 'pix_tbl' with columns 'Name', 'library', 'Cell', and 'rotation', or use our downloadable template.`
    );
  }

  if (!hasFormatTemplate) {
    throw new Error(
      `MISSING SHEET 'format_template': We found 'pix_tbl' but 'format_template' is missing in this file.

` +
      `• Detected sheets: [${sheetNames.join(', ')}]

` +
      `Why this sheet is needed:
` +
      `The 'format_template' sheet contains metadata parameters (such as top-level library, cellname, x pitch, y pitch, total columns count) and defines the layout grid of row blocks.

` +
      `To fix: Add a sheet named 'format_template' containing the required parameter keys in column A and their values in column B, or download our working template.`
    );
  }

  // 1. Parse pix_tbl
  const pixSheet = workbook.Sheets['pix_tbl'];
  const pixData = XLSX.utils.sheet_to_json<any>(pixSheet);
  const cell_map: Record<string, CellInfo> = {};

  pixData.forEach((row: any, idx: number) => {
    const rawName = row['Name'] || row['name'] || row['NAME'];
    if (!rawName) return;
    const name = String(rawName).trim().toLowerCase();

    cell_map[name] = {
      name: String(row['Display Name'] || name).trim(),
      lib: String(row['library'] || row['Library'] || row['LIBRARY'] || '').trim(),
      cell: String(row['Cell'] || row['cell'] || row['CELL'] || '').trim(),
      rot: normalizeRotation(String(row['rotation'] || row['Rotation'] || row['ROTATION'] || 'R0'))
    };
  });

  if (Object.keys(cell_map).length === 0) {
    throw new Error(
      `EMPTY CELL MAPPING: The 'pix_tbl' sheet is empty or does not contain any valid records.

` +
      `Please make sure the 'pix_tbl' sheet has a header row with at least these column headers in row 1:
` +
      `➔ 'Name' | 'library' | 'Cell' | 'rotation'

` +
      `Followed by at least one row representing a mapped cell (e.g. active, dummy).`
    );
  }

  // Convert sheet to 2D string array
  const tmplSheet = workbook.Sheets['format_template'];
  const tmplMatrix: string[][] = XLSX.utils.sheet_to_json<string[]>(tmplSheet, {
    header: 1,
    defval: ''
  }).map(row => (row as any).map((val: any) => val === null || val === undefined ? '' : String(val).trim()));

  const rowsCount = tmplMatrix.length;
  if (rowsCount === 0) {
    throw new Error(
      `EMPTY TEMPLATE: The 'format_template' sheet has no readable content.

" +
      "Verify that you didn't accidentally wipe out all parameters in this sheet. It must contain the scalar parameters (library, cellname, x pitch, y pitch), col_num, and row_num tables.`
    );
  }

  const colsCount = rowsCount > 0 ? Math.max(...tmplMatrix.map(r => r.length)) : 0;

  // Fill matrix with empty strings to make it uniform rectangular
  const grid: string[][] = [];
  for (let r = 0; r < rowsCount; r++) {
    const row = tmplMatrix[r];
    const fullRow = [];
    for (let c = 0; c < colsCount; c++) {
      fullRow.push(c < row.length ? row[c] : '');
    }
    grid.push(fullRow);
  }

  const findKeyword = (keyword: string): [number, number] | null => {
    const kw = keyword.toLowerCase();
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < colsCount; c++) {
        if (grid[r][c].toLowerCase() === kw) {
          return [r, c];
        }
      }
    }
    return null;
  };

  const getParameter = (keyword: string): string => {
    const pos = findKeyword(keyword);
    if (!pos) {
      throw new Error(
        `MISSING PARAMETER KEYWORD '${keyword}' in 'format_template' sheet!

` +
        `The Silicon Compiler expects the exact label "${keyword}" in Column A, with its corresponding value placed to its right in Column B.

` +
        `What to do:
` +
        `- Please check if you renamed this keyword (it must be exactly "${keyword}" case-insensitive).
` +
        `- Double check if you accidentally cleared or deleted the row containing this parameter.`
      );
    }
    const [r, c] = pos;
    // Search cells to the right for first non-empty value
    for (let col = c + 1; col < colsCount; col++) {
      if (grid[r][col] !== '') {
        return grid[r][col];
      }
    }
    throw new Error(
      `BLANK VALUE FOR '${keyword}': We found the keyword label in row ${r + 1}, but the value cell adjacent to it is completely empty.

` +
      `Please provide a valid text or numeric value for '${keyword}' in Column B.`
    );
  };

  const top_lib = getParameter('library');
  const top_cell = getParameter('cellname');

  const x_pitch_raw = getParameter('x pitch');
  const x_pitch = positiveNumber(x_pitch_raw, 'X pitch');
  if (isNaN(x_pitch) || x_pitch <= 0) {
    throw new Error(`INVALID 'x pitch' VALUE: "${x_pitch_raw}". This must be a positive non-zero decimal value representing horizontal cell pitch.`);
  }

  const y_pitch_raw = getParameter('y pitch');
  const y_pitch = positiveNumber(y_pitch_raw, 'Y pitch');
  if (isNaN(y_pitch) || y_pitch <= 0) {
    throw new Error(`INVALID 'y pitch' VALUE: "${y_pitch_raw}". This must be a positive non-zero decimal value representing vertical cell pitch.`);
  }

  // Parse optional center layer (fallback to BDTID drawing)
  const centerLayerPos = findKeyword('center layer') || findKeyword('centering layer');
  let center_layer_raw = "BDTID drawing";
  if (centerLayerPos) {
    const cl_val = grid[centerLayerPos[0]][centerLayerPos[1] + 1];
    if (cl_val && cl_val.trim() !== '') {
      center_layer_raw = cl_val.trim();
    }
  }
  const center_parts = center_layer_raw.split(/\s+/);
  const center_layer = center_parts[0] || "BDTID";
  const center_purpose = center_parts.length > 1 ? center_parts[1] : "drawing";

  // Find col_num
  const colPos = findKeyword('col_num');
  if (!colPos) {
    throw new Error(
      `MISSING 'col_num' KEYWORD: We could not find the label 'col_num' in 'format_template'.

` +
      `This keyword is required to specify the total column width of your pixel array. It is usually accompanied by a column purpose name (such as 'active' or 'c1').
` +
      `Please ensure 'col_num' is present in Column A.`
    );
  }

  const [cr, cc] = colPos;
  let total_cols = 1;
    let foundColNum = false;

  // Check same row first for numeric column count
  for (let c = cc + 1; c < colsCount; c++) {
    const val = grid[cr][c];
    if (val !== '' && Number.isFinite(Number(val))) {
      total_cols = positiveNumber(val, 'Column count', true);
      foundColNum = true;
      break;
    }
  }

  // If not found on same row, check subsequent rows
  if (!foundColNum) {
    for (let r = cr + 1; r < Math.min(cr + 20, rowsCount); r++) {
      const val = grid[r][cc];
      if (val.toLowerCase() === 'row_num') break;
      if (val === '') continue;
      const parsed = Number(val);
      if (Number.isFinite(parsed)) {
        total_cols = positiveNumber(val, 'Column count', true);

        foundColNum = true;
        break;
      }
    }
  }

  if (!foundColNum || total_cols <= 0) {
    throw new Error(
      `INVALID OR MISSING COLUMN COUNT UNDER 'col_num':

` +
      `The compiler could not read a valid integer for the total columns of the array. It searched the row containing 'col_num' and the rows directly beneath it.

` +
      `To fix: Add a valid integer (e.g., 1936 or 100) next to or beneath 'col_num'.`
    );
  }



  // Find row_num
  const rowPos = findKeyword('row_num');
  if (!rowPos) {
    throw new Error(
      `MISSING 'row_num' KEYWORD: We could not find the 'row_num' label in 'format_template'.

` +
      `This label marks the starting point of the layout grid table defining your row block stacks (defining row height, logical purpose, and heterogeneous margins).
` +
      `Please restore 'row_num' in Column A.`
    );
  }

  const [rr, rc] = rowPos;
  const rows: RowConfig[] = [];
  const targetPos = findKeyword('rov purpose');
  let rov_purpose = targetPos ? (grid[targetPos[0]][targetPos[1] + 1] || '').trim() : '';

  let r = rr + 1;
  while (r < rowsCount) {
    const rowCountTxt = grid[r][rc];
    if (rowCountTxt === '') break;

    let purposeTxt = '';
    if (colsCount > rc + 1) {
      purposeTxt = grid[r][rc + 1];
    }

    const row_count = Number(rowCountTxt);
    if (!Number.isFinite(row_count)) {
      if (r === rr + 1 && rowCountTxt.startsWith('(')) { r++; continue; }
      throw new Error(`Invalid row count: "${rowCountTxt}".`);
    }

    positiveNumber(rowCountTxt, 'Row count', true);

    // Extract purpose and row name (e.g., "BLC (c1)" -> name: "BLC", purpose: "c1")
    let purpose = purposeTxt.trim();
    let rowName = purposeTxt.trim();
    const match = purposeTxt.match(/^(.*?)\s*\((.*?)\)/);
    if (match) {
      rowName = match[1].trim();
      purpose = match[2].trim();
    }

    // Parse left and right segments
    const leftTxt = colsCount > rc + 3 ? grid[r][rc + 3] : '';
    const rightTxt = colsCount > rc + 4 ? grid[r][rc + 4] : '';
    const addressTxt = colsCount > rc + 5 ? grid[r][rc + 5] : '';
    let leftSegments = parseSegmentsString(leftTxt, 'dummy');
    let rightSegments = parseSegmentsString(rightTxt, 'dummy');

    const segments: RowSegment[] = [];
    if (leftSegments.length > 0 || rightSegments.length > 0) {
      let leftCols = leftSegments.reduce((sum, s) => sum + s.cols, 0);
      let rightCols = rightSegments.reduce((sum, s) => sum + s.cols, 0);

      if (leftCols + rightCols >= total_cols) {
        throw new Error(`Row '${purpose}' padding exceeds total columns!`);
      }

      const activeCols = total_cols - leftCols - rightCols;
      segments.push(...leftSegments);
      segments.push({ purpose: purpose.toLowerCase(), cols: activeCols });
      segments.push(...rightSegments);
    }

    const rowConf: RowConfig = {
      purpose: purpose,
      rows: row_count,
      name: rowName,
      address: addressTxt
    };
    if (leftTxt !== '') rowConf.leftStr = leftTxt;
    if (rightTxt !== '') rowConf.rightStr = rightTxt;
    if (segments.length > 0) rowConf.segments = segments;

    rows.push(rowConf);

    // Check adjacent cells for ROV marker (starts from Column G which is rc + 1)
    for (let c = rc + 2; c < Math.min(rc + 3, colsCount); c++) {
      if (grid[r][c].toUpperCase() === 'ROV') {
        if (rov_purpose && rov_purpose.toLowerCase() !== purpose.toLowerCase()) throw new Error('ROV markers must select a single target purpose.');
        rov_purpose = purpose;
      }
    }

    r++;
  }

  const config: LayoutConfig = {
    top_lib,
    top_cell,
    x_pitch,
    y_pitch,
    total_cols,
    rov_purpose,
    center_layer,
    center_purpose,
    rows,
    cell_map
  };
  validateLayoutConfig(config);
  return config;
}