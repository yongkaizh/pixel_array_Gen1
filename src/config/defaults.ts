import { LayoutConfig } from '../types';

export function getDefaultLayoutConfig(): LayoutConfig {
  return {
    top_lib: 'NEW_PIX_LIB_v2',
    top_cell: 'new_array_pixel_001',
    x_pitch: 2.5,
    y_pitch: 2.5,
    total_cols: 2048,
    rov_purpose: 'core',
    center_layer: 'BDTID',
    center_purpose: 'drawing',
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

export const PRESET_CONFIGS: { id: string; name: string; description: string; config: () => LayoutConfig }[] = [
  {
    id: 'sensor_1936',
    name: 'Sensor Array Model 1936 (1936 Cols, 2.2μm Pitch)',
    description: 'Target sensor model with 1936 columns, 2.2μm pitch, BLC blocks, clamps, and BDTID centering.',
    config: () => ({
      top_lib: 'SENSOR_1936_LIB',
      top_cell: 'array_pixel',
      x_pitch: 2.2,
      y_pitch: 2.2,
      total_cols: 1936,
      rov_purpose: 'c1',
      center_layer: 'BDTID',
      center_purpose: 'drawing',
      rows: [
        { purpose: 'bottom', rows: 1, name: 'bottom' },
        { purpose: 'dummy', rows: 1, name: 'dummy', leftStr: 'idle:100' },
        { purpose: 'c1', rows: 35, name: 'BLC', leftStr: 'dummy:20, idle:10', rightStr: 'dummy:20, idle:10' },
        { purpose: 'c2', rows: 16, name: 'BLC zero', leftStr: 'dummy:20, idle:10' },
        { purpose: 'dummy', rows: 1, name: 'Dummy pixel row', leftStr: 'idle:100' },
        { purpose: 'cbar', rows: 1, name: 'Color bar B row', leftStr: 'idle:100' },
        { purpose: 'cbar', rows: 1, name: 'Color bar R row', leftStr: 'idle:100' },
        { purpose: 'idle', rows: 2, name: 'Idle clamps', leftStr: 'idle:100' },
        { purpose: 'bsun', rows: 2, name: 'ECL Bsun clamps', leftStr: 'idle:100' },
        { purpose: 'ecl', rows: 2, name: 'ECL Sig clamps', leftStr: 'idle:100' },
        { purpose: 'dummy', rows: 1, name: 'dummy', leftStr: 'idle:100' },
        { purpose: 'dummy', rows: 1, name: 'dummy', leftStr: 'idle:100' },
        { purpose: 'c1', rows: 1294, name: 'c1', leftStr: 'idle:100', rightStr: 'dummy:200' },
        { purpose: 'dummy', rows: 1, name: 'dummy', leftStr: 'idle:100' },
        { purpose: 'top', rows: 1, name: 'top' }
      ],
      cell_map: {
        bottom: { name: 'bottom', lib: 'pixel_lib', cell: 'cell_bottom', rot: 'R0' },
        dummy: { name: 'dummy', lib: 'pixel_lib', cell: 'cell_dummy', rot: 'R0' },
        c1: { name: 'c1', lib: 'pixel_lib', cell: 'cell_c1', rot: 'R0' },
        c2: { name: 'c2', lib: 'pixel_lib', cell: 'cell_c2', rot: 'R0' },
        cbar: { name: 'cbar', lib: 'pixel_lib', cell: 'cell_cbar', rot: 'R0' },
        idle: { name: 'idle', lib: 'pixel_lib', cell: 'cell_idle', rot: 'R0' },
        bsun: { name: 'bsun', lib: 'pixel_lib', cell: 'cell_bsun', rot: 'R0' },
        ecl: { name: 'ecl', lib: 'pixel_lib', cell: 'cell_ecl', rot: 'R0' },
        top: { name: 'top', lib: 'pixel_lib', cell: 'cell_top', rot: 'R0' }
      }
    })
  },
  {
    id: 'default_2048',
    name: 'Generic 2048 Array (2.5μm Pitch)',
    description: 'Standard 2048-column sensor array with 2.5μm pitch and multi-region buffers.',
    config: () => getDefaultLayoutConfig()
  },
  {
    id: 'compact_256',
    name: 'Compact Test Chip (256 Cols, 1.8μm Pitch)',
    description: 'Lightweight test chip array with 256 columns, 1.8μm pitch for fast SKILL verification.',
    config: () => ({
      top_lib: 'TEST_CHIP_LIB',
      top_cell: 'pixel_array_test',
      x_pitch: 1.8,
      y_pitch: 1.8,
      total_cols: 256,
      rov_purpose: 'core',
      center_layer: 'BDTID',
      center_purpose: 'drawing',
      rows: [
        { purpose: 'bottom', rows: 2, name: 'Bottom_Guard' },
        { purpose: 'dummy', rows: 4, name: 'Dummy_Pad', leftStr: 'dummy:16', rightStr: 'dummy:16' },
        { purpose: 'core', rows: 128, name: 'Active_Pixel_Core', leftStr: 'dummy:16', rightStr: 'dummy:16' },
        { purpose: 'dummy', rows: 4, name: 'Dummy_Pad_Top', leftStr: 'dummy:16', rightStr: 'dummy:16' },
        { purpose: 'top', rows: 2, name: 'Top_Guard' }
      ],
      cell_map: {
        bottom: { name: 'bottom', lib: 'test_lib', cell: 'cell_bot', rot: 'R0' },
        dummy: { name: 'dummy', lib: 'test_lib', cell: 'cell_dum', rot: 'R0' },
        core: { name: 'core', lib: 'test_lib', cell: 'cell_core', rot: 'R0' },
        top: { name: 'top', lib: 'test_lib', cell: 'cell_top', rot: 'R0' }
      }
    })
  }
];