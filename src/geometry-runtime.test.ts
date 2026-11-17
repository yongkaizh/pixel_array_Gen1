import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateSkillCode } from './generators/skill';
import { getDefaultLayoutConfig } from './config/defaults';
import { runSkill, Box, transformBox } from './test/skillHarness';
import { nominalCenter } from './math/layout';
import type { LayoutConfig } from './types';

const rotations = ['R0', 'R90', 'R180', 'R270', 'MX', 'MY', 'MXR90', 'MYR90'];
function config(rot: string): LayoutConfig {
  return { ...getDefaultLayoutConfig(), total_cols: 7, x_pitch: 2, y_pitch: 3, rov_purpose: 'sensor',
    rows: [{ purpose: 'sensor', rows: 5 }],
    cell_map: { sensor: { name: 'sensor', lib: 'lib', cell: 'sensor', rot } } };
}

function checkCentered(box: Box) {
  expect(box[0][0] + box[1][0]).toBeCloseTo(0, 10);
  expect(box[0][1] + box[1][1]).toBeCloseTo(0, 10);
}

describe('executed SKILL geometry', () => {
  it.each(rotations)('%s centers measured geometry with offset origins and unequal pitch', rot => {
    const cellBox: Box = [[10, -20], [11.25, -17.5]];
    const master = { bBox: cellBox, shapes: [{ objType: 'rect', bBox: cellBox }] };
    const cv = runSkill(generateSkillCode(config(rot)), { 'lib/sensor': master });
    expect(cv.mosaics).toHaveLength(1);
    expect(cv.shapes).toHaveLength(1);
    checkCentered(cv.shapes[0].bBox);
    const b = cv.shapes[0].bBox;
    const swapped = ['R90', 'R270', 'MXR90', 'MYR90'].includes(rot);
    // N origins have N-1 pitch intervals; cell size supplies the final extent.
    expect(b[1][0] - b[0][0]).toBeCloseTo(6 * 2 + (swapped ? 2.5 : 1.25), 10);
    expect(b[1][1] - b[0][1]).toBeCloseTo(4 * 3 + (swapped ? 1.25 : 2.5), 10);
  });

  it('centers all matching segments in the chosen block instead of the last segment', () => {
    const c = { ...config('R180'), total_cols: 10, rows: [{ purpose: 'sensor', rows: 5, segments: [
      { purpose: 'sensor', cols: 2 }, { purpose: 'padding', cols: 5 }, { purpose: 'sensor', cols: 3 },
    ] }], cell_map: { ...config('R180').cell_map, padding: { name: 'padding', lib: 'lib', cell: 'padding', rot: 'R0' } } };
    const cv = runSkill(generateSkillCode(c), {
      'lib/sensor': { bBox: [[0, 0], [2, 3]] }, 'lib/padding': { bBox: [[20, 10], [22, 13]] },
    });
    expect(cv.shapes).toHaveLength(2);
    const bounds: Box = [[Math.min(...cv.shapes.map((s: any) => s.bBox[0][0])), Math.min(...cv.shapes.map((s: any) => s.bBox[0][1]))],
      [Math.max(...cv.shapes.map((s: any) => s.bBox[1][0])), Math.max(...cv.shapes.map((s: any) => s.bBox[1][1]))]];
    checkCentered(bounds);
    expect(nominalCenter(c)).toEqual({ x: 10, y: 7.5 });
  });

  it('handles nested hierarchy query paths and ignores labels when measuring reference bounds', () => {
    const leafBox: Box = [[1, 2], [2, 4]];
    const transform = [[20, -10], 'R90', 1];
    const nested = [{ transform }, [{ transform: [[100, 100], 'R0', 1] }, { objType: 'rect', bBox: leafBox }]];
    // The API supplies the composed transform; this fixture deliberately differs from the leaf coordinates.
    const master = { bBox: [[-100, -100], [100, 100]] as Box, shapes: [nested, { objType: 'label', bBox: [[-100, -100], [100, 100]] }] };
    const cv = runSkill(generateSkillCode(config('R0')), { 'lib/sensor': master });
    const expected = transformBox(leafBox, transform);
    const bounds = cv.shapes[0].bBox;
    expect(bounds[1][0] - bounds[0][0]).toBe(12 + expected[1][0] - expected[0][0]);
    expect(bounds[1][1] - bounds[0][1]).toBe(12 + expected[1][1] - expected[0][1]);
    checkCentered(bounds);
  });

  it('escapes quoted names and prints user names as data, including percent characters', () => {
    const c = config('R0');
    c.rows[0].name = 'Sensor "A" 100%';
    c.cell_map.sensor.cell = 'sensor"quoted';
    const code = generateSkillCode(c);
    const cv = runSkill(code, { 'lib/sensor"quoted': { bBox: [[0, 0], [2, 3]] } });
    expect(cv.mosaics).toHaveLength(1);
    expect(code).toContain('printf("Creating %s (purpose: %s) rows=%L y=%L');
    checkCentered(cv.shapes[0].bBox);
  });

  it.each(['BDTID', 'DBDTI', 'custom_center'])('draws M1 pin markers when measuring %s', layer => {
    const c = { ...config('R180'), center_layer: layer, center_purpose: 'drawing' };
    const code = generateSkillCode(c);
    expect(code).toContain(`paLayerBBox(master list("${layer}" "drawing"))`);
    const cv = runSkill(code, { 'lib/sensor': { bBox: [[10, -20], [11.25, -17.5]] } });
    expect(cv.shapes).toHaveLength(1);
    expect(cv.shapes[0].lpp).toEqual(['M1', 'pin']);
    checkCentered(cv.shapes[0].bBox);
  });

  it('uses the same geometry helper source in the standalone Python script', () => {
    const python = readFileSync('src/generators/templates/pixel_array.py', 'utf8');
    const runtime = readFileSync('src/generators/skill/runtime.il', 'utf8');
    expect(python).toContain(runtime);
  });
});
