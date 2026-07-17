import { LayoutConfig, RowConfig, CellInfo, RowSegment } from '../types';

export function getRowCategory(purpose: string, name: string, rov_purpose: string): 'active' | 'rov' | 'blc' | 'clamp' | 'cbar' | 'dummy' | 'top' | 'bottom' {
  const p = purpose.toLowerCase();
  const n = name.toLowerCase();
  const rovLower = rov_purpose.toLowerCase();

  if (p === 'top') return 'top';
  if (p === 'bottom') return 'bottom';

  // 1. Black Level Correction / BLC:
  if (n.includes('blc') || p.includes('blc')) return 'blc';

  // 2. Row Optical Black / ROV:
  if (n.includes('rov') || p.includes('rov')) return 'rov';

  // 3. Active Pixel Array:
  if (n === 'c1' || n.includes('active') || p.includes('active') || p === 'act' || n === 'act' || (p === 'c1' && !n.includes('blc'))) return 'active';

  // 4. ROV / Optical Black (Fallback)
  if (p === rovLower || p.includes('ob') || p.includes('black')) return 'rov';

  // 5. Color Bar:
  if (p.includes('cbar') || p.includes('color') || n.includes('color') || n.includes('cbar')) return 'cbar';

  // 6. Clamp / Peripheral:
  if (p.includes('clamp') || p.includes('idle') || p.includes('bsun') || p.includes('ecl') ||
      n.includes('clamp') || n.includes('idle') || n.includes('bsun') || n.includes('ecl')) return 'clamp';

  return 'dummy';
}

// Default configuration out of the box

export function getLeftRightStringsFromSegments(segments: RowSegment[] | undefined, mainPurpose: string, row?: RowConfig): { leftStr: string, rightStr: string } {
  if (row && typeof row.leftStr === 'string' && typeof row.rightStr === 'string') {
    return { leftStr: row.leftStr, rightStr: row.rightStr };
  }
  if (!segments || segments.length === 0) {
    return { leftStr: '', rightStr: '' };
  }
  const mainIdx = segments.findIndex(s => s.purpose.toLowerCase() === mainPurpose.toLowerCase());
  if (mainIdx !== -1) {
    const leftParts = segments.slice(0, mainIdx);
    const rightParts = segments.slice(mainIdx + 1);
    return {
      leftStr: leftParts.map(s => `${s.purpose}:${s.cols}`).join(', '),
      rightStr: rightParts.map(s => `${s.purpose}:${s.cols}`).join(', ')
    };
  } else {
    return {
      leftStr: segments.map(s => `${s.purpose}:${s.cols}`).join(', '),
      rightStr: ''
    };
  }
}


// Parse uploaded Excel file to layout config