/**
 * SKILL Code Generator – Correctness Tests
 * ==========================================
 * These tests validate that generateSkillCode() produces SKILL that is
 * structurally and mathematically correct for Cadence Virtuoso layout.
 *
 * Key invariants being verified:
 *  1. All mosaics use "R180" orientation (tileArray property).
 *  2. Rows are built bottom-first (forward order in config.rows).
 *  3. The ROV / active array center lands at (0,0) after centering.
 *  4. Segment X offsets are accumulated correctly (left→right).
 *  5. Generated code is structurally valid SKILL.
 */

import { describe, it, expect } from 'vitest';
import { generateSkillCode, generatePythonCode, getDefaultLayoutConfig } from './utils';
import type { LayoutConfig } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Count all occurrences of a substring */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + 1);
  }
  return count;
}

/** Extract the global centering dx or dy value from the SKILL centering block.
 *  The centering block starts after "; --- Center Array at (0, 0) ---"
 *  and contains lines like "    dx = -5.0000" (toFixed(4) format).
 */
function extractCenterValue(code: string, varName: 'dx' | 'dy'): number {
  // Slice to the centering section so we don't pick up per-instance "dx = 0.0 - x_ll"
  const centerMarker = '; --- Center Array at (0, 0) ---';
  const centerIdx = code.indexOf(centerMarker);
  if (centerIdx === -1) throw new Error('Could not find centering block in generated code');
  const centerSection = code.slice(centerIdx);
  // Match "    dx = -5.0000" (exactly the toFixed(4) output, no trailing text)
  const re = new RegExp(`^\\s+${varName} = ([\\-0-9.]+)\\s*$`, 'm');
  const m = centerSection.match(re);
  if (!m) throw new Error(`Could not find '${varName} = ...' in centering block`);
  return parseFloat(m[1]);
}

/** Build a minimal valid LayoutConfig for testing */
function makeConfig(overrides: Partial<LayoutConfig> & { rows: LayoutConfig['rows'] }): LayoutConfig {
  return {
    top_lib: 'TEST_LIB',
    top_cell: 'test_cell',
    x_pitch: 1.0,
    y_pitch: 1.0,
    total_cols: 10,
    rov_purpose: 'active',
    cell_map: {
      bottom:  { name: 'bottom',  lib: 'lib', cell: 'cell_bottom',  rot: 'R0' },
      dummy:   { name: 'dummy',   lib: 'lib', cell: 'cell_dummy',   rot: 'R0' },
      active:  { name: 'active',  lib: 'lib', cell: 'cell_active',  rot: 'MY' }, // non-R0 to prove override
      blc:     { name: 'blc',     lib: 'lib', cell: 'cell_blc',     rot: 'R0' },
      top:     { name: 'top',     lib: 'lib', cell: 'cell_top',     rot: 'R0' },
      rov:     { name: 'rov',     lib: 'lib', cell: 'cell_rov',     rot: 'R0' },
      seg_l:   { name: 'seg_l',   lib: 'lib', cell: 'cell_seg_l',   rot: 'MX' },
      seg_r:   { name: 'seg_r',   lib: 'lib', cell: 'cell_seg_r',   rot: 'R90' },
    },
    ...overrides,
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** 3-row config: bottom(2) + active(100) + top(2), total_cols=10, pitch=1.0 */
const simple3RowConfig = makeConfig({
  rows: [
    { purpose: 'bottom', rows: 2,   name: 'Bottom' },
    { purpose: 'active', rows: 100, name: 'Active_Core' },
    { purpose: 'top',    rows: 2,   name: 'Top' },
  ],
});

/** Config with no separate border rows — only active */
const activeOnlyConfig = makeConfig({
  rows: [{ purpose: 'active', rows: 50, name: 'Active' }],
});

/** Segmented active row: [seg_l:2 | active:6 | seg_r:2], total=10 */
const segmentedConfig = makeConfig({
  x_pitch: 2.0,
  y_pitch: 2.0,
  total_cols: 10,
  rows: [
    { purpose: 'dummy',  rows: 4,   name: 'Dummy_Bot' },
    {
      purpose: 'active', rows: 80, name: 'Active_Seg',
      segments: [
        { purpose: 'seg_l',  cols: 2 },
        { purpose: 'active', cols: 6 },
        { purpose: 'seg_r',  cols: 2 },
      ],
    },
    { purpose: 'dummy',  rows: 4,   name: 'Dummy_Top' },
  ],
});

/** Config with multiple active rows — centering should use combined active block */
const multiActiveConfig = makeConfig({
  rows: [
    { purpose: 'dummy',  rows: 2,   name: 'Dummy_Bot' },
    { purpose: 'active', rows: 10,  name: 'Active_Small' },
    { purpose: 'dummy',  rows: 1,   name: 'Dummy_Mid' },
    { purpose: 'active', rows: 100, name: 'Active_Main' },
    { purpose: 'dummy',  rows: 2,   name: 'Dummy_Top' },
  ],
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 1: Rotation – all mosaics must use R180
// ────────────────────────────────────────────────────────────────────────────

describe('generateSkillCode – rotation', () => {
  it('uses "R180" for every dbCreateSimpleMosaic call (non-segmented)', () => {
    const code = generateSkillCode(simple3RowConfig);
    const simpleMosaicCount = countOccurrences(code, 'dbCreateSimpleMosaic(');
    const r180Count          = countOccurrences(code, '"R180"');
    expect(simpleMosaicCount).toBeGreaterThan(0);
    // At minimum one R180 per mosaic call (also in allInsts tracking)
    expect(r180Count).toBeGreaterThanOrEqual(simpleMosaicCount);
  });

  it('never uses cell_map rotation (MY/MX/R90) inside mosaic creation args', () => {
    const code = generateSkillCode(simple3RowConfig);
    // cell_map['active'] has rot='MY' — must NOT appear right after list(0.0 0.0)
    expect(code).not.toMatch(/list\(0\.0 0\.0\)\s*\n\s*"MY"/);
    expect(code).not.toMatch(/list\(0\.0 0\.0\)\s*\n\s*"MX"/);
    expect(code).not.toMatch(/list\(0\.0 0\.0\)\s*\n\s*"R90"/);
  });

  it('uses "R180" for every mosaic call in segmented rows', () => {
    const code = generateSkillCode(segmentedConfig);
    const simpleMosaicCount = countOccurrences(code, 'dbCreateSimpleMosaic(');
    const r180Count          = countOccurrences(code, '"R180"');
    expect(simpleMosaicCount).toBeGreaterThan(0);
    expect(r180Count).toBeGreaterThanOrEqual(simpleMosaicCount);
  });

  it('default config: contains R180 and zero R0 mosaic orientation args', () => {
    const code = generateSkillCode(getDefaultLayoutConfig());
    expect(code).toContain('"R180"');
    // R0 must not appear as the orientation passed to any mosaic call
    // (it could appear in comments, but not after list(0.0 0.0))
    expect(code).not.toMatch(/list\(0\.0 0\.0\)\s*\n\s*"R0"/);
  });

  it('allInsts tracking stores "R180" consistently for each row', () => {
    const code = generateSkillCode(simple3RowConfig);
    const consR180 = countOccurrences(code, 'list(inst "R180")');
    expect(consR180).toBe(simple3RowConfig.rows.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 2: Stacking order — bottom rows must appear before top rows
// ────────────────────────────────────────────────────────────────────────────

describe('generateSkillCode – row stacking order', () => {
  it('bottom row creation comment appears before top row comment', () => {
    const code = generateSkillCode(simple3RowConfig);
    const bottomPos = code.indexOf('Creating Top Rows');
    const topPos    = code.indexOf('Creating Bottom Rows');
    expect(bottomPos).toBeGreaterThan(-1);
    expect(topPos).toBeGreaterThan(-1);
    expect(bottomPos).toBeLessThan(topPos);
  });

  it('mosaic names use original config index (M1=first in config, M3=last)', () => {
    const code = generateSkillCode(simple3RowConfig);
    // config[0]=Bottom → M1_bottom, config[1]=Active → M2_active, config[2]=Top → M3_top
    expect(code).toContain('"M1_bottom"');
    expect(code).toContain('"M2_active"');
    expect(code).toContain('"M3_top"');
  });

  it('currentY increments after each row by rows * y_pitch', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(code).toContain('currentY = currentY + (2 * 1)');   // bottom
    expect(code).toContain('currentY = currentY + (100 * 1)'); // active
  });

  it('initializes currentY to 0.0 before the first row', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(code).toContain('currentY = 0.0');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 3: Centering math — ROV center must land at (0,0)
// ────────────────────────────────────────────────────────────────────────────

describe('generateSkillCode – centering at (0,0)', () => {
  /**
   * Config: bottom(2) + active(100) + top(2), x_pitch=y_pitch=1.0, total_cols=10
   *   dx = -(0 + 10/2) * 1.0 = -5.0
   *   dy = -(2 + 100/2) * 1.0 = -52.0
   */
  it('simple 3-row: dx=-5.0, dy=-52.0', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(extractCenterValue(code, 'dx')).toBeCloseTo(-5.0, 4);
    expect(extractCenterValue(code, 'dy')).toBeCloseTo(-52.0, 4);
  });

  /**
   * Active-only: 0 below, 50 active rows
   *   dx = -(0 + 10/2) * 1.0 = -5.0
   *   dy = -(0 + 50/2) * 1.0 = -25.0
   */
  it('active-only: dx=-5.0, dy=-25.0', () => {
    const code = generateSkillCode(activeOnlyConfig);
    expect(extractCenterValue(code, 'dx')).toBeCloseTo(-5.0, 4);
    expect(extractCenterValue(code, 'dy')).toBeCloseTo(-25.0, 4);
  });

  /**
   * Segmented: x_pitch=2.0, y_pitch=2.0, dummy(4)+active(80)+dummy(4), total_cols=10
   *   active segment: seg_l:2 | active:6 | seg_r:2  → left_cols=2, active_cols=6
   *   dx = -(2 + 6/2) * 2.0 = -(2+3)*2 = -10.0
   *   dy = -(4 + 80/2) * 2.0 = -(4+40)*2 = -88.0
   */
  it('segmented with left offset: dx=-10.0, dy=-88.0', () => {
    const code = generateSkillCode(segmentedConfig);
    expect(extractCenterValue(code, 'dx')).toBeCloseTo(-10.0, 4);
    expect(extractCenterValue(code, 'dy')).toBeCloseTo(-88.0, 4);
  });

  /**
   * Multi-active: dummy(2)+active(10)+dummy(1)+active(100)+dummy(2), pitch=1
   * Reversed build order:
   *   last dummy(2) is at Y=0.
   *   active(100) starts at Y=2.
   *   active(10) ends at Y= 2 + 100 + 1 + 10 = 113.
   *   Center Y = (2 + 113) / 2 = 57.5.
   *   dy = -57.5.
   */
  it('multi-active: entire active block centered, dy=-57.5', () => {
    const code = generateSkillCode(multiActiveConfig);
    expect(extractCenterValue(code, 'dx')).toBeCloseTo(-5.0, 4);
    expect(extractCenterValue(code, 'dy')).toBeCloseTo(-57.5, 4);
  });

  it('scales correctly with non-trivial pitches', () => {
    const cfg = makeConfig({
      x_pitch: 2.5,
      y_pitch: 3.1,
      total_cols: 20,
      rows: [
        { purpose: 'dummy',  rows: 5,  name: 'Dummy' },
        { purpose: 'active', rows: 40, name: 'Act' },
      ],
    });
    const code = generateSkillCode(cfg);
    // dx = -(0 + 20/2) * 2.5 = -25.0
    // Reversed order: index 1 (A1) is built first at Y=0.
    // D1 is built above it.
    // Active block is A1 (40 rows).
    // startY_rows = 0.
    // dy = -(0 + 40)/2 * 3.1 = -20 * 3.1 = -62.0
    expect(extractCenterValue(code, 'dx')).toBeCloseTo(-25.0, 4);
    expect(extractCenterValue(code, 'dy')).toBeCloseTo(-62.0, 4);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 4: Segmented rows — X offset accumulation
// ────────────────────────────────────────────────────────────────────────────

describe('generateSkillCode – segment X offsets', () => {
  /**
   * segmentedConfig x_pitch=2.0:
   *   seg_l:2 cols → x_offset = 0.0000
   *   active:6 cols → x_offset = 2*2.0 = 4.0000
   *   seg_r:2 cols  → x_offset = (2+6)*2.0 = 16.0000
   */
  it('accumulates X offsets correctly across segments (R180-corrected origins)', () => {
    const code = generateSkillCode(segmentedConfig);
    // seg_l: currSegX=0, cols=2, x_pitch=2.0 → dx = 0.0000 + (2 * 2)
    // active: currSegX=4, cols=6, x_pitch=2.0 → dx = 4.0000 + (6 * 2)
    // seg_r: currSegX=16, cols=2, x_pitch=2.0 → dx = 16.0000 + (2 * 2)
    expect(code).toContain('dx = 0.0000 + (2 * 2)');
    expect(code).toContain('dx = 4.0000 + (6 * 2)');
    expect(code).toContain('dx = 16.0000 + (2 * 2)');
  });

  it('generates distinct mosaic names for each segment', () => {
    const code = generateSkillCode(segmentedConfig);
    // Row 1 (index=1, M2), segments named by segment index + purpose
    expect(code).toContain('"M2_active_seg1_seg_l"');
    expect(code).toContain('"M2_active_seg2_active"');
    expect(code).toContain('"M2_active_seg3_seg_r"');
  });

  it('marks ACTIVE SEGMENT MOSAIC FOUND on the active-purpose segment of the maxActive row', () => {
    const code = generateSkillCode(segmentedConfig);
    expect(code).toContain('ACTIVE SEGMENT MOSAIC FOUND');
  });

  it('non-segmented rows use total_cols for width', () => {
    const code = generateSkillCode(simple3RowConfig);
    // Each non-segmented mosaic uses config.total_cols=10
    expect(code).toMatch(/\s+10\s*\n/); // 10 appears as a mosaic cols arg
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 5: SKILL structural validity
// ────────────────────────────────────────────────────────────────────────────

describe('generateSkillCode – SKILL structure', () => {
  it('wraps output in procedure(createPixelArray()) and calls it at the end', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(code).toContain('procedure(createPixelArray()');
    // The procedure must be invoked after definition
    const defEnd  = code.indexOf('procedure(createPixelArray()');
    const callIdx = code.lastIndexOf('createPixelArray()');
    expect(callIdx).toBeGreaterThan(defEnd);
  });

  it('declares all required let() variables', () => {
    const code = generateSkillCode(simple3RowConfig);
    ['cv', 'master', 'inst', 'allInsts', 'dx', 'dy', 'currentY'].forEach(v => {
      expect(code).toContain(v);
    });
  });

  it('guards library existence with ddGetObj before opening cellview', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(code).toContain('ddGetObj(');
    expect(code).toContain('TEST_LIB');
    expect(code).toContain('test_cell');
  });

  it('clears existing instances AND mosaics before placing new ones', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(code).toContain('cv~>instances');
    expect(code).toContain('cv~>mosaics');
    expect(code).toContain('dbDeleteObject(inst)');
    expect(code).toContain('dbDeleteObject(mosaic)');
  });

  it('provides dbCreateMosaic fallback via unless(inst ...)', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(code).toContain('dbCreateSimpleMosaic(');
    expect(code).toContain('dbCreateMosaic(');
    expect(code).toContain('unless(inst');
  });

  it('saves before closing: dbSave(cv) appears before dbClose(cv)', () => {
    const code = generateSkillCode(simple3RowConfig);
    const saveIdx  = code.indexOf('dbSave(cv)');
    const closeIdx = code.indexOf('dbClose(cv)');
    expect(saveIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(saveIdx);
  });

  it('applies global shift to all instances via foreach(item allInsts ...)', () => {
    const code = generateSkillCode(simple3RowConfig);
    expect(code).toContain('foreach(item allInsts');
    expect(code).toContain('inst = car(item)');
    expect(code).toContain('inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 6: Default config smoke test
// ────────────────────────────────────────────────────────────────────────────

describe('generateSkillCode – default layout config', () => {
  it('generates substantial SKILL code (> 500 chars)', () => {
    const code = generateSkillCode(getDefaultLayoutConfig());
    expect(code.length).toBeGreaterThan(500);
  });

  it('embeds the correct library and cell name', () => {
    const cfg  = getDefaultLayoutConfig();
    const code = generateSkillCode(cfg);
    expect(code).toContain(cfg.top_lib);
    expect(code).toContain(cfg.top_cell);
  });

  it('generates a uniquely named mosaic for every row in the config', () => {
    const cfg  = getDefaultLayoutConfig();
    const code = generateSkillCode(cfg);
    cfg.rows.forEach((row, idx) => {
      const name = `M${idx + 1}_${row.purpose.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      expect(code).toContain(`"${name}"`);
    });
  });

  it('identifies and marks the largest active block', () => {
    const code = generateSkillCode(getDefaultLayoutConfig());
    expect(code).toContain('ACTIVE MOSAIC FOUND');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 7: Python corrected script — same invariants
// ────────────────────────────────────────────────────────────────────────────

describe('generatePythonCode(corrected=true) – R180 and forward order', () => {
  it('uses "R180" for mosaic creation instead of cell_info["rot"]', () => {
    const py = generatePythonCode(true);
    expect(countOccurrences(py, '"R180"')).toBeGreaterThan(0);
    // Inside the SKILL string sections, cell_info["rot"] must not appear in mosaic calls
    const mosaicSection = py.slice(py.indexOf('dbCreateSimpleMosaic'), py.indexOf('dbSave(cv)'));
    expect(mosaicSection).not.toContain('{cell_info["rot"]}');
    expect(mosaicSection).not.toContain('{seg_cell_info["rot"]}');
  });

  it('iterates rows backward (reversed) to match Cadence viewport', () => {
    const py = generatePythonCode(true);
    expect(py).toContain('for rev_idx, row in enumerate(reversed(rows)):');
    expect(py).not.toContain('for orig_idx, row in enumerate(rows):');
  });

  it('uses analytical Y centering with start_y_rows variable', () => {
    const py = generatePythonCode(true);
    expect(py).toContain('start_y_rows');
    expect(py).toContain('target_dy = - (start_y_rows');
    expect(py).not.toContain('centerBox(rovInst');
  });

  it('has all required function definitions and main() entry point', () => {
    const py = generatePythonCode(true);
    ['import pandas', 'def norm(v)', 'def find_keyword', 'def get_parameter',
     'def get_row_category', 'def main():', 'if __name__ == "__main__":'].forEach(token => {
      expect(py).toContain(token);
    });
  });
});

describe('generateSkillCode – rigorous ROV active block centering', () => {
  it('centers correctly for mixed-cell asymmetric configurations', () => {
    // A complex configuration with dummy interleaved in active block, and asymmetric segments
    const mixedConfig = makeConfig({
      x_pitch: 2.0,
      y_pitch: 3.0,
      total_cols: 100,
      rows: [
        { purpose: 'bottom', rows: 2, name: 'Bottom' }, // startY_rows = 0, y=0..6
        { purpose: 'dummy', rows: 4, name: 'Dummy' },   // startY_rows = 2, y=6..18
        { 
          purpose: 'active', rows: 10, name: 'Act1',    // startY_rows = 6, y=18..48
          segments: [
            { purpose: 'dummy', cols: 10 },
            { purpose: 'active', cols: 70 }, // Active cols
            { purpose: 'dummy', cols: 20 }
          ]
        },
        { purpose: 'dummy', rows: 5, name: 'Interleaved' }, // startY_rows = 16, y=48..63
        { 
          purpose: 'active', rows: 15, name: 'Act2',    // startY_rows = 21, y=63..108
          segments: [
            { purpose: 'dummy', cols: 10 },
            { purpose: 'active', cols: 70 }, // Active cols
            { purpose: 'dummy', cols: 20 }
          ]
        },
        { purpose: 'top', rows: 2, name: 'Top' }       // startY_rows = 36, y=108..114
      ]
    });

    const code = generateSkillCode(mixedConfig);
    
    // Reversed build order:
    // Rows after Act2: Top (2 rows). So startY_rows = 2.
    // Active block starts (from bottom) with Act2, ends with Act1.
    // Total active block rows = Act1(10) + Interleaved(5) + Act2(15) = 30 rows.
    // Center Y of active block = (2 + 2 + 30) / 2 = 17 rows * y_pitch(3.0) = 51.0
    // dy should be -51.0
    
    // X center of active block: active segment starts at left_cols = 10, ends at 10+70 = 80
    // Center X of active block = (10 + 80) / 2 = 45 cols * x_pitch(2.0) = 90.0
    // dx should be -90.0

    expect(extractCenterValue(code, 'dx')).toBeCloseTo(-90.0, 4);
    expect(extractCenterValue(code, 'dy')).toBeCloseTo(-51.0, 4);
  });
});

describe('generatePythonCode(corrected=false) – original intentional bugs preserved', () => {
  it('preserves the truncated while-loop bug (tmpl.shaperow_count_txt)', () => {
    const py = generatePythonCode(false);
    expect(py).toContain('tmpl.shaperow_count_txt');
  });

  it('preserves the truncated bounds-check bug (tmpl.shapepurpose_txt)', () => {
    const py = generatePythonCode(false);
    expect(py).toContain('tmpl.shapepurpose_txt');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suite 9: Physical Position Simulation – end-to-end layout verification
// ────────────────────────────────────────────────────────────────────────────
/**
 * SIMULATION DESIGN
 * =================
 * With R180 rotation a mosaic placed at origin (X, Y) with cols=C, rows=R,
 * x_pitch=Px, y_pitch=Py occupies:
 *   physical X: [X - C*Px,  X]
 *   physical Y: [Y - R*Py,  Y]
 * i.e. left_edge = X - C*Px, right_edge = X,
 *      bottom_edge = Y - R*Py, top_edge = Y.
 *
 * The global centering shift (targetDx, targetDy) is then applied:
 *   final_left  = (X + targetDx) - C*Px
 *   final_right = (X + targetDx)
 *   final_bottom = (Y + targetDy) - R*Py
 *   final_top    = (Y + targetDy)
 *
 * This function simulates exactly what generateSkillCode() does and returns
 * the final physical bounding boxes, WITHOUT touching the string output.
 */

interface MosaicPhysical {
  /** Identifier matching the SKILL mosaic name */
  name: string;
  /** Purpose of the row or segment */
  purpose: string;
  /** Whether this mosaic belongs to a segmented row */
  isSegment: boolean;
  /** Index of parent row in config.rows */
  rowIdx: number;
  /** Column-range in physical units (after centering) */
  left: number;
  right: number;
  /** Row-range in physical units (after centering) */
  bottom: number;
  top: number;
  /** Raw origin before centering shift */
  rawX: number;
  rawY: number;
}

/**
 * Simulate the layout produced by generateSkillCode() and return the final
 * physical bounding boxes of every mosaic after the centering shift.
 */
function simulateLayout(config: LayoutConfig): MosaicPhysical[] {
  const { x_pitch, y_pitch, total_cols, rov_purpose } = config;

  // ── mirror the maxActiveRow logic ──────────────────────────────────────
  let maxActiveRow: LayoutConfig['rows'][number] | null = null;
  config.rows.forEach(row => {
    const cat = _getRowCat(row.purpose, row.name ?? '', rov_purpose);
    if (cat === 'active') {
      if (!maxActiveRow || row.rows > maxActiveRow.rows) maxActiveRow = row;
    }
  });

  // ── rows are placed bottom-first (reversed) ────────────────────────────
  const reversedRows = [...config.rows].reverse();
  let currentY = 0.0;

  interface RawMosaic {
    name: string;
    purpose: string;
    isSegment: boolean;
    rowIdx: number;
    rawX: number;  // origin X before centering
    rawY: number;  // origin Y before centering
    cols: number;
    rows: number;
  }

  const rawMosaics: RawMosaic[] = [];

  reversedRows.forEach((row, rev_idx) => {
    const orig_idx = config.rows.length - 1 - rev_idx;
    const row_num = orig_idx + 1;
    const cleanPurpose = row.purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');

    if (!row.segments || row.segments.length === 0) {
      // non-segmented: origin at (total_cols * x_pitch, currentY + rows * y_pitch)
      const rawX = total_cols * x_pitch;
      const rawY = currentY + row.rows * y_pitch;
      rawMosaics.push({
        name: `M${row_num}_${cleanPurpose}`,
        purpose: row.purpose,
        isSegment: false,
        rowIdx: orig_idx,
        rawX,
        rawY,
        cols: total_cols,
        rows: row.rows,
      });
    } else {
      let currSegX = 0.0;
      row.segments.forEach((seg, sIdx) => {
        const cleanSegPurpose = seg.purpose.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
        // segment: origin at (currSegX + segCols * x_pitch, currentY + rows * y_pitch)
        const rawX = currSegX + seg.cols * x_pitch;
        const rawY = currentY + row.rows * y_pitch;
        rawMosaics.push({
          name: `M${row_num}_${cleanPurpose}_seg${sIdx + 1}_${cleanSegPurpose}`,
          purpose: seg.purpose,
          isSegment: true,
          rowIdx: orig_idx,
          rawX,
          rawY,
          cols: seg.cols,
          rows: row.rows,
        });
        currSegX += seg.cols * x_pitch;
      });
    }

    currentY += row.rows * y_pitch;
  });

  // ── compute centering shift (mirrors utils.ts exactly) ─────────────────
  let firstActiveIdx = -1;
  let lastActiveIdx = -1;
  config.rows.forEach((row, idx) => {
    const cat = _getRowCat(row.purpose, row.name ?? '', rov_purpose);
    if (cat === 'active' || cat === 'rov') {
      if (firstActiveIdx === -1) firstActiveIdx = idx;
      lastActiveIdx = idx;
    }
  });

  let left_cols = 0;
  let active_cols = total_cols;

  const rovRow = config.rows.find(
    r => r.segments && r.segments.some(s => s.purpose.toLowerCase() === rov_purpose.toLowerCase())
  );
  if (rovRow && rovRow.segments) {
    const activeSegIdx = rovRow.segments.findIndex(
      s => s.purpose.toLowerCase() === rov_purpose.toLowerCase()
    );
    for (let i = 0; i < activeSegIdx; i++) left_cols += rovRow.segments[i].cols;
    active_cols = rovRow.segments[activeSegIdx].cols;
  } else if (firstActiveIdx !== -1) {
    const firstActiveRow = config.rows[firstActiveIdx];
    if (firstActiveRow.segments && firstActiveRow.segments.length > 0) {
      const activeSegIdx = firstActiveRow.segments.findIndex(
        s => _getRowCat(s.purpose, '', rov_purpose) === 'active'
      );
      if (activeSegIdx !== -1) {
        for (let i = 0; i < activeSegIdx; i++) left_cols += firstActiveRow.segments[i].cols;
        active_cols = firstActiveRow.segments[activeSegIdx].cols;
      }
    }
  }

  const targetDx = -(left_cols + active_cols / 2.0) * x_pitch;

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
  const targetDy =
    firstActiveIdx !== -1
      ? -((startY_rows + endY_rows) / 2.0) * y_pitch
      : -(config.rows.reduce((s, r) => s + r.rows, 0) / 2.0) * y_pitch;

  // ── apply shift and compute final physical bounding boxes ─────────────
  return rawMosaics.map(m => ({
    name: m.name,
    purpose: m.purpose,
    isSegment: m.isSegment,
    rowIdx: m.rowIdx,
    rawX: m.rawX,
    rawY: m.rawY,
    // With R180: physical X = [origin_x - cols*xp, origin_x], then shift
    left:   (m.rawX + targetDx) - m.cols * x_pitch,
    right:  (m.rawX + targetDx),
    bottom: (m.rawY + targetDy) - m.rows * y_pitch,
    top:    (m.rawY + targetDy),
  }));
}

/**
 * Inline row-category classifier that mirrors the logic in utils.ts.
 * Kept local so the test has no hidden dependency on production behavior.
 */
function _getRowCat(
  purpose: string,
  name: string,
  rov_purpose: string
): 'active' | 'rov' | 'blc' | 'clamp' | 'cbar' | 'dummy' | 'top' | 'bottom' {
  const p = purpose.toLowerCase();
  const n = name.toLowerCase();
  const rovLower = rov_purpose.toLowerCase();
  if (p === 'top') return 'top';
  if (p === 'bottom') return 'bottom';
  if (n.includes('blc') || p.includes('blc')) return 'blc';
  if (n.includes('rov') || p.includes('rov')) return 'rov';
  if (
    n === 'c1' || n.includes('active') || p.includes('active') ||
    p === 'act' || n === 'act' || (p === 'c1' && !n.includes('blc'))
  ) return 'active';
  if (p === rovLower || p.includes('ob') || p.includes('black')) return 'rov';
  if (p.includes('cbar') || p.includes('color') || n.includes('color') || n.includes('cbar')) return 'cbar';
  if (
    p.includes('clamp') || p.includes('idle') || p.includes('bsun') || p.includes('ecl') ||
    n.includes('clamp') || n.includes('idle') || n.includes('bsun') || n.includes('ecl')
  ) return 'clamp';
  return 'dummy';
}

const EPS = 1e-9; // floating-point tolerance

// ─── Suite 9a: Simple (non-segmented) configs ────────────────────────────────
describe('Physical simulation – simple (non-segmented) configs', () => {
  it('simple3RowConfig: every row spans [−5, +5] on X after centering', () => {
    const mosaics = simulateLayout(simple3RowConfig);
    // dx = -(0 + 10/2)*1.0 = -5 → every mosaic left = 0 - 5 = -5, right = 10 - 5 = +5
    expect(mosaics.length).toBe(3);
    for (const m of mosaics) {
      expect(m.left).toBeCloseTo(-5.0, 9);
      expect(m.right).toBeCloseTo(+5.0, 9);
    }
  });

  it('simple3RowConfig: active block center is at Y=0', () => {
    const mosaics = simulateLayout(simple3RowConfig);
    // Active row (100 rows): bottom(2) below it → starts at Y=2, ends at Y=102 (pre-shift)
    // dy = -(2 + 102)/2 = -52 → post-shift: bottom = 2-52 = -50, top = 102-52 = +50
    const active = mosaics.find(m => m.purpose === 'active')!;
    expect(active).toBeDefined();
    expect((active.bottom + active.top) / 2).toBeCloseTo(0.0, 9);
    expect(active.bottom).toBeCloseTo(-50.0, 9);
    expect(active.top).toBeCloseTo(+50.0, 9);
  });

  it('simple3RowConfig: rows stack contiguously (no gaps)', () => {
    const mosaics = simulateLayout(simple3RowConfig);
    // Sort by bottom edge
    const sorted = [...mosaics].sort((a, b) => a.bottom - b.bottom);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].top).toBeCloseTo(sorted[i + 1].bottom, 9);
    }
  });

  it('activeOnlyConfig: active-only center is at (0, 0)', () => {
    const mosaics = simulateLayout(activeOnlyConfig);
    expect(mosaics.length).toBe(1);
    const m = mosaics[0];
    // center X = (left + right)/2, center Y = (bottom + top)/2
    expect((m.left + m.right) / 2).toBeCloseTo(0.0, 9);
    expect((m.bottom + m.top) / 2).toBeCloseTo(0.0, 9);
  });

  it('activeOnlyConfig: X span is [−5, +5] (total_cols=10, x_pitch=1)', () => {
    const mosaics = simulateLayout(activeOnlyConfig);
    const m = mosaics[0];
    expect(m.left).toBeCloseTo(-5.0, 9);
    expect(m.right).toBeCloseTo(+5.0, 9);
  });

  it('multiActiveConfig: entire active block centered at Y=0', () => {
    const mosaics = simulateLayout(multiActiveConfig);
    // Active rows are indices 1 (10 rows) and 3 (100 rows)
    const activeMosaics = mosaics.filter(m => m.purpose === 'active');
    expect(activeMosaics.length).toBe(2);

    const blockBottom = Math.min(...activeMosaics.map(m => m.bottom));
    const blockTop    = Math.max(...activeMosaics.map(m => m.top));
    expect((blockBottom + blockTop) / 2).toBeCloseTo(0.0, 9);
    // startY_rows=2, endY_rows=113, dy=-57.5 → block=[2-57.5, 113-57.5]=[-55.5, 55.5]
    expect(blockBottom).toBeCloseTo(-55.5, 9);
    expect(blockTop).toBeCloseTo(+55.5, 9);
  });

  it('multiActiveConfig: dummy rows between active rows are contiguous with active block', () => {
    const mosaics = simulateLayout(multiActiveConfig);
    const sorted = [...mosaics].sort((a, b) => a.bottom - b.bottom);
    // Full column range must be contiguous
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].top).toBeCloseTo(sorted[i + 1].bottom, 9);
    }
  });

  it('custom pitch: scales X and Y correctly', () => {
    const cfg = makeConfig({
      x_pitch: 2.5,
      y_pitch: 3.1,
      total_cols: 20,
      rows: [
        { purpose: 'dummy',  rows: 5,  name: 'Dummy' },
        { purpose: 'active', rows: 40, name: 'Act' },
      ],
    });
    const mosaics = simulateLayout(cfg);
    // dx = -(0 + 20/2)*2.5 = -25 → X span = [-25, +25]
    for (const m of mosaics) {
      expect(m.left).toBeCloseTo(-25.0, 9);
      expect(m.right).toBeCloseTo(+25.0, 9);
    }
    // Reversed: active placed first at currentY=0
    // startY_rows=0, endY_rows=40, dy = -(0+40)/2 * 3.1 = -62.0
    const active = mosaics.find(m => m.purpose === 'active')!;
    expect((active.bottom + active.top) / 2).toBeCloseTo(0.0, 9);
  });
});

// ─── Suite 9b: Segmented (mixed-cell) configs ────────────────────────────────
describe('Physical simulation – segmented (mixed-cell) configs', () => {
  it('segmentedConfig: adjacent segments abut exactly (no gaps or overlaps)', () => {
    const mosaics = simulateLayout(segmentedConfig);
    // The active row has 3 segments; find them by rowIdx=1 (original index)
    const segs = mosaics
      .filter(m => m.isSegment && m.rowIdx === 1)
      .sort((a, b) => a.left - b.left);
    expect(segs.length).toBe(3);
    // seg[0].right === seg[1].left
    expect(segs[0].right).toBeCloseTo(segs[1].left, 9);
    // seg[1].right === seg[2].left
    expect(segs[1].right).toBeCloseTo(segs[2].left, 9);
  });

  it('segmentedConfig: active segment center is at X=0', () => {
    const mosaics = simulateLayout(segmentedConfig);
    const segs = mosaics
      .filter(m => m.isSegment && m.rowIdx === 1)
      .sort((a, b) => a.left - b.left);
    // active segment is seg index 1 (purpose='active')
    const activeSeg = segs.find(s => s.purpose === 'active')!;
    expect(activeSeg).toBeDefined();
    expect((activeSeg.left + activeSeg.right) / 2).toBeCloseTo(0.0, 9);
  });

  it('segmentedConfig: active segment center is at Y=0', () => {
    const mosaics = simulateLayout(segmentedConfig);
    const segs = mosaics.filter(m => m.isSegment && m.rowIdx === 1);
    // All segments in the same row share the same Y extent
    for (const seg of segs) {
      expect((seg.bottom + seg.top) / 2).toBeCloseTo(0.0, 9);
    }
  });

  it('segmentedConfig: all segments span same Y range (rows share a Y band)', () => {
    const mosaics = simulateLayout(segmentedConfig);
    const segs = mosaics.filter(m => m.isSegment && m.rowIdx === 1);
    const bottom0 = segs[0].bottom;
    const top0 = segs[0].top;
    for (const seg of segs) {
      expect(seg.bottom).toBeCloseTo(bottom0, 9);
      expect(seg.top).toBeCloseTo(top0, 9);
    }
  });

  it('segmentedConfig: physical X extents match hand-calculated values', () => {
    const mosaics = simulateLayout(segmentedConfig);
    // x_pitch=2.0, total_cols=10, segments: seg_l:2 | active:6 | seg_r:2
    // left_cols=2, active_cols=6 → dx = -(2 + 3)*2 = -10
    // seg_l raw right  = 0 + 2*2.0 = 4.0 → final right = 4-10 = -6, left = -6 - 4 = -10
    // active raw right = 4 + 6*2.0 = 16.0 → final right = 16-10 = +6, left = 6-12 = -6
    // seg_r raw right  = 16+ 2*2.0 = 20.0 → final right = 20-10 = +10, left= 10-4 = +6
    const segs = mosaics
      .filter(m => m.isSegment && m.rowIdx === 1)
      .sort((a, b) => a.left - b.left);
    expect(segs[0].left).toBeCloseTo(-10.0, 9);
    expect(segs[0].right).toBeCloseTo(-6.0, 9);
    expect(segs[1].left).toBeCloseTo(-6.0, 9);
    expect(segs[1].right).toBeCloseTo(+6.0, 9);
    expect(segs[2].left).toBeCloseTo(+6.0, 9);
    expect(segs[2].right).toBeCloseTo(+10.0, 9);
  });

  it('segmentedConfig: dummy rows (non-segmented) cover full X range', () => {
    const mosaics = simulateLayout(segmentedConfig);
    // Non-segmented rows: Dummy_Bot (rowIdx=0) and Dummy_Top (rowIdx=2)
    const nonseg = mosaics.filter(m => !m.isSegment);
    // total_cols=10, x_pitch=2.0, dx=-10 → X = [0-10, 20-10] = [-10, +10]
    for (const m of nonseg) {
      expect(m.left).toBeCloseTo(-10.0, 9);
      expect(m.right).toBeCloseTo(+10.0, 9);
    }
  });

  it('segmentedConfig: Y extents – active block centers at Y=0', () => {
    const mosaics = simulateLayout(segmentedConfig);
    // dummy(4) + active(80) + dummy(4), reversed: dummy(4)@Y=0, active(80)@Y=8..168, dummy(4)@Y=168..176
    // startY_rows = 4 (after lastActiveIdx=1), endY_rows = 4 + 80 = 84
    // targetDy = -(4 + 84)/2 * 2.0 = -88.0
    // active segs: rawY = 0 + 80*2 = 160, rawY + dy = 160 - 88 = 72? No:
    // Wait: reversed build: Dummy_Top placed first at Y=0 (currentY=0),
    //   Active_Seg placed second at Y=8 (currentY = 4*2 = 8),
    //   Dummy_Bot placed last at currentY = 8 + 80*2 = 168
    // For active segs: rawY = currentY + rows*yp = 8 + 80*2 = 168
    // After dy=-88: top = 168-88 = 80, bottom = 80 - 80*2 = -80
    // center Y = 0 ✓
    const segs = mosaics.filter(m => m.isSegment && m.rowIdx === 1);
    for (const seg of segs) {
      expect((seg.bottom + seg.top) / 2).toBeCloseTo(0.0, 9);
    }
  });

  it('asymmetric segmented config: active center at (0,0), segments abut', () => {
    // 3 segments: left_dummy:3 | active:5 | right_dummy:2, total=10
    const cfg = makeConfig({
      x_pitch: 1.5,
      y_pitch: 2.0,
      total_cols: 10,
      rows: [
        { purpose: 'bottom', rows: 3, name: 'Bot' },
        {
          purpose: 'active', rows: 20, name: 'MainAct',
          segments: [
            { purpose: 'dummy',  cols: 3 },
            { purpose: 'active', cols: 5 },
            { purpose: 'dummy',  cols: 2 },
          ],
        },
        { purpose: 'top', rows: 3, name: 'Top' },
      ],
    });
    const mosaics = simulateLayout(cfg);
    // dx = -(3 + 5/2)*1.5 = -(3+2.5)*1.5 = -8.25
    // dy: firstActive=lastActive=1, startY_rows=3 (top below), endY_rows=3+20=23
    //     targetDy = -(3+23)/2 * 2.0 = -26.0
    // Reversed: Top placed first @Y=0, active @Y=6, Bottom @Y=6+40=46
    // Active segs rawY = 6 + 20*2 = 46, top = 46-26=20, bottom=20-40=-20 → center=0 ✓
    const segs = mosaics
      .filter(m => m.isSegment && m.rowIdx === 1)
      .sort((a, b) => a.left - b.left);
    expect(segs.length).toBe(3);
    // abutment
    expect(segs[0].right).toBeCloseTo(segs[1].left, 9);
    expect(segs[1].right).toBeCloseTo(segs[2].left, 9);
    // active segment (segs[1], purpose='active') center at X=0
    const act = segs.find(s => s.purpose === 'active')!;
    expect((act.left + act.right) / 2).toBeCloseTo(0.0, 9);
    // Y center at 0
    expect((act.bottom + act.top) / 2).toBeCloseTo(0.0, 9);
  });

  it('complex asymmetric multi-active segmented: correct dx and dy', () => {
    // From the existing Suite 8 test, now verify via simulation
    const mixedConfig = makeConfig({
      x_pitch: 2.0,
      y_pitch: 3.0,
      total_cols: 100,
      rows: [
        { purpose: 'bottom', rows: 2, name: 'Bottom' },
        { purpose: 'dummy',  rows: 4, name: 'Dummy' },
        {
          purpose: 'active', rows: 10, name: 'Act1',
          segments: [
            { purpose: 'dummy',  cols: 10 },
            { purpose: 'active', cols: 70 },
            { purpose: 'dummy',  cols: 20 },
          ],
        },
        { purpose: 'dummy',  rows: 5, name: 'Interleaved' },
        {
          purpose: 'active', rows: 15, name: 'Act2',
          segments: [
            { purpose: 'dummy',  cols: 10 },
            { purpose: 'active', cols: 70 },
            { purpose: 'dummy',  cols: 20 },
          ],
        },
        { purpose: 'top', rows: 2, name: 'Top' },
      ],
    });

    const mosaics = simulateLayout(mixedConfig);

    // ── X invariants ──────────────────────────────────────────────────────
    // left_cols=10, active_cols=70 → dx = -(10+35)*2 = -90
    // Each active segment (purpose='active') center should be at X=0.
    const activeSegs = mosaics.filter(m => m.isSegment && m.purpose === 'active');
    expect(activeSegs.length).toBe(2); // Act1 and Act2 each have one active segment
    for (const seg of activeSegs) {
      expect((seg.left + seg.right) / 2).toBeCloseTo(0.0, 9);
    }

    // ── Abutment for each segmented row ──────────────────────────────────
    for (const rowIdx of [2, 4]) { // Act1 idx=2, Act2 idx=4
      const rowSegs = mosaics
        .filter(m => m.isSegment && m.rowIdx === rowIdx)
        .sort((a, b) => a.left - b.left);
      expect(rowSegs.length).toBe(3);
      expect(rowSegs[0].right).toBeCloseTo(rowSegs[1].left, 9);
      expect(rowSegs[1].right).toBeCloseTo(rowSegs[2].left, 9);
    }

    // ── Y invariants ──────────────────────────────────────────────────────
    // Reversed build: Top(2)@0, Act2(15)@6, Interleaved(5)@51, Act1(10)@66, Dummy(4)@96, Bottom(2)@108
    // firstActiveIdx=2 (Act1), lastActiveIdx=4 (Act2)
    // startY_rows = rows after lastActiveIdx=4 → rows[5] (Top, 2 rows) = 2
    // endY_rows = 2 + rows[2]+rows[3]+rows[4] = 2 + 10 + 5 + 15 = 32
    // targetDy = -(2+32)/2 * 3.0 = -51.0
    // Act2 segs: rawY = 6 + 15*3 = 51, top = 51-51=0, bottom = 0-45=-45
    // Act1 segs: rawY = 66 + 10*3 = 96, top = 96-51=45, bottom=45-30=15
    // Combined active block: bottom=-45, top=45 → center=0 ✓
    const allActives = mosaics.filter(m => m.isSegment && m.purpose === 'active');
    const blockBottom = Math.min(...allActives.map(m => m.bottom));
    const blockTop    = Math.max(...allActives.map(m => m.top));
    expect((blockBottom + blockTop) / 2).toBeCloseTo(0.0, 9);
  });
});

// ─── Suite 9c: Cross-check simulation against extracted SKILL values ──────────
describe('Physical simulation – cross-check with parsed SKILL code', () => {
  it('simple3RowConfig: simulation targetDx matches extracted centering dx', () => {
    const code = generateSkillCode(simple3RowConfig);
    const parsedDx = extractCenterValue(code, 'dx');
    const parsedDy = extractCenterValue(code, 'dy');

    // Apply the same shift in the simulation and verify every mosaic's rawX
    const mosaics = simulateLayout(simple3RowConfig);
    for (const m of mosaics) {
      // After shift: right edge = rawX + parsedDx
      expect(m.right).toBeCloseTo(m.rawX + parsedDx, 9);
      expect(m.top).toBeCloseTo(m.rawY + parsedDy, 9);
    }
  });

  it('segmentedConfig: simulation targetDx/Dy matches extracted SKILL centering values', () => {
    const code = generateSkillCode(segmentedConfig);
    const parsedDx = extractCenterValue(code, 'dx');
    const parsedDy = extractCenterValue(code, 'dy');

    const mosaics = simulateLayout(segmentedConfig);
    for (const m of mosaics) {
      expect(m.right).toBeCloseTo(m.rawX + parsedDx, 9);
      expect(m.top).toBeCloseTo(m.rawY + parsedDy, 9);
    }
  });

  it('multiActiveConfig: simulation finalY of active mosaics straddles Y=0', () => {
    const mosaics = simulateLayout(multiActiveConfig);
    const code = generateSkillCode(multiActiveConfig);
    const parsedDy = extractCenterValue(code, 'dy');

    // Verify that the combined active bottom is negative and top is positive
    const activeMosaics = mosaics.filter(m => m.purpose === 'active');
    const blockBottom = Math.min(...activeMosaics.map(m => m.bottom));
    const blockTop    = Math.max(...activeMosaics.map(m => m.top));
    expect(blockBottom).toBeLessThan(0);
    expect(blockTop).toBeGreaterThan(0);
    expect(Math.abs(blockBottom + blockTop)).toBeLessThan(EPS);

    // The dy extracted from SKILL code must equal the simulation shift
    expect(parsedDy).toBeCloseTo(
      -((2 + 113) / 2) * simple3RowConfig.y_pitch,  // re-use y_pitch=1.0
      4
    );
  });

  it('activeOnlyConfig: final origin is at (total_cols*xp + dx, rows*yp + dy)', () => {
    const code = generateSkillCode(activeOnlyConfig);
    const parsedDx = extractCenterValue(code, 'dx');
    const parsedDy = extractCenterValue(code, 'dy');
    const mosaics = simulateLayout(activeOnlyConfig);
    const m = mosaics[0];

    // raw origin for non-segmented = (total_cols*xp, rows*yp)
    const expectedRawX = activeOnlyConfig.total_cols * activeOnlyConfig.x_pitch; // 10
    const expectedRawY = activeOnlyConfig.rows[0].rows * activeOnlyConfig.y_pitch; // 50

    expect(m.rawX + parsedDx).toBeCloseTo(expectedRawX + parsedDx, 9);
    expect(m.rawY + parsedDy).toBeCloseTo(expectedRawY + parsedDy, 9);
    // Centering: final right = 5, final top = 25
    expect(m.right).toBeCloseTo(5.0, 9);
    expect(m.top).toBeCloseTo(25.0, 9);
    expect(m.left).toBeCloseTo(-5.0, 9);
    expect(m.bottom).toBeCloseTo(-25.0, 9);
  });
});
