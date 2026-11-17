import React, { useId, useState } from 'react';
import { ArrowRight, FileDown, Grid2X2, Layers } from 'lucide-react';
import { EXCEL_GUIDE_CONFIG as example } from '../config/excelGuide';
import { getLeftRightStringsFromSegments } from '../math/grid';
import { exportToExcel } from '../exporters/excel';

export function ExcelGuide() {
  const [sheet, setSheet] = useState<'cells' | 'rows'>('cells');
  const arrowId = useId();
  const rowCount = example.rows.reduce((sum, row) => sum + row.rows, 0);
  const activeRow = example.rows[1];
  const segments = activeRow.segments!;
  const mainIdx = segments.findIndex(seg => seg.purpose === activeRow.purpose);
  const active = segments[mainIdx];
  const leftCols = segments.slice(0, mainIdx).reduce((sum, seg) => sum + seg.cols, 0);
  const rightCols = segments.slice(mainIdx + 1).reduce((sum, seg) => sum + seg.cols, 0);
  const { leftStr, rightStr } = getLeftRightStringsFromSegments(segments, activeRow.purpose);
  const centerX = 60 + (leftCols + active.cols / 2) * 32;
  const fillFor = (purpose: string) => purpose === 'active' ? '#bae6fd' : purpose === 'idle' ? '#ddd6fe' : '#e2e8f0';
  const purposeAt = (row: number, col: number) => {
    let rowEnd = 0;
    const block = example.rows.find(item => { rowEnd += item.rows; return row < rowEnd; })!;
    let colEnd = 0;
    return (block.segments || [{ purpose: block.purpose, cols: example.total_cols }])
      .find(seg => { colEnd += seg.cols; return col < colEnd; })!.purpose;
  };

  const downloadExample = () => {
    const blob = new Blob([exportToExcel(example)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pixel_array_visual_example.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="min-w-0 rounded-lg border border-glass-border bg-glass-bg/30 overflow-hidden" aria-label="Visual Excel guide">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-glass-border">
        <div>
          <h4 className="flex items-center gap-2 font-sans font-black uppercase italic tracking-tight text-sm text-glass-text"><Layers size={17} className="text-neon-cyan" />How mixed-cell rows work</h4>
          <p className="mt-1 text-sm text-glass-muted">Map the cells. Set the sides. The main region fills the remaining columns.</p>
        </div>
        <button type="button" onClick={downloadExample} className="glass-button inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide text-glass-text cursor-pointer focus-visible:outline-sky-500">
          <FileDown size={15} /> Download this example
        </button>
      </div>

      <div className="grid lg:grid-cols-2">
        <div className="min-w-0 p-4 sm:p-5 space-y-4">
          <div className="flex gap-1 rounded-lg border border-glass-border bg-glass-bg p-1" role="group" aria-label="Workbook sheet example">
            {(['cells', 'rows'] as const).map((value, idx) => (
              <button key={value} type="button" aria-pressed={sheet === value} onClick={() => setSheet(value)} className={`flex-1 rounded-md px-3 py-2 text-xs font-mono font-bold uppercase tracking-wide cursor-pointer focus-visible:outline-sky-500 ${sheet === value ? 'glass-button bg-white text-neon-cyan shadow-sm' : 'text-glass-muted hover:text-glass-text'}`}>
                <span className="mr-2 text-slate-400">{idx + 1}</span>{value === 'cells' ? 'Map cells' : 'Set rows'}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-glass-border overflow-hidden">
            <div className="flex items-center gap-2 bg-glass-bg px-3 py-2 text-glass-text border-b border-glass-border text-sm font-mono font-semibold">
              <Grid2X2 size={15} /> {sheet === 'cells' ? 'pix_tbl' : 'format_template'}
            </div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${sheet === 'cells' ? 'Cell mapping' : 'Row layout'} example table`}>
              {sheet === 'cells' ? (
                <table className="excel-guide-table">
                  <caption className="sr-only">Map logical names to physical cells and rotations.</caption>
                  <thead><tr>{['Name', 'library', 'Cell', 'rotation'].map(label => <th key={label}>{label}</th>)}</tr></thead>
                  <tbody>
                    {Object.values(example.cell_map).map(cell => <tr key={cell.name}>
                      <td><span className={`rounded px-1.5 py-1 font-semibold ${cell.name === 'active' ? 'bg-sky-100 text-sky-800' : cell.name === 'idle' ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-700'}`}>{cell.name}</span></td>
                      <td>{cell.lib}</td><td>{cell.cell}</td><td>{cell.rot}</td>
                    </tr>)}
                  </tbody>
                </table>
              ) : (
                <table className="excel-guide-table excel-guide-rows">
                  <caption className="sr-only">Twelve columns: two dummy and one idle on the left, eight active in the middle, and one dummy on the right.</caption>
                  <thead><tr>{['A · row_num', 'B · Purpose', 'C · Marker', 'D · Left', 'E · Right'].map(label => <th key={label}>{label}</th>)}</tr></thead>
                  <tbody>
                    {example.rows.map((row, idx) => <tr key={idx} className={row.purpose === 'active' ? 'bg-sky-50/70' : ''}>
                      <td>{row.rows}</td><td className={row.purpose === 'active' ? 'font-semibold text-sky-800' : ''}>{row.purpose}</td>
                      <td>{row.purpose === example.rov_purpose ? <span className="rounded bg-sky-600 text-white px-1.5 py-0.5 font-semibold">ROV</span> : '—'}</td>
                      <td>{row.segments ? leftStr : '—'}</td><td>{row.segments ? rightStr : '—'}</td>
                    </tr>)}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {sheet === 'cells' ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="rounded bg-sky-100 px-2 py-1 font-mono text-sky-800">active</span><ArrowRight size={16} className="shrink-0 text-slate-400" /><span>Use these names in B, D, and E.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs font-mono text-slate-600">
              <span className="rounded-md border border-glass-border px-2 py-1">col_num = {example.total_cols}</span>
              <span className="rounded-md border border-glass-border px-2 py-1">x pitch = {example.x_pitch}</span>
              <span className="rounded-md border border-glass-border px-2 py-1">y pitch = {example.y_pitch}</span>
              <p className="w-full text-sm font-sans text-slate-500">Read rows from top to bottom. “—” means leave the cell empty.</p>
            </div>
          )}

          <div className="rounded-lg border border-glass-border bg-glass-panel p-3 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wide text-glass-muted">
              <span>D · Left</span><span>B · Main</span><span>E · Right</span>
            </div>
            <div className="grid grid-cols-[3fr_8fr_1fr] gap-1 text-center text-sm font-mono font-bold" aria-label="Row composition: 3 left columns, 8 main columns, 1 right column">
              <div className="grid grid-cols-[2fr_1fr] gap-0.5">
                <span className="rounded-l bg-slate-200 py-2 text-slate-600">2</span><span className="rounded-r bg-violet-200 py-2 text-violet-800">1</span>
              </div>
              <span className="rounded bg-sky-200 py-2 text-sky-800">8</span><span className="rounded bg-slate-200 py-2 text-slate-600">1</span>
            </div>
            <p className="text-center text-xs text-glass-muted"><strong className="text-glass-text">{active.cols} main columns</strong> = {example.total_cols} total − {leftCols} left − {rightCols} right</p>
          </div>

          <details className="text-sm text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600 focus-visible:outline-sky-500">Settings & segment syntax</summary>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs font-mono">
              <dt>library</dt><dd>{example.top_lib}</dd><dt>cellname</dt><dd>{example.top_cell}</dd>
              <dt>rov purpose</dt><dd>{example.rov_purpose}</dd><dt>center layer</dt><dd>{example.center_layer} {example.center_purpose}</dd>
            </dl>
            <p className="mt-2 text-xs leading-relaxed">D and E accept name:count, separated by commas: dummy:2, idle:1. Leave a side blank for no padding. Each segment uses its own cell-map rotation. The ROV target is centered after assembly; verification markers use M1 pin.</p>
          </details>
        </div>

        <figure className="min-w-0 border-t lg:border-t-0 lg:border-l border-glass-border bg-glass-bg p-4 sm:p-5">
          <figcaption className="flex items-center justify-between gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Assembled array</span><span>{example.total_cols} columns × {rowCount} rows</span>
          </figcaption>
          <svg viewBox="0 0 520 430" className="excel-guide-figure w-full h-auto mt-2" role="img" aria-label="Twelve-column mixed array: four active rows have two dummy columns and one idle column on the left, eight active columns in the middle, and one dummy column on the right. The active ROV target is centered at zero.">
            <defs><marker id={arrowId} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6" fill="#94a3b8" /></marker></defs>
            <g fontFamily="Inter, system-ui, sans-serif" fontSize="13" fill="#64748b">
              <line x1="60" y1="56" x2="444" y2="56" stroke="#94a3b8" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
              <rect x="202" y="43" width="100" height="24" fill="#f8fafc" /><text x="252" y="60" textAnchor="middle">12 columns</text>
              <line x1="35" y1="88" x2="35" y2="344" stroke="#94a3b8" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
              <rect x="22" y="186" width="26" height="60" fill="#f8fafc" /><text x="39" y="216" textAnchor="middle" transform="rotate(-90 39 216)">8 rows</text>
              {Array.from({ length: rowCount }, (_, row) => Array.from({ length: example.total_cols }, (_, col) => {
                return <rect key={`${row}-${col}`} x={60 + col * 32} y={88 + row * 32} width="32" height="32" rx="2" fill={fillFor(purposeAt(row, col))} stroke="#fff" strokeWidth="2" />;
              }))}
              <rect x={60 + leftCols * 32} y="152" width={active.cols * 32} height="128" rx="3" fill="none" stroke="#0284c7" strokeWidth="2" />
              <line x1={centerX} y1="185" x2={centerX} y2="247" stroke="#0284c7" strokeDasharray="3 3" />
              <line x1={centerX - 31} y1="216" x2={centerX + 31} y2="216" stroke="#0284c7" strokeDasharray="3 3" />
              <circle cx={centerX} cy="216" r="5" fill="#0284c7" stroke="#fff" strokeWidth="2" />
              <text x={centerX} y="416" textAnchor="middle" fill="#0284c7" fontWeight="600">ROV → center (0, 0)</text>
              <g textAnchor="middle" fontSize="12">
                {segments.map((seg, idx) => {
                  const start = segments.slice(0, idx).reduce((sum, part) => sum + part.cols, 0);
                  return <text key={idx} x={60 + (start + seg.cols / 2) * 32} y="369" fill={seg.purpose === 'active' ? '#0284c7' : seg.purpose === 'idle' ? '#7c3aed' : '#64748b'} fontWeight="600">{seg.cols}</text>;
                })}
                <text x="108" y="388" fill="#94a3b8">D · Left</text><text x={centerX} y="388" fill="#94a3b8">B · Main</text><text x="428" y="388" fill="#94a3b8">E · Right</text>
              </g>
            </g>
          </svg>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <span className="h-3 w-3 rounded-sm bg-sky-200 border border-sky-400" /><span>active</span>
            <span className="ml-3 h-3 w-3 rounded-sm bg-violet-200 border border-violet-400" /><span>idle</span>
            <span className="ml-3 h-3 w-3 rounded-sm bg-slate-200 border border-slate-300" /><span>dummy</span>
          </div>
        </figure>
      </div>
    </section>
  );
}
