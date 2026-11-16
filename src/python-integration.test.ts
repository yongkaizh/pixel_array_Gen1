import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportToExcel } from './exporters/excel';
import { generateSkillCode } from './generators/skill';
import { generatePythonCode } from './generators/python';
import { getDefaultLayoutConfig } from './config/defaults';
import { runSkill, Box } from './test/skillHarness';

const python = process.env.PIXEL_TEST_PYTHON;
const rotations = ['R0', 'R90', 'R180', 'R270', 'MX', 'MY', 'MXR90', 'MYR90'];

describe.skipIf(!python)('Excel → standalone Python → executed SKILL', () => {
  it.each(rotations.flatMap(rot => [[rot, 'main'], [rot, 'padding']]))('%s target in %s matches the browser for mixed rotations, asymmetric margins and sizes', (rotation, location) => {
    const config = { ...getDefaultLayoutConfig(), total_cols: 10, x_pitch: 2.5, y_pitch: 3.25, rov_purpose: 'sensor',
      rows: [{ purpose: 'pad', rows: 2 }, { purpose: 'sensor', rows: 5, segments: [
        { purpose: 'pad', cols: 1 }, { purpose: 'sensor', cols: 6 }, { purpose: 'pad', cols: 3 },
      ] }, { purpose: 'pad', rows: 1 }],
      cell_map: { sensor: { name: 'Sensor display name', lib: 'lib', cell: 'sensor', rot: rotation }, pad: { name: 'Padding', lib: 'lib', cell: 'pad', rot: 'R180' } } };
    if (location === 'padding') config.rov_purpose = 'pad';
    const folder = mkdtempSync(join(tmpdir(), 'pixel-array-test-'));
    try {
      writeFileSync(join(folder, 'array_pixel.xlsx'), Buffer.from(exportToExcel(config)));
      writeFileSync(join(folder, 'pixel_array.py'), generatePythonCode(true));
      execFileSync(python!, ['pixel_array.py'], { cwd: folder });
      const masters = { 'lib/sensor': { bBox: [[10, -20], [11.25, -17.5]] as Box }, 'lib/pad': { bBox: [[-3, 2], [-1, 5]] as Box } };
      const browser = runSkill(generateSkillCode(config), masters);
      const standalone = runSkill(readFileSync(join(folder, 'pixel_array.il'), 'utf8'), masters);
      expect(standalone).toEqual(browser);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
