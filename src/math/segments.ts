import { RowSegment } from '../types';
import { positiveNumber } from './numbers';

export function parseSegmentsString(txt: string | number, defaultPurpose: string = 'dummy'): RowSegment[] {
  if (typeof txt === 'number') txt = String(txt);
  if (!txt || txt.trim() === '') return [];
  // Supports formats like:
  // "20" (defaults to "dummy:20")
  // "dummy:20"
  // "dummy:20, c2:10"
  const parts = txt.split(',');
  const segments: RowSegment[] = [];
  parts.forEach(part => {
    const clean = part.trim();
    const match = clean.match(/^(?:([a-zA-Z0-9_]+)\s*:\s*)?(\d+)$/);
    if (!match) throw new Error(`Invalid padding segment: "${clean}". Use purpose:count or count.`);
    segments.push({ purpose: (match[1] || defaultPurpose).toLowerCase(), cols: positiveNumber(match[2], 'Padding columns', true) });
  });
  return segments;
}
