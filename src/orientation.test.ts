import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { generateSkillCode } from './generators/skill';
import { generatePythonCode } from './generators/python';
import { mosaicGeometry, normalizeRotation } from './math/orientation';
import { findMaxActiveRow } from './generators/skill/mosaics';
import { getDefaultLayoutConfig } from './config/defaults';
import { exportToExcel, parseExcelFile } from './utils';

const rotations = ['R0', 'R90', 'R180', 'R270', 'MX', 'MY', 'MXR90', 'MYR90'];

function configFor(rotation: string) {
  return {
    ...getDefaultLayoutConfig(), total_cols: 7, x_pitch: 2, y_pitch: 3,
    rov_purpose: 'sensor',
    rows: [{ purpose: 'sensor', rows: 5, name: 'Sensor' }],
    cell_map: { sensor: { name: 'sensor', lib: 'lib', cell: 'sensor', rot: rotation } },
  };
}

// Read actual emitted arguments, rather than simulating the generator's intended behavior.
function mosaicCalls(code: string) {
  return [...code.matchAll(/dbCreate(?:Simple)?Mosaic\(\s*cv\s*master\s*"([^"]+)"\s*list\(0\.0 0\.0\)\s*"([^"]+)"\s*([\d.e+-]+)\s*([\d.e+-]+)\s*([\d.e+-]+)\s*([\d.e+-]+)/g)]
    .map(m => ({ name: m[1], rotation: m[2], rows: +m[3], cols: +m[4], yStep: +m[5], xStep: +m[6] }));
}

describe('orientation geometry in emitted mosaics', () => {
  it.each(rotations)('%s preserves logical dimensions for unequal pitches and counts', rotation => {
    const code = generateSkillCode(configFor(rotation));
    const calls = mosaicCalls(code);
    expect(calls).toHaveLength(2); // primary and fallback use identical geometry
    expect(calls[0]).toEqual(calls[1]);
    const m = calls[0];
    expect(m.rotation).toBe(rotation);
    const quarterTurn = ['R90', 'R270', 'MXR90', 'MYR90'].includes(rotation);
    expect(m.cols).toBe(quarterTurn ? 5 : 7);
    expect(m.rows).toBe(quarterTurn ? 7 : 5);
    expect(m.xStep).toBe(quarterTurn ? 3 : 2);
    expect(m.yStep).toBe(quarterTurn ? 2 : 3);
    const origin = code.match(/when\(inst\s*dx = ([\d.e+-]+)\s*dy = currentY \+ ([\d.e+-]+)/)!;
    const expectedX = ['R180', 'R90', 'MY', 'MYR90'].includes(rotation) ? 14 : 0;
    const expectedY = ['R180', 'R270', 'MX', 'MYR90'].includes(rotation) ? 15 : 0;
    expect([+origin[1], +origin[2]]).toEqual([expectedX, expectedY]);
  });

  it.each(['R0', 'R180'])('%s places asymmetric segments at the requested grid edges', rotation => {
    const config = configFor(rotation);
    const code = generateSkillCode({ ...config, total_cols: 10, rows: [{
      purpose: 'sensor', rows: 5, segments: [
        { purpose: 'sensor', cols: 2 }, { purpose: 'sensor', cols: 5 }, { purpose: 'sensor', cols: 3 },
      ],
    }] });
    const origins = [...code.matchAll(/dx = ([\d.e+-]+) \+ ([\d.e+-]+)\s*dy = currentY \+ ([\d.e+-]+)/g)];
    expect(origins).toHaveLength(3);
    expect(origins.map(m => +m[1] + +m[2])).toEqual(rotation === 'R0' ? [0, 4, 14] : [4, 14, 20]);
    expect(origins.map(m => +m[3])).toEqual(rotation === 'R0' ? [0, 0, 0] : [15, 15, 15]);
  });

  it('normalizes rotation text and rejects unsupported rotations', () => {
    expect(normalizeRotation(' r180 ')).toBe('R180');
    expect(normalizeRotation(' ')).toBe('R0');
    expect(() => normalizeRotation('R45')).toThrow('Unsupported cell rotation');
  });

  it('preserves mixed R0/R180 mappings across Excel export and import', () => {
    const config = configFor('R180');
    config.cell_map['dummy'] = { name: 'dummy', lib: 'lib', cell: 'dummy', rot: 'R0' };
    const parsed = parseExcelFile(exportToExcel(config));
    expect(parsed.cell_map.sensor.rot).toBe('R180');
    expect(parsed.cell_map.dummy.rot).toBe('R0');
  });

  it('retains very small segment offsets without rounding to four decimals', () => {
    const config = configFor('R0');
    const code = generateSkillCode({ ...config, x_pitch: 0.00001, rows: [{ purpose: 'sensor', rows: 1,
      segments: [{ purpose: 'sensor', cols: 1 }, { purpose: 'sensor', cols: 6 }] }] });
    expect(code).toContain('dx = 0.00001 + 0');
  });
});

describe('centering target consistency', () => {
  it('selects a custom target instead of a larger active block', () => {
    const config = { ...configFor('R0'), rows: [
      { purpose: 'active', rows: 100 }, { purpose: 'sensor', rows: 5 },
    ] };
    expect(findMaxActiveRow(config)).toBe(config.rows[1]);
    config.cell_map['active'] = { name: 'active', lib: 'lib', cell: 'active', rot: 'R0' };
    const code = generateSkillCode(config);
    expect(code).toContain('ACTIVE MOSAIC FOUND');
    expect(code).toContain('dy = -7.5');
  });

  it('uses the same asymmetric target segment for fallback centering', () => {
    const config = { ...configFor('R180'), total_cols: 10, rows: [{ purpose: 'edge', rows: 5, segments: [
      { purpose: 'dummy', cols: 1 }, { purpose: 'sensor', cols: 6 }, { purpose: 'dummy', cols: 3 },
    ] }] };
    config.cell_map['dummy'] = { name: 'dummy', lib: 'lib', cell: 'dummy', rot: 'R0' };
    expect(findMaxActiveRow(config)).toBe(config.rows[0]);
    const code = generateSkillCode(config);
    expect(code).toContain('ACTIVE SEGMENT MOSAIC FOUND');
    expect(code).toContain('dx = -8');
    expect(code).toContain('dy = -7.5');
  });

  it('initializes all centering state and removes only tagged verification shapes', () => {
    const code = generateSkillCode(configFor('R0'));
    expect(code).toContain('maxActiveInst = nil');
    expect(code).toContain('local_bBox = nil');
    expect(code).toContain('when(sh~>pixelArrayVerification');
    expect(code).not.toContain('if(llx < 1e5');
    expect(code).toContain('dbReplaceProp(verificationRect "pixelArrayVerification" "boolean" t)');
  });
});

describe('standalone Python geometry', () => {
  it('compiles and matches TypeScript for every orientation without requiring pandas', () => {
    const source = generatePythonCode(true);
    const cases = [...rotations, ' r180 ', ''].map(rotation => [rotation, 7, 5, 2, 3]);
    const script = `import ast, json, sys\nsource = sys.stdin.read()\ncompile(source, 'pixel_array.py', 'exec')\nmodule = ast.parse(source)\nnodes = [n for n in module.body if (isinstance(n, ast.FunctionDef) and n.name == 'mosaic_geometry') or (isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'ORIENTATION_MATRICES' for t in n.targets))]\nscope = {}\nexec(compile(ast.Module(body=nodes, type_ignores=[]), '<geometry>', 'exec'), scope)\nprint(json.dumps([scope['mosaic_geometry'](*case) for case in json.loads(sys.argv[1])]))`;
    const result = JSON.parse(execFileSync('python3', ['-c', script, JSON.stringify(cases)], { input: source, encoding: 'utf8' }));
    expect(result).toEqual(cases.map(([rot, cols, rows, xp, yp]) => mosaicGeometry(String(rot), +cols, +rows, +xp, +yp)));
  });
});
