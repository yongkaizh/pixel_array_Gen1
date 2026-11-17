import React, { useId, useState } from 'react';
import { ArrowRight, FileDown, Grid2X2 } from 'lucide-react';
import { EXCEL_GUIDE_CONFIG as example } from '../config/excelGuide';
import { exportToExcel } from '../exporters/excel';

export function ExcelGuide() {
  const [sheet, setSheet] = useState<'cells' | 'rows'>('cells');
  const arrowId = useId();
  const rowCount = example.rows.reduce((sum, row) => sum + row.rows, 0);
  const activeRow = example.rows[1];
  const [left, active, right] = activeRow.segments!;

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
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white overflow-hidden" aria-label="Visual Excel guide">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-200">
        <div>
          <h4 className="font-semibold text-base text-slate-900">From Excel to your array</h4>
          <p className="mt-1 text-sm text-slate-500">Two sheets. Match the cell names, then set the rows.</p>
        </div>
        <button type="button" onClick={downloadExample} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-sky-500">
          <FileDown size={15} /> Download this example
        </button>
      </div>

      <div className="grid lg:grid-cols-2">
        <div className="min-w-0 p-4 sm:p-5 space-y-4">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Workbook sheet example">
            {(['cells', 'rows'] as const).map((value, idx) => (
              <button key={value} type="button" aria-pressed={sheet === value} onClick={() => setSheet(value)} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-sky-500 ${sheet === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
                <span className="mr-2 text-slate-400">{idx + 1}</span>{value === 'cells' ? 'Map cells' : 'Set rows'}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 text-emerald-800 border-b border-slate-200 text-sm font-mono font-semibold">
              <Grid2X2 size={15} /> {sheet === 'cells' ? 'pix_tbl' : 'format_template'}
            </div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${sheet === 'cells' ? 'Cell mapping' : 'Row layout'} example table`}>
              {sheet === 'cells' ? (
                <table className="excel-guide-table">
                  <caption className="sr-only">Map logical names to physical cells and rotations.</caption>
                  <thead><tr>{['Name', 'library', 'Cell', 'rotation'].map(label => <th key={label}>{label}</th>)}</tr></thead>
                  <tbody>
                    {Object.values(example.cell_map).map(cell => <tr key={cell.name}>
                      <td><span className={`rounded px-1.5 py-1 font-semibold ${cell.name === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>{cell.name}</span></td>
                      <td>{cell.lib}</td><td>{cell.cell}</td><td>{cell.rot}</td>
                    </tr>)}
                  </tbody>
                </table>
              ) : (
                <table className="excel-guide-table excel-guide-rows">
                  <caption className="sr-only">Twelve columns, with two dummy columns on each side of the active rows.</caption>
                  <thead><tr>{['A · row_num', 'B · Purpose', 'C · Marker', 'D · Left', 'E · Right'].map(label => <th key={label}>{label}</th>)}</tr></thead>
                  <tbody>
                    {example.rows.map((row, idx) => <tr key={idx} className={row.purpose === 'active' ? 'bg-blue-50' : ''}>
                      <td>{row.rows}</td><td className={row.purpose === 'active' ? 'font-semibold text-blue-800' : ''}>{row.purpose}</td>
                      <td>{row.purpose === example.rov_purpose ? <span className="rounded bg-blue-600 text-white px-1.5 py-0.5 font-semibold">ROV</span> : '—'}</td>
                      <td>{row.segments ? `dummy:${left.cols}` : '—'}</td><td>{row.segments ? `dummy:${right.cols}` : '—'}</td>
                    </tr>)}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {sheet === 'cells' ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="rounded bg-blue-100 px-2 py-1 font-mono text-blue-800">active</span><ArrowRight size={16} className="shrink-0 text-slate-400" /><span>The same name goes in column B.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs font-mono text-slate-600">
              <span className="rounded-md border border-slate-200 px-2 py-1">col_num = {example.total_cols}</span>
              <span className="rounded-md border border-slate-200 px-2 py-1">x pitch = {example.x_pitch}</span>
              <span className="rounded-md border border-slate-200 px-2 py-1">y pitch = {example.y_pitch}</span>
              <p className="w-full text-sm font-sans text-slate-500">Read rows from top to bottom. “—” means leave the cell empty.</p>
            </div>
          )}

          <details className="text-sm text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600 focus-visible:outline-sky-500">Other template settings</summary>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs font-mono">
              <dt>library</dt><dd>{example.top_lib}</dd><dt>cellname</dt><dd>{example.top_cell}</dd>
              <dt>rov purpose</dt><dd>{example.rov_purpose}</dd><dt>center layer</dt><dd>{example.center_layer} {example.center_purpose}</dd>
            </dl>
            <p className="mt-2 text-xs leading-relaxed">Use Name as the shared key; Display Name is optional. Padding uses name:count, for example dummy:2. Keep the exported headers.</p>
          </details>
        </div>

        <figure className="min-w-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 p-4 sm:p-5">
          <figcaption className="flex items-center justify-between gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Your resulting array</span><span>{example.total_cols} columns × {rowCount} rows</span>
          </figcaption>
          <svg viewBox="0 0 520 430" className="excel-guide-figure w-full h-auto mt-2" role="img" aria-label="Twelve-column array: two dummy rows at the top and bottom, four active rows with two dummy columns on each side. The ROV target is centered at zero.">
            <defs><marker id={arrowId} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6" fill="#94a3b8" /></marker></defs>
            <g fontFamily="Inter, system-ui, sans-serif" fontSize="13" fill="#64748b">
              <line x1="60" y1="56" x2="444" y2="56" stroke="#94a3b8" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
              <rect x="202" y="43" width="100" height="24" fill="#f8fafc" /><text x="252" y="60" textAnchor="middle">12 columns</text>
              <line x1="35" y1="88" x2="35" y2="344" stroke="#94a3b8" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
              <rect x="22" y="186" width="26" height="60" fill="#f8fafc" /><text x="39" y="216" textAnchor="middle" transform="rotate(-90 39 216)">8 rows</text>
              {Array.from({ length: rowCount }, (_, row) => Array.from({ length: example.total_cols }, (_, col) => {
                const isActive = row >= 2 && row < 6 && col >= left.cols && col < left.cols + active.cols;
                return <rect key={`${row}-${col}`} x={60 + col * 32} y={88 + row * 32} width="32" height="32" rx="2" fill={isActive ? '#bfdbfe' : '#e2e8f0'} stroke="#fff" strokeWidth="2" />;
              }))}
              <rect x="124" y="152" width="256" height="128" rx="3" fill="none" stroke="#2563eb" strokeWidth="2" />
              <line x1="252" y1="185" x2="252" y2="247" stroke="#1d4ed8" strokeDasharray="3 3" />
              <line x1="221" y1="216" x2="283" y2="216" stroke="#1d4ed8" strokeDasharray="3 3" />
              <circle cx="252" cy="216" r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
              <text x="252" y="416" textAnchor="middle" fill="#1d4ed8" fontWeight="600">ROV → center (0, 0)</text>
              <g textAnchor="middle" fontSize="12">
                <text x="92" y="369">2 dummy</text><text x="252" y="369" fill="#1d4ed8" fontWeight="600">8 active · calculated</text><text x="412" y="369">2 dummy</text>
                <text x="92" y="388" fill="#94a3b8">D · Left</text><text x="252" y="388" fill="#94a3b8">B · Purpose</text><text x="412" y="388" fill="#94a3b8">E · Right</text>
              </g>
            </g>
          </svg>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <span className="h-3 w-3 rounded-sm bg-blue-200 border border-blue-400" /><span>active</span>
            <span className="ml-3 h-3 w-3 rounded-sm bg-slate-200 border border-slate-300" /><span>dummy</span>
          </div>
        </figure>
      </div>
    </section>
  );
}
