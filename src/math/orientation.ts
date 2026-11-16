/** Cadence orthogonal transforms, applied to both cells and the mosaic grid. */
export const ORIENTATION_MATRICES: Record<string, readonly [number, number, number, number]> = {
  R0: [1, 0, 0, 1], R90: [0, -1, 1, 0], R180: [-1, 0, 0, -1], R270: [0, 1, -1, 0],
  MX: [1, 0, 0, -1], MY: [-1, 0, 0, 1], MXR90: [0, 1, 1, 0], MYR90: [0, -1, -1, 0],
};

export function normalizeRotation(rotation: string): string {
  const orient = (rotation || 'R0').trim().toUpperCase() || 'R0';
  if (!Object.hasOwn(ORIENTATION_MATRICES, orient)) {
    throw new Error(`Unsupported cell rotation: ${rotation}`);
  }
  return orient;
}

export function mosaicGeometry(rotation: string, cols: number, rows: number, xPitch: number, yPitch: number) {
  const orient = normalizeRotation(rotation);
  const [a, b, c, d] = ORIENTATION_MATRICES[orient];
  // Quarter turns exchange local rows/columns so logical X/Y dimensions stay fixed.
  const swapped = a === 0;
  const localCols = swapped ? rows : cols;
  const localRows = swapped ? cols : rows;
  const xStep = swapped ? yPitch : xPitch;
  const yStep = swapped ? xPitch : yPitch;
  const width = localCols * xStep;
  const height = localRows * yStep;
  return {
    orient,
    cols: localCols, rows: localRows, xStep, yStep,
    offsetX: -(Math.min(0, a * width) + Math.min(0, b * height)) || 0,
    offsetY: -(Math.min(0, c * width) + Math.min(0, d * height)) || 0,
  };
}
