import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/components/CadViewer.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add state variables
content = content.replace(
  'const [hoveredSegIdx, setHoveredSegIdx] = useState<number | null>(null);',
  'const [hoveredSegIdx, setHoveredSegIdx] = useState<number | null>(null);\n  const [lockedRowIdx, setLockedRowIdx] = useState<number | null>(null);\n  const [lockedSegIdx, setLockedSegIdx] = useState<number | null>(null);'
);

// 2. Unsegmented rect onClick
content = content.replace(
  'onMouseEnter={() => { setHoveredRowIdx(bIdx); setHoveredSegIdx(null); }}',
  'onClick={(e) => {\n                      e.stopPropagation();\n                      if (lockedRowIdx === bIdx && lockedSegIdx === null) {\n                        setLockedRowIdx(null);\n                      } else {\n                        setLockedRowIdx(bIdx);\n                        setLockedSegIdx(null);\n                      }\n                    }}\n                    onMouseEnter={() => { setHoveredRowIdx(bIdx); setHoveredSegIdx(null); }}'
);

// 3. Segmented rect onClick
content = content.replace(
  'onMouseEnter={() => setHoveredSegIdx(sIdx)}',
  'onClick={(e) => {\n                                e.stopPropagation();\n                                if (lockedRowIdx === bIdx && lockedSegIdx === sIdx) {\n                                  setLockedRowIdx(null);\n                                  setLockedSegIdx(null);\n                                } else {\n                                  setLockedRowIdx(bIdx);\n                                  setLockedSegIdx(sIdx);\n                                }\n                              }}\n                              onMouseEnter={() => setHoveredSegIdx(sIdx)}'
);

// 4. Canvas onClick to clear
content = content.replace(
  'className={`cad-viewer-canvas',
  'onClick={() => {\n          setLockedRowIdx(null);\n          setLockedSegIdx(null);\n        }}\n        className={`cad-viewer-canvas'
);

// 5. Tooltip active logic
content = content.replace(
  '{hoveredRowIdx !== null && (',
  '{(lockedRowIdx !== null || hoveredRowIdx !== null) && ('
);

content = content.replace(
  'const b = layout.blocks[hoveredRowIdx];',
  'const activeBIdx = lockedRowIdx !== null ? lockedRowIdx : hoveredRowIdx;\n              const b = layout.blocks[activeBIdx!];'
);

content = content.replace(
  'if (b.segments && hoveredSegIdx !== null && b.segments[hoveredSegIdx]) {',
  'const activeSIdx = lockedRowIdx !== null ? lockedSegIdx : hoveredSegIdx;\n              if (b.segments && activeSIdx !== null && b.segments[activeSIdx]) {'
);

content = content.replace(
  'const seg = b.segments[hoveredSegIdx];',
  'const seg = b.segments[activeSIdx];'
);

// 6. Make tooltip selectable and pointer-events-auto if locked
content = content.replace(
  'className="absolute top-3 right-4 bg-glass-panel/95 backdrop-blur-xs border border-glass-border p-4 w-auto min-w-[300px] max-w-[420px] shadow-lg animate-fade-in pointer-events-none z-20 text-glass-text"',
  'className={`absolute top-3 right-4 bg-glass-panel/95 backdrop-blur-xs border border-glass-border p-4 w-auto min-w-[300px] max-w-[420px] shadow-lg animate-fade-in z-20 text-glass-text ${lockedRowIdx !== null ? \'pointer-events-auto select-text ring-1 ring-neon-cyan\' : \'pointer-events-none\'}`}'
);

content = content.replace(
  '{nameToShow.toUpperCase()} {isSegment ? \'\' : \'Block\'}',
  '{nameToShow.toUpperCase()} {isSegment ? \'\' : \'Block\'}\n                      {lockedRowIdx !== null && <span className="ml-2 text-[9px] bg-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 rounded-full normal-case">Locked (Click to copy)</span>}'
);

fs.writeFileSync(filePath, content);
console.log('Fixed CadViewer tooltip lock!');
