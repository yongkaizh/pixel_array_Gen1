import { describe, it, expect } from 'vitest';
import { 
  getRowCategory, 
  parseSegmentsString, 
  getLeftRightStringsFromSegments,
  getDefaultLayoutConfig,
  generateSkillCode,
  generatePythonCode,
  parseExcelFile,
  getExcelImportErrorDetails
} from './utils';

describe('utils.ts', () => {
  describe('getRowCategory', () => {
    it('should classify "top" correctly', () => {
      expect(getRowCategory('top', 'anything', 'c1')).toBe('top');
    });

    it('should classify "bottom" correctly', () => {
      expect(getRowCategory('bottom', 'anything', 'c1')).toBe('bottom');
    });

    it('should classify "blc" correctly', () => {
      expect(getRowCategory('some blc', 'name', 'c1')).toBe('blc');
      expect(getRowCategory('purpose', 'name with BLC inside', 'c1')).toBe('blc');
    });

    it('should classify "rov" correctly', () => {
      expect(getRowCategory('rov_purpose', 'name', 'c1')).toBe('rov');
      expect(getRowCategory('some_ob_purpose', 'name', 'c1')).toBe('rov');
    });

    it('should classify "active" correctly', () => {
      expect(getRowCategory('active', 'name', 'c1')).toBe('active');
      expect(getRowCategory('act', 'name', 'c1')).toBe('active');
      expect(getRowCategory('purpose', 'active_name', 'c1')).toBe('active');
    });

    it('should classify "cbar" correctly', () => {
      expect(getRowCategory('cbar', 'name', 'c1')).toBe('cbar');
      expect(getRowCategory('color_bar', 'name', 'c1')).toBe('cbar');
    });

    it('should classify "clamp" correctly', () => {
      expect(getRowCategory('clamp', 'name', 'c1')).toBe('clamp');
      expect(getRowCategory('idle', 'name', 'c1')).toBe('clamp');
      expect(getRowCategory('bsun', 'name', 'c1')).toBe('clamp');
      expect(getRowCategory('ecl', 'name', 'c1')).toBe('clamp');
    });

    it('should default to "dummy"', () => {
      expect(getRowCategory('unknown', 'unknown', 'c1')).toBe('dummy');
    });
  });

  describe('parseSegmentsString', () => {
    it('should parse valid segment strings', () => {
      const segments = parseSegmentsString('c1:100,dummy:50', 'default');
      expect(segments).toEqual([
        { purpose: 'c1', cols: 100 },
        { purpose: 'dummy', cols: 50 }
      ]);
    });

    it('should return empty array for empty string', () => {
      const segments = parseSegmentsString('', 'default');
      expect(segments).toEqual([]);
    });

    it('should ignore invalid segments', () => {
      const segments = parseSegmentsString('c1:100,invalid_segment,dummy:50', 'default');
      expect(segments).toEqual([
        { purpose: 'c1', cols: 100 },
        { purpose: 'dummy', cols: 50 }
      ]);
    });
  });

  describe('getLeftRightStringsFromSegments', () => {
    it('should return left and right strings correctly', () => {
      const segments = [
        { purpose: 'dummy', cols: 10 },
        { purpose: 'c1', cols: 100 },
        { purpose: 'dummy', cols: 20 }
      ];
      const result = getLeftRightStringsFromSegments(segments, 'c1');
      expect(result.leftStr).toBe('dummy:10');
      expect(result.rightStr).toBe('dummy:20');
    });

    it('should handle missing left or right parts', () => {
      const segments1 = [
        { purpose: 'c1', cols: 100 },
        { purpose: 'dummy', cols: 20 }
      ];
      const result1 = getLeftRightStringsFromSegments(segments1, 'c1');
      expect(result1.leftStr).toBe('');
      expect(result1.rightStr).toBe('dummy:20');

      const segments2 = [
        { purpose: 'dummy', cols: 10 },
        { purpose: 'c1', cols: 100 }
      ];
      const result2 = getLeftRightStringsFromSegments(segments2, 'c1');
      expect(result2.leftStr).toBe('dummy:10');
      expect(result2.rightStr).toBe('');
    });
    
    it('should return empty strings if no segments', () => {
      const result = getLeftRightStringsFromSegments(undefined, 'c1');
      expect(result.leftStr).toBe('');
      expect(result.rightStr).toBe('');
    });
  });

  describe('getExcelImportErrorDetails', () => {
    it('should identify missing sheet errors clearly', () => {
      const details = getExcelImportErrorDetails(new Error("MISSING SHEET 'pix_tbl': We found 'format_template' but 'pix_tbl' is missing in this file."));
      expect(details.title).toContain('pix_tbl');
      expect(details.summary).toContain('missing');
      expect(details.fixSuggestion).toContain('pix_tbl');
    });

    it('should identify missing column headers for pix_tbl', () => {
      const details = getExcelImportErrorDetails(new Error("EMPTY CELL MAPPING: The 'pix_tbl' sheet is empty or does not contain any valid records. Please make sure the 'pix_tbl' sheet has a header row with at least these column headers in row 1: ➔ 'Name' | 'library' | 'Cell' | 'rotation'"));
      expect(details.title).toContain('pix_tbl');
      expect(details.missingItem).toContain('Name');
      expect(details.fixSuggestion).toContain('Name');
    });
  });

  describe('generateSkillCode', () => {
    it('should generate Cadence SKILL code containing specific key instructions', () => {
      const config = getDefaultLayoutConfig();
      const code = generateSkillCode(config);
      
      expect(code).toContain('dbCreateMosaic(');
      expect(code).toContain(config.top_lib);
      expect(code).toContain(config.top_cell);
      expect(code).toContain('Pixel Array Generation Start');
      expect(code).toContain('dbSave(cv)');
      expect(code).toContain('dbClose(cv)');
    });
  });

  describe('generatePythonCode', () => {
    it('should generate corrected Python code', () => {
      const pyCode = generatePythonCode(true);
      expect(pyCode).toContain('import pandas as pd');
      expect(pyCode).toContain('tmpl.shape[1]');
    });

    it('should generate original uncorrected Python code', () => {
      const pyCode = generatePythonCode(false);
      expect(pyCode).toContain('import pandas as pd');
      // Just check it exists and has some common Python syntax
      expect(pyCode).toContain('def get_row_category');
    });
  });
});
