import { LayoutConfig } from '../types';

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