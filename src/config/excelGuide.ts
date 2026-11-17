import { LayoutConfig } from '../types';

/** One small, complete workbook shared by the illustration and its download. */
export const EXCEL_GUIDE_CONFIG: LayoutConfig = {
  top_lib: 'pixel_lib', top_cell: 'example_array',
  x_pitch: 2.5, y_pitch: 2.5, total_cols: 12,
  rov_purpose: 'active', center_layer: 'BDTID', center_purpose: 'drawing',
  rows: [
    { purpose: 'dummy', name: 'Top', rows: 2 },
    { purpose: 'active', name: 'Pixels', rows: 4, segments: [
      { purpose: 'dummy', cols: 2 }, { purpose: 'idle', cols: 1 },
      { purpose: 'active', cols: 8 }, { purpose: 'dummy', cols: 1 },
    ] },
    { purpose: 'dummy', name: 'Bottom', rows: 2 },
  ],
  cell_map: {
    active: { name: 'active', lib: 'pixel_lib', cell: 'pixel_active', rot: 'R180' },
    idle: { name: 'idle', lib: 'pixel_lib', cell: 'pixel_idle', rot: 'MY' },
    dummy: { name: 'dummy', lib: 'pixel_lib', cell: 'pixel_dummy', rot: 'R0' },
  },
};
