import { LayoutConfig, RowConfig, CellInfo, RowSegment } from '../types';

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
