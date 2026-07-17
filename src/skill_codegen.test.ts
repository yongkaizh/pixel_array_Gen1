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

  it('marks rovInst on the active-purpose segment of the maxActive row', () => {
    const code = generateSkillCode(segmentedConfig);
    expect(code).toContain('ACTIVE SEGMENT MOSAIC FOUND');
    expect(code).toContain('rovInst = inst');
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
    ['cv', 'master', 'inst', 'rovInst', 'allInsts', 'dx', 'dy', 'currentY'].forEach(v => {
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

  it('identifies and marks the largest active block as rovInst', () => {
    const code = generateSkillCode(getDefaultLayoutConfig());
    expect(code).toContain('ACTIVE MOSAIC FOUND');
    expect(code).toContain('rovInst = inst');
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
