import * as XLSX from 'xlsx';
import { LayoutConfig, CellInfo, RowConfig, RowSegment } from './types';

export interface ExcelImportErrorDetails {
  title: string;
  summary: string;
  missingItem?: string;
  fixSuggestion: string;
  showTemplateButton: boolean;
}

export function getExcelImportErrorDetails(error: unknown): ExcelImportErrorDetails {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const message = rawMessage.replace(/\s+/g, ' ').trim();

  if (message.includes("MISSING SHEET 'pix_tbl'")) {
    return {
      title: 'Missing required sheet: pix_tbl',
      summary: 'The workbook is missing the pix_tbl sheet, which maps logical purposes to physical cells.',
      missingItem: 'pix_tbl',
      fixSuggestion: 'Add a sheet named pix_tbl with at least the Name, library, Cell, and rotation columns, or load the example template.',
      showTemplateButton: true
    };
  }

  if (message.includes("MISSING SHEET 'format_template'")) {
    return {
      title: 'Missing required sheet: format_template',
      summary: 'The workbook is missing the format_template sheet, which defines the row grid and layout parameters.',
      missingItem: 'format_template',
      fixSuggestion: 'Add a sheet named format_template with the required row/column layout parameters, or load the example template.',
      showTemplateButton: true
    };
  }

  if (message.includes("EMPTY CELL MAPPING") && message.includes("Name")) {
    return {
      title: 'Missing column headers for pix_tbl',
      summary: 'The pix_tbl sheet is empty or missing expected headers like Name, library, Cell, and rotation.',
      missingItem: 'Name, library, Cell, or rotation headers',
      fixSuggestion: 'Please add the Name, library, Cell, and rotation column headers to the first row of your pix_tbl sheet.',
      showTemplateButton: true
    };
  }

  if (message.includes("EMPTY CELL MAPPING") || message.includes("EMPTY TEMPLATE")) {
    return {
      title: 'Workbook structure is incomplete',
      summary: 'The uploaded workbook was read, but the required table content is missing or empty.',
      missingItem: message.includes('EMPTY CELL MAPPING') ? 'pix_tbl headers' : 'format_template values',
      fixSuggestion: message.includes('EMPTY CELL MAPPING')
        ? 'Add the Name, library, Cell, and rotation headers in the pix_tbl sheet and at least one mapping row.'
        : 'Populate the format_template sheet with the expected parameters, row_num data, and column count values.',
      showTemplateButton: true
    };
  }

  if (message.includes("MISSING PARAMETER KEYWORD") || message.includes("BLANK VALUE FOR")) {
    return {
      title: 'A required parameter is missing',
      summary: 'The workbook has the right sheet, but a parameter label or value is still missing.',
      missingItem: 'format_template parameter',
      fixSuggestion: 'Check the format_template sheet for labels like library, cellname, x pitch, y pitch, col_num, and row_num, then fill in the values.',
      showTemplateButton: true
    };
  }

  return {
    title: 'Excel import could not be parsed',
    summary: 'The workbook could not be loaded as a valid Silicon Array layout specification.',
    fixSuggestion: 'Please verify the workbook is a valid .xlsx file and contains the required sheets and columns, or load the example template.',
    showTemplateButton: true
  };
}

export function getRowCategory(purpose: string, name: string, rov_purpose: string): 'active' | 'rov' | 'blc' | 'clamp' | 'cbar' | 'dummy' | 'top' | 'bottom' {
  const p = purpose.toLowerCase();
  const n = name.toLowerCase();
  const rovLower = rov_purpose.toLowerCase();

  if (p === 'top') return 'top';
  if (p === 'bottom') return 'bottom';

  // 1. Black Level Correction / BLC:
  if (n.includes('blc') || p.includes('blc')) return 'blc';

  // 2. Row Optical Black / ROV:
  if (n.includes('rov') || p.includes('rov')) return 'rov';

  // 3. Active Pixel Array:
  if (n === 'c1' || n.includes('active') || p.includes('active') || p === 'act' || n === 'act' || (p === 'c1' && !n.includes('blc'))) return 'active';

  // 4. ROV / Optical Black (Fallback)
  if (p === rovLower || p.includes('ob') || p.includes('black')) return 'rov';

  // 5. Color Bar:
  if (p.includes('cbar') || p.includes('color') || n.includes('color') || n.includes('cbar')) return 'cbar';

  // 6. Clamp / Peripheral:
  if (p.includes('clamp') || p.includes('idle') || p.includes('bsun') || p.includes('ecl') ||
      n.includes('clamp') || n.includes('idle') || n.includes('bsun') || n.includes('ecl')) return 'clamp';

  return 'dummy';
}

// Default configuration out of the box
export function getDefaultLayoutConfig(): LayoutConfig {
  return {
    top_lib: 'NEW_PIX_LIB_v2',
    top_cell: 'new_array_pixel_001',
    x_pitch: 2.5,
    y_pitch: 2.5,
    total_cols: 2048,
    rov_purpose: 'c1',
    rows: [
      { purpose: 'bottom', rows: 2, name: 'Bottom_v2' },
      { purpose: 'dummy', rows: 2, name: 'Dummy_v2' },
      { purpose: 'c1', rows: 40, name: 'BLC_new' },
      { purpose: 'c2', rows: 20, name: 'BLC_zero_ext' },
      { purpose: 'dummy', rows: 2, name: 'Extra_Dummy_Row' },
      { purpose: 'cbar', rows: 2, name: 'Color_Bar_B_ext' },
      { purpose: 'cbar', rows: 2, name: 'Color_Bar_R_ext' },
      { purpose: 'idle', rows: 4, name: 'Idle_Clamps_Ext' },
      { purpose: 'bsun', rows: 4, name: 'ECL_Bsun_Ext' },
      { purpose: 'ecl', rows: 4, name: 'ECL_Sig_Ext' },
      { purpose: 'dummy', rows: 2, name: 'Dummy_Mid' },
      { purpose: 'c1', rows: 1300, name: 'Active_Core_v2', address: '(Core Array Start)' },
      { purpose: 'dummy', rows: 2, name: 'Dummy_Top' },
      { purpose: 'top', rows: 2, name: 'Top_Row_v2' }
    ],
    cell_map: {
      bottom: { name: 'bottom_v2', lib: 'pix_lib_v2', cell: 'cell_bottom_001', rot: 'R0' },
      cbar: { name: 'cbar_v2', lib: 'pix_lib_v2', cell: 'cell_cbar_001', rot: 'R0' },
      idle: { name: 'idle_v2', lib: 'pix_lib_v2', cell: 'cell_idle_001', rot: 'R0' },
      ecl: { name: 'ecl_v2', lib: 'pix_lib_v2', cell: 'cell_ecl_001', rot: 'R0' },
      bsun: { name: 'bsun_v2', lib: 'pix_lib_v2', cell: 'cell_bsun_001', rot: 'R0' },
      c1: { name: 'active_v2', lib: 'pix_lib_v2', cell: 'cell_active_001', rot: 'R0' },
      top: { name: 'top_v2', lib: 'pix_lib_v2', cell: 'cell_top_001', rot: 'R0' },
      c2: { name: 'blc_zero_v2', lib: 'pix_lib_v2', cell: 'cell_blc_zero_001', rot: 'R0' },
      dummy: { name: 'dummy_v2', lib: 'pix_lib_v2', cell: 'cell_dummy_001', rot: 'R0' }
    }
  };
}

// Generate Cadence SKILL script
export function generateSkillCode(config: LayoutConfig): string {
  const code: string[] = [];
  code.push('; ===================================================================');
  code.push('; Cadence SKILL Pixel Array Layout Generation Script');
  code.push('; AUTO GENERATED BY CADENCE SKILL PIXEL ARRAY LAYOUT GENERATOR');
  code.push(`; Generated At: ${new Date().toISOString()}`);
  code.push('; Author: Yongkai Zhang');
  code.push(`; Copyright (c) ${new Date().getFullYear()} Yongkai Zhang`);
  code.push('; ===================================================================');
  code.push('');
  code.push('procedure(createPixelArray()');
  code.push('  let((');
  code.push('    cv');
  code.push('    master');
  code.push('    inst');
  code.push('    allInsts');
  code.push('    dx');
  code.push('    dy');
  code.push('    currentY');
  code.push('  )');
  code.push('');
  code.push('    printf("\\n===============================\\n")');
  code.push('    printf("Pixel Array Generation Start\\n")');
  code.push('    printf("===============================\\n")');
  code.push('');
  code.push('    ; Ensure target library exists');
  code.push('    unless(ddGetObj(');
  code.push(`      "${config.top_lib}"`);
  code.push('    )');
  code.push('      error(');
  code.push(`        "Library ${config.top_lib} does not exist!\\n"`);
  code.push('      )');
  code.push('    )');
  code.push('');
  code.push('    ; Check if cell layout exists. If so open it, otherwise create it.');
  code.push('    if(ddGetObj(');
  code.push(`      "${config.top_lib}"`);
  code.push(`      "${config.top_cell}"`);
  code.push('      "layout"');
  code.push('    ) then');
  code.push('      printf(');
  code.push(`        "Cellview ${config.top_cell} layout already exists. Opening...\\n"`);
  code.push('      )');
  code.push('      cv = dbOpenCellViewByType(');
  code.push(`        "${config.top_lib}"`);
  code.push(`        "${config.top_cell}"`);
  code.push('        "layout"');
  code.push('        "maskLayout"');
  code.push('        "a"');
  code.push('      )');
  code.push('    else');
  code.push('      printf(');
  code.push(`        "Cellview ${config.top_cell} layout does not exist. Creating new...\\n"`);
  code.push('      )');
  code.push('      cv = dbOpenCellViewByType(');
  code.push(`        "${config.top_lib}"`);
  code.push(`        "${config.top_cell}"`);
  code.push('        "layout"');
  code.push('        "maskLayout"');
  code.push('        "w"');
  code.push('      )');
  code.push('    )');
  code.push('');
  code.push('    when(cv == nil');
  code.push('      error("Cannot create or open target layout\\n")');
  code.push('    )');
  code.push('');
  code.push('    unwindProtect(');
  code.push('      {');
  code.push('    ; Clear old instances and mosaics to prevent stacking when re-running');
  code.push('    when(cv');
  code.push('      foreach(inst cv~>instances');
  code.push('        dbDeleteObject(inst)');
  code.push('      )');
  code.push('      foreach(mosaic cv~>mosaics');
  code.push('        dbDeleteObject(mosaic)');
  code.push('      )');
  code.push('    )');
  code.push('');
  code.push('    currentY = 0.0');
  code.push('    allInsts = nil');
  code.push('    rovInst = nil');
  code.push('');

  // 1. Identify the true active block with the maximum row count
  let maxActiveRow: RowConfig | null = null;
  config.rows.forEach(row => {
    const isAct = getRowCategory(row.purpose, row.name || '', config.rov_purpose) === 'active';
    if (isAct) {
      if (!maxActiveRow || row.rows > maxActiveRow.rows) {
        maxActiveRow = row;
      }
    }
  });

  // Iterate rows backwards (bottom→top) to match Cadence viewport (+Y is UP)
  const reversedRows = [...config.rows].reverse();
  reversedRows.forEach((row, rev_idx) => {
    // The original row index in Excel (1-based)
    const orig_idx = config.rows.length - 1 - rev_idx;
    const row_num = orig_idx + 1;
    const purpose = row.purpose;
    const rowName = row.name || purpose;

    const cleanPurpose = purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
    const mosaicName = `M${row_num}_${cleanPurpose}`;

    code.push(`  ; --- Creating ${rowName} Rows ---`);
    code.push('  printf(');
    code.push(`    "Creating ${rowName} (purpose: ${purpose}) rows=${row.rows} y=%L\\n"`);
    code.push('    currentY');
    code.push('  )');
    code.push('');

    if (!row.segments || row.segments.length === 0) {
      const cellInfo = config.cell_map[purpose.toLowerCase()];
      code.push('  master =');
      code.push('    dbOpenCellViewByType(');
      code.push(`      "${cellInfo.lib}"`);
      code.push(`      "${cellInfo.cell}"`);
      code.push('      "layout"');
      code.push('      "maskLayout"');
      code.push('      "r"');
      code.push('    )');
      code.push('');
      code.push('  when(');
      code.push('    master == nil');
      code.push('    error(');
      code.push(`      "Cannot open master ${cellInfo.cell}\\n"`);
      code.push('    )');
      code.push('  )');
      code.push('');
      code.push(`  inst = dbCreateSimpleMosaic(`);
      code.push('    cv');
      code.push('    master');
      code.push(`    "${mosaicName}"`);
      code.push('    list(0.0 0.0)');
      code.push('    "R180"');
      code.push(`    ${row.rows}`);
      code.push(`    ${config.total_cols}`);
      code.push(`    ${config.y_pitch}`);
      code.push(`    ${config.x_pitch}`);
      code.push('  )');
      code.push('  unless(inst');
      code.push(`    inst = dbCreateMosaic(`);
      code.push('      cv');
      code.push('      master');
      code.push(`      "${mosaicName}"`);
      code.push('      list(0.0 0.0)');
      code.push('      "R180"');
      code.push(`      ${row.rows}`);
      code.push(`      ${config.total_cols}`);
      code.push(`      ${config.y_pitch}`);
      code.push(`      ${config.x_pitch}`);
      code.push('    )');
      code.push('  )');
      code.push('');
      code.push('  when(');
      code.push('    inst == nil');
      code.push('    error(');
      code.push(`      "Failed creating ${purpose}\\n"`);
      code.push('    )');
      code.push('  )');
      code.push('');
      code.push('  when(inst');
      code.push(`    dx = ${config.total_cols} * ${config.x_pitch}`);
      code.push(`    dy = currentY + (${row.rows} * ${config.y_pitch})`);
      code.push('    inst~>xy = list(dx dy)');
      code.push('  )');
      code.push('');
      code.push('  allInsts =');
      code.push('    cons(');
      code.push('      list(inst "R180")');
      code.push('      allInsts');
      code.push('    )');
      code.push('');
      
      const isRov = purpose.toLowerCase() === config.rov_purpose.toLowerCase();
      if (isRov && row === maxActiveRow) {
        code.push('  printf("ACTIVE MOSAIC FOUND\\n")');
      }
    } else {
      let currSegX = 0.0;
      row.segments.forEach((seg, sIdx) => {
        const segPurpose = seg.purpose;
        const segCols = seg.cols;
        const cleanSegPurpose = segPurpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
        const segMosaicName = `M${row_num}_${cleanPurpose}_seg${sIdx + 1}_${cleanSegPurpose}`;
        
        let segCellInfo = config.cell_map[segPurpose.toLowerCase()];
        if (!segCellInfo) {
          segCellInfo = {
            name: segPurpose,
            lib: 'pixel_lib',
            cell: `cell_${segPurpose}`,
            rot: 'R0'
          };
        }

        code.push(`  ; Segment ${sIdx + 1}: ${segPurpose} (cols=${segCols})`);
        code.push('  master =');
        code.push('    dbOpenCellViewByType(');
        code.push(`      "${segCellInfo.lib}"`);
        code.push(`      "${segCellInfo.cell}"`);
        code.push('      "layout"');
        code.push('      "maskLayout"');
        code.push('      "r"');
        code.push('    )');
        code.push('');
        code.push('  when(');
        code.push('    master == nil');
        code.push('    error(');
        code.push(`      "Cannot open master ${segCellInfo.cell}\\n"`);
        code.push('    )');
        code.push('  )');
        code.push('');
        code.push(`  inst = dbCreateSimpleMosaic(`);
        code.push('    cv');
        code.push('    master');
        code.push(`    "${segMosaicName}"`);
        code.push('    list(0.0 0.0)');
        code.push('    "R180"');
        code.push(`    ${row.rows}`);
        code.push(`    ${segCols}`);
        code.push(`    ${config.y_pitch}`);
        code.push(`    ${config.x_pitch}`);
        code.push('  )');
        code.push('  unless(inst');
        code.push(`    inst = dbCreateMosaic(`);
        code.push('      cv');
        code.push('      master');
        code.push(`      "${segMosaicName}"`);
        code.push('      list(0.0 0.0)');
        code.push('      "R180"');
        code.push(`      ${row.rows}`);
        code.push(`      ${segCols}`);
        code.push(`      ${config.y_pitch}`);
        code.push(`      ${config.x_pitch}`);
        code.push('    )');
        code.push('  )');
        code.push('');
        code.push('  when(');
        code.push('    inst == nil');
        code.push('    error(');
        code.push(`      "Failed creating segment ${segPurpose}\\n"`);
        code.push('    )');
        code.push('  )');
        code.push('');
        code.push('  when(inst');
        code.push(`    dx = ${currSegX.toFixed(4)} + (${segCols} * ${config.x_pitch})`);
        code.push('    dy = currentY + (' + row.rows + ' * ' + config.y_pitch + ')');
        code.push('    inst~>xy = list(dx dy)');
        code.push('  )');
        code.push('');
        code.push('  allInsts =');
        code.push('    cons(');
        code.push('      list(inst "R180")');
        code.push('      allInsts');
        code.push('    )');
        code.push('');
        
        const isRov = segPurpose.toLowerCase() === config.rov_purpose.toLowerCase();
        if (isRov && row === maxActiveRow) {
          code.push('  printf("ACTIVE SEGMENT MOSAIC FOUND\\n")');
        }
        
        currSegX += segCols * config.x_pitch;
      });
    }

    code.push(`    currentY = currentY + (${row.rows} * ${config.y_pitch})`);
    code.push('');
  });

  // Calculate true geometric center of the ROV active block
  let firstActiveIdx = -1;
  let lastActiveIdx = -1;
  config.rows.forEach((row, idx) => {
    const isAct = getRowCategory(row.purpose, row.name || '', config.rov_purpose) === 'active' || getRowCategory(row.purpose, row.name || '', config.rov_purpose) === 'rov';
    if (isAct) {
      if (firstActiveIdx === -1) firstActiveIdx = idx;
      lastActiveIdx = idx;
    }
  });

  let left_cols = 0;
  let active_cols = config.total_cols;
  
  // Find the exact ROV segment by strictly matching rov_purpose to ignore paddings
  const rovRow = config.rows.find(r => r.segments && r.segments.some(s => s.purpose.toLowerCase() === config.rov_purpose.toLowerCase()));
  if (rovRow && rovRow.segments) {
    const activeSegIdx = rovRow.segments.findIndex(s => s.purpose.toLowerCase() === config.rov_purpose.toLowerCase());
    for (let i = 0; i < activeSegIdx; i++) {
      left_cols += rovRow.segments[i].cols;
    }
    active_cols = rovRow.segments[activeSegIdx].cols;
  } else if (firstActiveIdx !== -1) {
    // Fallback if no exact match
    const firstActiveRow = config.rows[firstActiveIdx];
    if (firstActiveRow.segments && firstActiveRow.segments.length > 0) {
      const activeSegIdx = firstActiveRow.segments.findIndex(s => getRowCategory(s.purpose, '', config.rov_purpose) === 'active');
      if (activeSegIdx !== -1) {
        for (let i = 0; i < activeSegIdx; i++) {
          left_cols += firstActiveRow.segments[i].cols;
        }
        active_cols = firstActiveRow.segments[activeSegIdx].cols;
      }
    }
  }
  // With R180 rotation, the mosaic's physical lower-left is at (origin.x - cols*xPitch, origin.y - rows*yPitch).
  // We place origin at (currSegX + segCols*xPitch, currentY + rows*yPitch) so LL lands at (currSegX, currentY).
  // For the centering calculation, the physical left edge of the ROV content is at:
  //   left_physical_x = left_cols * x_pitch
  // And the physical center X of the ROV content is:
  //   center_x = (left_cols + active_cols/2) * x_pitch
  // We want center_x + targetDx = 0, so targetDx = -(left_cols + active_cols/2) * x_pitch
  // BUT: since each mosaic origin is at (segCols*xPitch + currSegX), the actual content X range is
  //   [currSegX, currSegX + segCols*xPitch]
  // So the centering math below remains the same (left_cols in column units, active_cols in column units).
  const targetDx = - (left_cols + active_cols / 2.0) * config.x_pitch;

  // Y-axis: Find the physical Y-offset of the primary ROV block
  let startY_rows = 0;
  let endY_rows = 0;

  if (firstActiveIdx !== -1 && lastActiveIdx !== -1) {
    for (let i = lastActiveIdx + 1; i < config.rows.length; i++) {
      startY_rows += config.rows[i].rows;
    }
    endY_rows = startY_rows;
    for (let i = firstActiveIdx; i <= lastActiveIdx; i++) {
      endY_rows += config.rows[i].rows;
    }
  }

  const targetDy = (firstActiveIdx !== -1)
    ? - (startY_rows + endY_rows) / 2.0 * config.y_pitch
    : - (config.rows.reduce((sum, r) => sum + r.rows, 0) / 2.0) * config.y_pitch;

  code.push('    ; --- Center Array at (0, 0) ---');
  code.push('    printf("\\nFinding Global Array Center...\\n")');
  code.push(`    dx = ${targetDx.toFixed(4)}`);
  code.push(`    dy = ${targetDy.toFixed(4)}`);
  code.push('    printf("Global Center: cx=%L cy=%L\\n" 0.0 - dx 0.0 - dy)');
  code.push('    printf("Shifting all parts by dx=%L dy=%L\\n" dx dy)');
  code.push('');
  code.push('    foreach(item allInsts');
  code.push('      inst = car(item)');
  code.push('      inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)');
  code.push('    )');
  code.push('');
  code.push('    ; --- Rotations applied during creation ---');
  code.push('');
  code.push('    dbSave(cv)');
  code.push('      }');
  code.push('      when(cv');
  code.push('        dbClose(cv)');
  code.push('      )');
  code.push('    )');
  code.push('    printf("\\nPixel Array Generation Complete!\\n")');
  code.push('  )');
  code.push(')');
  code.push('');
  code.push('; Execute procedure');
  code.push('createPixelArray()');

  return code.join('\n');
}

// Generate corrected or original python code
export function generatePythonCode(isCorrected: boolean): string {
  if (isCorrected) {
    return `#!/usr/bin/env python3
"""
Pixel Array CAD SKILL Generator
Author: Yongkai Zhang
Copyright (c) 2026 Yongkai Zhang
=========================================
Corrected and robust python script to parse pixel array specifications from Excel
and output Cadence SKILL commands.

Bug Fixes Applied:
1. Fixed typo 'tmpl.shapeactive_col_purpose' -> 'tmpl.shape[1]' boundary check.
2. Fixed truncated 'tmpl.shaperow_count_txt = norm' -> 'while r < tmpl.shape[0]' with correct indentation.
3. Fixed typo 'tmpl.shapepurpose_txt' -> 'tmpl.shape[1]' bounds safety.
4. Ensured robust variable initialization for 'skill' to guarantee definition even during exception states.
"""

import pandas as pd
import re
import sys

EXCEL_FILE = "array_pixel.xlsx"
SKILL_FILE = "pixel_array.il"

# =========================================================
# Utility Functions
# =========================================================

def norm(v):
    if pd.isna(v):
        return ""
    return str(v).strip()

def find_keyword(df, keyword):
    keyword = keyword.lower()
    for r in range(df.shape[0]):
        for c in range(df.shape[1]):
            txt = norm(df.iat[r, c]).lower()
            if txt == keyword:
                return (r, c)
    return None

def get_parameter(df, keyword):
    pos = find_keyword(df, keyword)
    if pos is None:
        raise RuntimeError(f"Cannot find keyword [{keyword}]")
    r, c = pos
    # Search cells to the right for first non-empty value
    for col in range(c + 1, df.shape[1]):
        val = norm(df.iat[r, col])
        if val != "":
            return val
    return ""

def get_row_category(purpose, name, rov_purpose):
    p = str(purpose).lower()
    n = str(name).lower()
    rov_lower = str(rov_purpose).lower()

    if p == 'top': return 'top'
    if p == 'bottom': return 'bottom'

    if 'blc' in n or 'blc' in p: return 'blc'
    if 'rov' in n or 'rov' in p: return 'rov'
    if n == 'c1' or 'active' in n or 'active' in p or p == 'act' or n == 'act' or (p == 'c1' and 'blc' not in n): return 'active'
    if p == rov_lower or 'ob' in p or 'black' in p: return 'rov'
    if 'cbar' in p or 'color' in p or 'color' in n or 'cbar' in n: return 'cbar'
    if 'clamp' in p or 'idle' in p or 'bsun' in p or 'ecl' in p or 'clamp' in n or 'idle' in n or 'bsun' in n or 'ecl' in n: return 'clamp'

    return 'dummy'

def extract_purpose(text):
    text = norm(text)
    m = re.search(r"\\((.*?)\\)", text)
    if m:
        return m.group(1).strip()
    return text.strip()

# =========================================================
# Main Code Runner
# =========================================================

def main():
    # Fix: Ensure 'skill' is defined beforehand
    skill = []

    print("\\nReading pix_tbl ...")
    try:
        pix_df = pd.read_excel(
            EXCEL_FILE,
            sheet_name="pix_tbl",
            dtype=str
        ).fillna("")
    except Exception as e:
        print(f"Error: Could not read sheet 'pix_tbl' from {EXCEL_FILE}. {e}")
        sys.exit(1)

    cell_map = {}
    for _, row in pix_df.iterrows():
        name = norm(row["Name"]).lower()
        if not name:
            continue
        cell_map[name] = {
            "lib": norm(row["library"]),
            "cell": norm(row["Cell"]),
            "rot": norm(row["rotation"])
        }

    print(f"Loaded {len(cell_map)} cells")

    # =========================================================
    # Read format_template
    # =========================================================
    print("Reading format_template ...")
    try:
        tmpl = pd.read_excel(
            EXCEL_FILE,
            sheet_name="format_template",
            header=None,
            dtype=str
        ).fillna("")
    except Exception as e:
        print(f"Error: Could not read sheet 'format_template' from {EXCEL_FILE}. {e}")
        sys.exit(1)

    try:
        top_lib = get_parameter(tmpl, "library")
        top_cell = get_parameter(tmpl, "cellname")
        x_pitch = float(get_parameter(tmpl, "x pitch"))
        y_pitch = float(get_parameter(tmpl, "y pitch"))
    except Exception as e:
        print(f"Error parsing metadata parameters: {e}")
        sys.exit(1)

    print("Library :", top_lib)
    print("Cell    :", top_cell)
    print("X Pitch :", x_pitch)
    print("Y Pitch :", y_pitch)

    # =========================================================
    # Parse col_num table
    # =========================================================
    col_pos = find_keyword(tmpl, "col_num")
    if col_pos is None:
        raise RuntimeError("Cannot find col_num table.")

    cr, cc = col_pos
    total_cols = None
    found_col_num = False

    # Check same row first for numeric column count
    for c in range(cc + 1, tmpl.shape[1]):
        val = norm(tmpl.iat[cr, c])
        if val != "":
            try:
                total_cols = int(float(val))
                found_col_num = True
                break
            except:
                pass

    # If not found on same row, check subsequent rows
    if not found_col_num:
        for r in range(cr + 1, min(cr + 20, tmpl.shape[0])):
            value = norm(tmpl.iat[r, cc])
            if value == "":
                continue
            try:
                total_cols = int(float(value))

                found_col_num = True
                break
            except Exception as e:
                pass



    if total_cols is None:
        raise RuntimeError("Failed to get TOTAL_COLS.")

    print("TOTAL_COLS =", total_cols)
    
    # =========================================================
    # Parse row_num table
    # =========================================================
    row_pos = find_keyword(tmpl, "row_num")
    if row_pos is None:
        raise RuntimeError("Cannot find row_num table.")

    rr, rc = row_pos
    rows = []
    rov_purpose = None

    def parse_segments_string(txt, default_purpose='dummy'):
        if not txt:
            return []
        parts = txt.split(',')
        segs = []
        for part in parts:
            clean = part.strip()
            if not clean:
                continue
            if clean.isdigit():
                cols = int(clean)
                if cols > 0:
                    segs.append({"purpose": default_purpose, "cols": cols})
            else:
                m = re.match(r"^([a-zA-Z0-9_]+):(\d+)$", clean)
                if m:
                    purp = m.group(1).strip().lower()
                    cols = int(m.group(2))
                    if cols > 0:
                        segs.append({"purpose": purp, "cols": cols})
        return segs

    r = rr + 1
    while r < tmpl.shape[0]:
        row_count_txt = norm(tmpl.iat[r, rc])
        if row_count_txt == "":
            break

        purpose_txt = ""
        if rc + 1 < tmpl.shape[1]:
            purpose_txt = norm(tmpl.iat[r, rc + 1])

        try:
            row_count = int(float(row_count_txt))
        except:
            r += 1
            continue

        purpose = extract_purpose(purpose_txt)

        # Extract row name (e.g. "BLC (c1)" -> name="BLC", purpose="c1")
        row_name = purpose_txt
        m = re.match(r"^(.*?)\s*\((.*?)\)", purpose_txt)
        if m:
            row_name = m.group(1).strip()
            purpose = m.group(2).strip()

        # Parse left and right segments
        left_txt = ""
        if rc + 3 < tmpl.shape[1]:
            left_txt = norm(tmpl.iat[r, rc + 3])

        right_txt = ""
        if rc + 4 < tmpl.shape[1]:
            right_txt = norm(tmpl.iat[r, rc + 4])

        left_segs = parse_segments_string(left_txt, 'dummy')
        right_segs = parse_segments_string(right_txt, 'dummy')

        left_sum = sum(s['cols'] for s in left_segs)
        right_sum = sum(s['cols'] for s in right_segs)

        segments = []
        if left_sum > 0 or right_sum > 0:
            for s in left_segs:
                segments.append(s)
            center_cols = total_cols - left_sum - right_sum
            if center_cols > 0:
                segments.append({"purpose": purpose.lower(), "cols": center_cols})
            for s in right_segs:
                segments.append(s)

        row_data = {
            "purpose": purpose,
            "rows": row_count,
            "name": row_name
        }
        if len(segments) > 0:
            row_data["segments"] = segments

        rows.append(row_data)

        # Check nearby columns for ROV marker (starts from Column G which is rc + 1)
        for c in range(rc + 1, min(rc + 10, tmpl.shape[1])):
            marker = norm(tmpl.iat[r, c]).upper()
            if marker == "ROV":
                rov_purpose = purpose

        r += 1

    if rov_purpose is None:
        raise RuntimeError("ROV marker not found in rows table.")

    print("ROV PURPOSE =", rov_purpose)

    # =========================================================
    # Validate purpose names & auto-populate missing cells
    # =========================================================
    for row in rows:
        purpose = row["purpose"].lower()
        if purpose not in cell_map:
            cell_map[purpose] = {
                "lib": "pixel_lib",
                "cell": f"cell_{purpose}",
                "rot": "R0"
            }

        # Also check segments
        for seg in row.get("segments", []):
            seg_purp = seg["purpose"].lower()
            if seg_purp not in cell_map:
                cell_map[seg_purp] = {
                    "lib": "pixel_lib",
                    "cell": f"cell_{seg_purp}",
                    "rot": "R0"
                }

    # =========================================================
    # Generate SKILL Content
    # =========================================================
    skill.append("; =====================================")
    skill.append("; AUTO GENERATED")
    skill.append("; =====================================")
    skill.append("")
    skill.append("procedure(createPixelArray()")
    skill.append(" let((")
    skill.append("      cv")
    skill.append("      master")
    skill.append("      inst")
    skill.append("      rovInst")
    skill.append("      allInsts")
    skill.append("      center")
    skill.append("      dx")
    skill.append("      dy")
    skill.append("      currentY")
    skill.append(" ))")

    skill.append(f"""
 printf("\\\\n===============================\\\\n")
 printf("Pixel Array Generation Start\\\\n")
 printf("===============================\\\\n")

 ; Ensure target library exists
 unless(
    ddGetObj("{top_lib}")
    error("Library {top_lib} does not exist!\\\\n")
 )

 ; Check if cell layout exists. If so open it, otherwise create it.
 if(
    ddGetObj("{top_lib}" "{top_cell}" "layout") then
    printf("Cellview {top_cell} layout already exists. Opening...\\\\n")
    cv =
      dbOpenCellViewByType(
         "{top_lib}"
         "{top_cell}"
         "layout"
         "maskLayout"
         "a"
      )
 else
    printf("Cellview {top_cell} layout does not exist. Creating new...\\\\n")
    cv =
      dbOpenCellViewByType(
         "{top_lib}"
         "{top_cell}"
         "layout"
         "maskLayout"
         "w"
      )
 )

 when(
    cv == nil
    error("Cannot create or open target layout\\\\n")
 )

 unwindProtect(
  {
   ; Clear any existing instances to avoid duplicates
   when(
      cv
      foreach(inst cv~>instances
         dbDeleteObject(inst)
      )
   )

   currentY = 0
   allInsts = nil
""")

    # Create rows
    # Identify the true active block with the maximum row count
    active_rows = [r for r in rows if get_row_category(r["purpose"], r.get("name", ""), rov_purpose) == 'active']
    max_active_row = None
    if active_rows:
        max_active_row = max(active_rows, key=lambda r: r["rows"])
    for rev_idx, row in enumerate(reversed(rows)):
        orig_idx = len(rows) - 1 - rev_idx
        row_num = orig_idx + 1
        purpose = row["purpose"]
        row_name = row.get("name", purpose)
        row_count = row["rows"]
        segments = row.get("segments", [])

        clean_purpose = re.sub(r'[^a-zA-Z0-9_]', '_', purpose.lower())
        mosaic_name = f"M{row_num}_{clean_purpose}"

        skill.append(f"""
  ; --- Creating {row_name} Rows ---
  printf(
   "Creating {row_name} (purpose: {purpose}) rows={row_count} y=%L\\\\n"
   currentY
  )
""")

        if len(segments) == 0:
            cell_info = cell_map[purpose.lower()]
            skill.append(f"""
  master =
   dbOpenCellViewByType(
      "{cell_info["lib"]}"
      "{cell_info["cell"]}"
      "layout"
      "maskLayout"
      "r"
   )

  when(
     master == nil
     error(
      "Cannot open master {cell_info["cell"]}\\\\n"
     )
  )

  inst = dbCreateSimpleMosaic(
        cv
        master
        "{mosaic_name}"
        list(0.0 0.0)
        "R180"
        {row_count}
        {total_cols}
        {y_pitch}
        {x_pitch}
  )
  unless(inst
   inst = dbCreateMosaic(
         cv
         master
         "{mosaic_name}"
         list(0.0 0.0)
         "R180"
         {row_count}
         {total_cols}
         {y_pitch}
         {x_pitch}
  )
  )

  when(
     inst == nil
     error(
      "Failed creating {purpose}\\\\n"
     )
  )

  when(inst
     dx = 0.0
     dy = currentY
     inst~>xy = list(dx dy)
  )

  allInsts =
    cons(
       list(inst "R180")
       allInsts
    )
""")
            if purpose.lower() == rov_purpose.lower() and row == max_active_row:
                skill.append("""
  printf("ACTIVE MOSAIC FOUND\\\\n")
""")
        else:
            curr_seg_x = 0.0
            for s_idx, seg in enumerate(segments):
                seg_purpose = seg["purpose"]
                seg_cols = seg["cols"]
                clean_seg_purpose = re.sub(r'[^a-zA-Z0-9_]', '_', seg_purpose.lower())
                seg_mosaic_name = f"M{row_num}_{clean_purpose}_seg{s_idx + 1}_{clean_seg_purpose}"

                seg_cell_info = cell_map.get(seg_purpose.lower(), {
                    "lib": "pixel_lib",
                    "cell": f"cell_{seg_purpose}",
                    "rot": "R0"
                })
                skill.append(f"""
  ; Segment {s_idx + 1}: {seg_purpose} (cols={seg_cols})
  master =
   dbOpenCellViewByType(
      "{seg_cell_info["lib"]}"
      "{seg_cell_info["cell"]}"
      "layout"
      "maskLayout"
      "r"
   )

  when(
     master == nil
     error(
      "Cannot open master {seg_cell_info["cell"]}\\\\n"
     )
  )

  inst = dbCreateSimpleMosaic(
        cv
        master
        "{seg_mosaic_name}"
        list(0.0 0.0)
        "R180"
        {row_count}
        {seg_cols}
        {y_pitch}
        {x_pitch}
  )
  unless(inst
   inst = dbCreateMosaic(
         cv
         master
         "{seg_mosaic_name}"
         list(0.0 0.0)
         "R180"
         {row_count}
         {seg_cols}
         {y_pitch}
         {x_pitch}
  )
  )

  when(
     inst == nil
     error(
      "Failed creating segment {seg_purpose}\\\\n"
     )
  )

  when(inst
     dx = {curr_seg_x:.4f} + ({seg_cols} * {x_pitch})
     dy = currentY + ({row_count} * {y_pitch})
     inst~>xy = list(dx dy)
  )

  allInsts =
    cons(
       list(inst "R180")
       allInsts
    )
""")
                if seg_purpose.lower() == rov_purpose.lower() and row == max_active_row:
                    skill.append("""
  printf("ACTIVE SEGMENT MOSAIC FOUND\\\\n")
""")
                curr_seg_x += seg_cols * x_pitch

        skill.append(f" currentY = currentY + ({row_count} * {y_pitch})")

    # Calculate true geometric center of the ROV active block
    first_active_idx = -1
    last_active_idx = -1
    for i, r in enumerate(rows):
        is_act = get_row_category(r["purpose"], r.get("name", ""), rov_purpose) in ("active", "rov")
        if is_act:
            if first_active_idx == -1:
                first_active_idx = i
            last_active_idx = i

    left_cols = 0
    active_cols = total_cols
    
    # Strictly find the exact ROV segment to ignore paddings
    rov_row = None
    for r in rows:
        if r.get("segments") and any(s["purpose"].lower() == rov_purpose.lower() for s in r["segments"]):
            rov_row = r
            break
            
    if rov_row:
        segments = rov_row["segments"]
        active_seg_idx = -1
        for s_idx, seg in enumerate(segments):
            if seg["purpose"].lower() == rov_purpose.lower():
                active_seg_idx = s_idx
                break
        if active_seg_idx != -1:
            left_cols = sum(seg["cols"] for seg in segments[:active_seg_idx])
            active_cols = segments[active_seg_idx]["cols"]
    elif first_active_idx != -1:
        first_active_row = rows[first_active_idx]
        segments = first_active_row.get("segments", [])
        if segments:
            active_seg_idx = -1
            for s_idx, seg in enumerate(segments):
                if get_row_category(seg["purpose"], "", rov_purpose) in ("active", "rov"):
                    active_seg_idx = s_idx
                    break
            if active_seg_idx != -1:
                left_cols = sum(seg["cols"] for seg in segments[:active_seg_idx])
                active_cols = segments[active_seg_idx]["cols"]

    target_dx = - (left_cols + active_cols / 2.0) * x_pitch

    start_y_rows = 0
    end_y_rows = 0
    if first_active_idx != -1 and last_active_idx != -1:
        for i in range(last_active_idx + 1, len(rows)):
            start_y_rows += rows[i]["rows"]
        end_y_rows = start_y_rows
        for i in range(first_active_idx, last_active_idx + 1):
            end_y_rows += rows[i]["rows"]
        
        target_dy = - (start_y_rows + end_y_rows) / 2.0 * y_pitch
    else:
        target_dy = - (sum(r["rows"] for r in rows) / 2.0) * y_pitch

    # Center Array at (0,0) based on collective center of all rows
    skill.append(f"""
 printf("\\\\nFinding Global Array Center...\\\\n")
 dx = {target_dx:.4f}
 dy = {target_dy:.4f}
 printf("Global Center: cx=%L cy=%L\\\\n" 0.0 - dx 0.0 - dy)
 printf("Move dx=%L dy=%L\\\\n" dx dy)

 foreach(
   item
   allInsts

   inst = car(item)
   inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
 )
 
 ; --- Rotations applied during creation ---

 dbSave(cv)
  }
  when(cv
     dbClose(cv)
  )
 )

 printf("\\\\nPixel Array Generation Complete!\\\\n")

 )
)

createPixelArray()
""")

    # =========================================================
    # Write file
    # =========================================================
    try:
        with open(SKILL_FILE, "w") as fp:
            fp.write("\\n".join(skill))
        print(f"\\nGenerated : {SKILL_FILE}")
        print("ROV       :", rov_purpose)
        print("COLS      :", total_cols)
        print("ROW TYPES :", len(rows))
        print("Done successfully.")
    except Exception as e:
        print(f"Error writing to file {SKILL_FILE}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  } else {
    // Return original buggy snippet exactly
    return `#!/usr/bin/env python3

import pandas as pd
import re

EXCEL_FILE = "array_pixel.xlsx"
SKILL_FILE = "pixel_array.il"

# Initialize skill variable as an empty list to avoid NameError
skill = []

# =========================================================
# Utility Functions
# =========================================================

def norm(v):
    if pd.isna(v):
        return ""
    return str(v).strip()

def find_keyword(df, keyword):

    keyword = keyword.lower()

    for r in range(df.shape[0]):
        for c in range(df.shape[1]):

            txt = norm(df.iat[r, c]).lower()

            if txt == keyword:
                return (r, c)

    return None


def get_parameter(df, keyword):

    pos = find_keyword(df, keyword)

    if pos is None:
        raise RuntimeError(
            f"Cannot find keyword [{keyword}]"
        )

    r, c = pos

    return norm(df.iat[r, c + 1])


def extract_purpose(text):

    text = norm(text)

    m = re.search(r"\\((.*?)\\)", text)

    if m:
        return m.group(1).strip()

    return text.strip()

# =========================================================
# Read pix_tbl
# =========================================================

print("\\nReading pix_tbl ...")

pix_df = pd.read_excel(
    EXCEL_FILE,
    sheet_name="pix_tbl",
    dtype=str
).fillna("")

cell_map = {}

for _, row in pix_df.iterrows():

    name = norm(row["Name"]).lower()

    if not name:
        continue

    cell_map[name] = {
        "lib": norm(row["library"]),
        "cell": norm(row["Cell"]),
        "rot": norm(row["rotation"])
    }

print(f"Loaded {len(cell_map)} cells")

# =========================================================
# Read format_template
# =========================================================

print("Reading format_template ...")

tmpl = pd.read_excel(
    EXCEL_FILE,
    sheet_name="format_template",
    header=None,
    dtype=str
).fillna("")

top_lib = get_parameter(tmpl, "library")
top_cell = get_parameter(tmpl, "cellname")

x_pitch = float(
    get_parameter(tmpl, "x pitch")
)

y_pitch = float(
    get_parameter(tmpl, "y pitch")
)

print("Library :", top_lib)
print("Cell    :", top_cell)
print("X Pitch :", x_pitch)
print("Y Pitch :", y_pitch)

# =========================================================
# Parse col_num table
# =========================================================

col_pos = find_keyword(
    tmpl,
    "col_num"
)

if col_pos is None:
    raise RuntimeError(
        "Cannot find col_num table."
    )

cr, cc = col_pos

total_cols = None

for r in range(cr + 1, min(cr + 20, tmpl.shape[0])):

    value = norm(
        tmpl.iat[r, cc]
    )

    if value == "":
        continue

    try:

        total_cols = int(
            float(value)
        )



        break

    except:
        pass

if total_cols is None:

    raise RuntimeError(
        "Failed to get TOTAL_COLS."
    )

print("TOTAL_COLS =", total_cols)

# =========================================================
# Parse row_num table
# =========================================================

row_pos = find_keyword(
    tmpl,
    "row_num"
)

if row_pos is None:
    raise RuntimeError(
        "Cannot find row_num table."
    )

rr, rc = row_pos

rows = []
rov_purpose = None

r = rr + 1

while r < tmpl.shaperow_count_txt = norm(
        tmpl.iat[r, rc]
    )

    if row_count_txt == "":
        break

    purpose_txt = ""

    if rc + 1 < tmpl.shapepurpose_txt = norm(
            tmpl.iat[r, rc + 1]
        )

    try:
        row_count = int(
            float(row_count_txt)
        )
    except:
        r += 1
        continue

    purpose = extract_purpose(
        purpose_txt
    )

    rows.append(
        {
            "purpose": purpose,
            "rows": row_count
        }
    )

    #
    # check nearby columns
    # for ROV marker
    #

    for c in range(
        rc + 2,
        min(rc + 10, tmpl.shape[1])
    ):

        marker = norm(
            tmpl.iat[r, c]
        ).upper()

        if marker == "ROV":
            rov_purpose = purpose

    r += 1

if rov_purpose is None:

    raise RuntimeError(
        "ROV marker not found."
    )

print("ROV PURPOSE =", rov_purpose)

# =========================================================
# Validate purpose names
# =========================================================

for row in rows:

    purpose = row["purpose"].lower()

    if purpose not in cell_map:

        raise RuntimeError(
            f"Purpose [{purpose}] "
            f"not found in pix_tbl"
        )

# =========================================================
# Helper for row categorization
# =========================================================

def get_row_category(purpose, name, rov_purpose):
    p = str(purpose).lower()
    n = str(name).lower()
    rov_lower = str(rov_purpose).lower()

    if p == 'top': return 'top'
    if p == 'bottom': return 'bottom'

    if 'blc' in n or 'blc' in p: return 'blc'
    if 'rov' in n or 'rov' in p: return 'rov'
    if n == 'c1' or 'active' in n or 'active' in p or p == 'act' or n == 'act' or (p == 'c1' and 'blc' not in n): return 'active'
    if p == rov_lower or 'ob' in p or 'black' in p: return 'rov'
    if 'cbar' in p or 'color' in p or 'color' in n or 'cbar' in n: return 'cbar'
    if 'clamp' in p or 'idle' in p or 'bsun' in p or 'ecl' in p or 'clamp' in n or 'idle' in n or 'bsun' in n or 'ecl' in n: return 'clamp'

    return 'dummy'

# =========================================================
# Generate SKILL
# =========================================================

skill = []

skill.append("; =====================================")
skill.append("; AUTO GENERATED")
skill.append("; =====================================")
skill.append("")

skill.append("procedure(createPixelArray()")

skill.append("""
 let((
      cv
      master
      inst
      allInsts
      center
      dx
      dy
      currentY
 ))
""")

skill.append(f'''
 printf("\\\\n===============================\\\\n")
 printf("Pixel Array Generation Start\\\\n")
 printf("===============================\\\\n")

 ; Ensure target library exists
 unless(
    ddGetObj("{top_lib}")
    error("Library {top_lib} does not exist!\\\\n")
 )

 ; Check if cell layout exists. If so open it, otherwise create it.
 if(
    ddGetObj("{top_lib}" "{top_cell}" "layout") then
    printf("Cellview {top_cell} layout already exists. Opening...\\\\n")
    cv =
      dbOpenCellViewByType(
         "{top_lib}"
         "{top_cell}"
         "layout"
         "maskLayout"
         "a"
      )
 else
    printf("Cellview {top_cell} layout does not exist. Creating new...\\\\n")
    cv =
      dbOpenCellViewByType(
         "{top_lib}"
         "{top_cell}"
         "layout"
         "maskLayout"
         "w"
      )
 )

 when(
    cv == nil
    error("Cannot create or open target layout\\\\n")
 )

 ; Clear any existing instances to avoid duplicates
 when(
    cv
    foreach(inst cv~>instances
       dbDeleteObject(inst)
    )
 )

 currentY = 0
 allInsts = nil
''')

# =========================================================
# Create rows
# =========================================================

for row in reversed(rows):

    purpose = row["purpose"]
    row_count = row["rows"]
    row_name = row.get("name", "")

    cell_info = cell_map[
        purpose.lower()
    ]

    skill.append(f'''
 printf(
  "Creating {purpose} rows={row_count} y=%L\\\\n"
  currentY
 )

 master =
  dbOpenCellViewByType(
     "{cell_info["lib"]}"
     "{cell_info["cell"]}"
     "layout"
      "maskLayout"
      "r"
  )

 when(
   master == nil
   error(
    "Cannot open master {cell_info["cell"]}\\\\n"
   )
 )

 inst =
  car(
   errset(
    dbCreateSimpleMosaic(
       cv
       master
       nil
       list(0 0)
       "{cell_info["rot"]}"
       {row_count}
       {total_cols}
       {y_pitch}
       {x_pitch}
    )
   )
  )
 unless(inst
  inst =
   car(
    errset(
     dbCreateMosaic(
        cv
        master
        nil
        list(0 0)
        "R180"
        {row_count}
        {total_cols}
        {y_pitch}
        {x_pitch}
  )
 )

 when(
   inst == nil
   error(
    "Failed creating {purpose}\\\\n"
   )
 )

 when(inst
    bBox = inst~>bBox
    ll = car(bBox)
    x_ll = car(ll)
    y_ll = cadr(ll)
    dx = 0.0 - x_ll
    dy = currentY - y_ll
    inst~>xy = list(dx dy)
 )

 allInsts =
   cons(
      list(inst "{cell_info["rot"]}")
      allInsts
   )
''')

    if purpose.lower() == rov_purpose.lower() and row == max_active_row:

        skill.append("""
 printf("ACTIVE MOSAIC FOUND\\\\n")
 rovInst = inst
""")

    skill.append(
        f" currentY = currentY + ({row_count} * {y_pitch})"
    )

# =========================================================
# Center Active Array
# =========================================================

skill.append(f"""
 printf("\\\\nFinding Global Array Center...\\\\n")
 if( rovInst != nil then
   C = centerBox(rovInst~>bBox)
   dx = 0.0 - car(C)
   dy = 0.0 - cadr(C)
 else
   dx = 0.0 - ({total_cols * x_pitch} / 2.0)
   dy = 0.0 - (currentY / 2.0)
 )
 printf("Global Center: cx=%L cy=%L\\\\n" 0.0 - dx 0.0 - dy)
 printf("Move dx=%L dy=%L\\\\n" dx dy)
""")

skill.append("""

 foreach(
   item
   allInsts

   inst = car(item)
   inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
 )
 
 ; --- Rotations applied during creation ---

 dbSave(cv)

 printf("\\\\nPixel Array Generation Complete\\\\n")

 )
)

createPixelArray()
""")

# =========================================================
# Write file
# =========================================================

with open(SKILL_FILE, "w") as fp:
    fp.write(
        "\\\\n".join(skill)
    )

print()
print("Generated :", SKILL_FILE)
print("ROV       :", rov_purpose)
print("COLS      :", total_cols)
print("ROW TYPES :", len(rows))
print("Done.")
`;
  }
}

export function parseSegmentsString(txt: string | number, defaultPurpose: string = 'dummy'): RowSegment[] {
  if (typeof txt === 'number') txt = String(txt);
  if (!txt || txt.trim() === '') return [];
  // Supports formats like:
  // "20" (defaults to "dummy:20")
  // "dummy:20"
  // "dummy:20, c2:10"
  const parts = txt.split(',');
  const segments: RowSegment[] = [];
  parts.forEach(part => {
    const clean = part.trim();
    if (!clean) return;

    if (/^\d+$/.test(clean)) {
      const cols = parseInt(clean, 10);
      if (cols > 0) {
        segments.push({ purpose: defaultPurpose, cols });
      }
    } else {
      const match = clean.match(/^([a-zA-Z0-9_]+)\s*:\s*(\d+)$/);
      if (match) {
        const purp = match[1].trim().toLowerCase();
        const cols = parseInt(match[2], 10);
        if (cols > 0) {
          segments.push({ purpose: purp, cols });
        }
      }
    }
  });
  return segments;
}

export function getLeftRightStringsFromSegments(segments: RowSegment[] | undefined, mainPurpose: string, row?: RowConfig): { leftStr: string, rightStr: string } {
  if (row && typeof row.leftStr === 'string' && typeof row.rightStr === 'string') {
    return { leftStr: row.leftStr, rightStr: row.rightStr };
  }
  if (!segments || segments.length === 0) {
    return { leftStr: '', rightStr: '' };
  }
  const mainIdx = segments.findIndex(s => s.purpose.toLowerCase() === mainPurpose.toLowerCase());
  if (mainIdx !== -1) {
    const leftParts = segments.slice(0, mainIdx);
    const rightParts = segments.slice(mainIdx + 1);
    return {
      leftStr: leftParts.map(s => `${s.purpose}:${s.cols}`).join(', '),
      rightStr: rightParts.map(s => `${s.purpose}:${s.cols}`).join(', ')
    };
  } else {
    return {
      leftStr: segments.map(s => `${s.purpose}:${s.cols}`).join(', '),
      rightStr: ''
    };
  }
}


// Parse uploaded Excel file to layout config
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
      name: name,
      lib: String(row['library'] || row['Library'] || row['LIBRARY'] || '').trim(),
      cell: String(row['Cell'] || row['cell'] || row['CELL'] || '').trim(),
      rot: String(row['rotation'] || row['Rotation'] || row['ROTATION'] || 'R0').trim()
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
  const x_pitch = parseFloat(x_pitch_raw);
  if (isNaN(x_pitch) || x_pitch <= 0) {
    throw new Error(`INVALID 'x pitch' VALUE: "${x_pitch_raw}". This must be a positive non-zero decimal value representing horizontal cell pitch.`);
  }

  const y_pitch_raw = getParameter('y pitch');
  const y_pitch = parseFloat(y_pitch_raw);
  if (isNaN(y_pitch) || y_pitch <= 0) {
    throw new Error(`INVALID 'y pitch' VALUE: "${y_pitch_raw}". This must be a positive non-zero decimal value representing vertical cell pitch.`);
  }

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
    if (val !== '' && !isNaN(parseInt(val, 10))) {
      total_cols = parseInt(val, 10);
      foundColNum = true;
      break;
    }
  }

  // If not found on same row, check subsequent rows
  if (!foundColNum) {
    for (let r = cr + 1; r < Math.min(cr + 20, rowsCount); r++) {
      const val = grid[r][cc];
      if (val === '') continue;
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        total_cols = parsed;

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
  let rov_purpose = '';

  let r = rr + 1;
  while (r < rowsCount) {
    const rowCountTxt = grid[r][rc];
    if (rowCountTxt === '') break;

    let purposeTxt = '';
    if (colsCount > rc + 1) {
      purposeTxt = grid[r][rc + 1];
    }

    const row_count = parseInt(rowCountTxt, 10);
    if (isNaN(row_count)) {
      r++;
      continue;
    }

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

    const leftSegs = parseSegmentsString(leftTxt, 'dummy');
    const rightSegs = parseSegmentsString(rightTxt, 'dummy');

    const leftSum = leftSegs.reduce((sum, s) => sum + s.cols, 0);
    const rightSum = rightSegs.reduce((sum, s) => sum + s.cols, 0);

    const segments: RowSegment[] = [];
    if (leftSum > 0 || rightSum > 0) {
      if (leftSum + rightSum > total_cols) {
        throw new Error(`Row '${purpose}' has segment sums (${leftSum} + ${rightSum}) exceeding total columns (${total_cols}).`);
      }
      leftSegs.forEach(s => segments.push(s));
      const centerCols = total_cols - leftSum - rightSum;
      if (centerCols > 0) {
        segments.push({ purpose: purpose.toLowerCase(), cols: centerCols });
      }
      rightSegs.forEach(s => segments.push(s));
    }

    const rowConf: RowConfig = {
      purpose: purpose,
      rows: row_count,
      name: rowName,
      leftStr: leftTxt,
      rightStr: rightTxt,
      address: addressTxt
    };

    if (segments.length > 0) {
      rowConf.segments = segments;
    }

    rows.push(rowConf);

    // Check adjacent cells for ROV marker (starts from Column G which is rc + 1)
    for (let c = rc + 1; c < Math.min(rc + 10, colsCount); c++) {
      if (grid[r][c].toUpperCase() === 'ROV') {
        rov_purpose = purpose;
      }
    }

    r++;
  }

  if (!rov_purpose && rows.length > 0) {
    // Fallback: search for row block with "rov" in purpose or take the one that contains it
    const rovRow = rows.find(row => row.purpose.toLowerCase().includes('rov'));
    if (rovRow) {
      rov_purpose = rovRow.purpose;
    } else {
      // Default fallback
      rov_purpose = rows[rows.length - 1].purpose;
    }
  }

  // Validate purposes (including segments)
  rows.forEach(row => {
    const nameLower = row.purpose.toLowerCase();
    if (!cell_map[nameLower]) {
      cell_map[nameLower] = {
        name: row.purpose,
        lib: 'pixel_lib',
        cell: `cell_${nameLower}`,
        rot: 'R0'
      };
    }

    if (row.segments) {
      row.segments.forEach(seg => {
        const segLower = seg.purpose.toLowerCase();
        if (!cell_map[segLower]) {
          cell_map[segLower] = {
            name: seg.purpose,
            lib: 'pixel_lib',
            cell: `cell_${segLower}`,
            rot: 'R0'
          };
        }
      });
    }
  });

  return {
    top_lib,
    top_cell,
    x_pitch,
    y_pitch,
    total_cols,
        rov_purpose,
    rows,
    cell_map
  };
}

// Generate array buffer for downloading array_pixel.xlsx
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
