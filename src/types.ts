export interface CellInfo {
  name: string;
  lib: string;
  cell: string;
  rot: string;
}

export interface RowSegment {
  purpose: string;
  cols: number;
}

export interface RowConfig {
  purpose: string;
  rows: number;
  name?: string;
  segments?: RowSegment[];
  leftStr?: string;
  rightStr?: string;
}

export interface LayoutConfig {
  top_lib: string;
  top_cell: string;
  x_pitch: number;
  y_pitch: number;
  total_cols: number;
  
  rov_purpose: string;
    rows: RowConfig[];
  cell_map: Record<string, CellInfo>;
}

export interface BugFixInfo {
  original: string;
  fixed: string;
  explanation: string;
}
