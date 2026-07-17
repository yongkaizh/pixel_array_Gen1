import { LayoutConfig } from '../types';

export function getDefaultLayoutConfig(): LayoutConfig {
  return {
    top_lib: 'NEW_PIX_LIB_v2',
    top_cell: 'new_array_pixel_001',
    x_pitch: 2.5,
    y_pitch: 2.5,
    total_cols: 2048,
    rov_purpose: 'core',
    rows: [
      { purpose: 'bottom', rows: 2, name: 'Bottom_Region' },
      { purpose: 'dummy', rows: 2, name: 'Dummy_Buffer_1' },
      { purpose: 'type_a', rows: 40, name: 'Config_Region_A' },
      { purpose: 'type_b', rows: 20, name: 'Config_Region_B' },
      { purpose: 'dummy', rows: 2, name: 'Dummy_Buffer_2' },
      { purpose: 'type_c', rows: 2, name: 'Test_Region_1' },
      { purpose: 'type_c', rows: 2, name: 'Test_Region_2' },
      { purpose: 'idle', rows: 4, name: 'Idle_Region_1' },
      { purpose: 'type_d', rows: 4, name: 'Signal_Region_A' },
      { purpose: 'type_e', rows: 4, name: 'Signal_Region_B' },
      { purpose: 'dummy', rows: 2, name: 'Dummy_Buffer_3' },
      { purpose: 'core', rows: 1300, name: 'Main_Core_Array', address: '(Core Array Start)' },
      { purpose: 'dummy', rows: 2, name: 'Dummy_Buffer_4' },
      { purpose: 'top', rows: 2, name: 'Top_Region' }
    ],
    cell_map: {
      bottom: { name: 'bottom_cell', lib: 'generic_lib', cell: 'cell_bottom', rot: 'R0' },
      type_c: { name: 'type_c_cell', lib: 'generic_lib', cell: 'cell_type_c', rot: 'R0' },
      idle: { name: 'idle_cell', lib: 'generic_lib', cell: 'cell_idle', rot: 'R0' },
      type_e: { name: 'type_e_cell', lib: 'generic_lib', cell: 'cell_type_e', rot: 'R0' },
      type_d: { name: 'type_d_cell', lib: 'generic_lib', cell: 'cell_type_d', rot: 'R0' },
      core: { name: 'core_cell', lib: 'generic_lib', cell: 'cell_core', rot: 'R0' },
      top: { name: 'top_cell', lib: 'generic_lib', cell: 'cell_top', rot: 'R0' },
      type_b: { name: 'type_b_cell', lib: 'generic_lib', cell: 'cell_type_b', rot: 'R0' },
      type_a: { name: 'type_a_cell', lib: 'generic_lib', cell: 'cell_type_a', rot: 'R0' },
      dummy: { name: 'dummy_cell', lib: 'generic_lib', cell: 'cell_dummy', rot: 'R0' }
    }
  };
}

// Generate Cadence SKILL script