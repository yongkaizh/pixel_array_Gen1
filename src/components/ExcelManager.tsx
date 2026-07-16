import React, { useState, useRef } from 'react';
import { Upload, FileDown, CheckCircle, AlertCircle, RefreshCw, Layers, ArrowRight, Info, Check, Play, Download } from 'lucide-react';
import { LayoutConfig } from '../types';
import { parseExcelFile, exportToExcel, getExcelImportErrorDetails } from '../utils';

interface ExcelManagerProps {
  config: LayoutConfig;
  onConfigChange: (config: LayoutConfig) => void;
  onApplyConfig?: (config: LayoutConfig) => void;
  onSetStatus: (status: { type: 'success' | 'error' | 'idle'; message: string }) => void;
}

export function ExcelManager({ config, onConfigChange, onApplyConfig, onSetStatus }: ExcelManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<LayoutConfig | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<ReturnType<typeof getExcelImportErrorDetails> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setParsing(true);
    onSetStatus({ type: 'idle', message: 'Parsing spreadsheet...' });

    try {
      const buffer = await file.arrayBuffer();
      const parsedConfig = parseExcelFile(buffer);
      setPendingConfig(parsedConfig);
      setPendingFileName(file.name);
      setErrorDetails(null);
      onSetStatus({
        type: 'success',
        message: `Staged: Successfully parsed '${file.name}' with ${parsedConfig.rows.length} row sections and ${parsedConfig.total_cols} columns. Click 'Apply Staged Layout' below to update the generator.`
      });
    } catch (err: any) {
      console.error(err);
      const details = getExcelImportErrorDetails(err);
      setErrorDetails(details);
      onSetStatus({
        type: 'error',
        message: `${details.title}: ${details.summary}`
      });
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyPendingConfig = () => {
    if (!pendingConfig) return;
    if (onApplyConfig) {
      onApplyConfig(pendingConfig);
    } else {
      onConfigChange(pendingConfig);
      onSetStatus({
        type: 'success',
        message: `Applied: Active layout updated from file '${pendingFileName}'.`
      });
    }
    setPendingConfig(null);
    setPendingFileName('');
  };

  const discardPendingConfig = () => {
    setPendingConfig(null);
    setPendingFileName('');
    setErrorDetails(null);
    onSetStatus({
      type: 'idle',
      message: 'Staged file changes discarded.'
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleExportExcel = () => {
    try {
      const buffer = exportToExcel(config);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'array_pixel_config.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error exporting configuration.');
    }
  };

  const handleLoadExampleTemplate = () => {
    handleExportExcel();
  };

  return (
    <div className="bg-glass-panel rounded-lg border border-glass-border p-6 flex flex-col gap-6 text-glass-text">
      <div className="space-y-1.5">
        <h3 className="font-sans font-black uppercase italic tracking-tight text-base">
          Excel Spreadsheet Integration
        </h3>
        <p className="text-xs text-glass-text/80 leading-relaxed">
          Start by uploading an .xlsx layout file. The workbook feeds the same layout data that is later used to generate the final SKILL script, so the required structure stays important.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-glass-text/80">
          <span className="bg-glass-bg px-2 py-1 border border-glass-border/20">1. Upload</span>
          <span>→</span>
          <span className="bg-glass-bg px-2 py-1 border border-glass-border/20">2. Review</span>
          <span>→</span>
          <span className="bg-glass-bg px-2 py-1 border border-glass-border/20">3. Apply</span>
        </div>
      </div>

      <div className="border border-glass-border/20 bg-glass-panel p-4 space-y-2.5">
        <p className="text-xs font-mono font-black uppercase tracking-[0.2em] text-glass-text/90">
          What the workbook should contain
        </p>
        <ul className="text-sm text-glass-text/80 space-y-1.5 list-disc pl-4 leading-relaxed">
          <li>A sheet named <span className="font-semibold">pix_tbl</span> with the logical-to-physical cell mappings.</li>
          <li>A sheet named <span className="font-semibold">format_template</span> with the row and column layout parameters.</li>
          <li>Enough filled values for the parser to build the same config used by the final SKILL layout generator.</li>
        </ul>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => {
          if (!pendingConfig && !parsing) {
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed p-8 flex flex-col items-center justify-center text-center gap-3 transition-all rounded-lg glass-panel ${
          pendingConfig
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-2000/10 hover:bg-amber-500/10 text-amber-2000/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
            : isDragging
            ? 'border-neon-cyan bg-white/60 ring-2 ring-neon-cyan/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
            : 'border-glass-border hover:border-glass-border-hover bg-white/40 hover:bg-white/60 cursor-pointer'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileSelect}
          accept=".xlsx"
          className="hidden"
        />
        {parsing ? (
          <>
            <RefreshCw className="w-10 h-10 text-glass-text animate-spin" />
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-glass-text">
                Parsing Excel sheets...
              </p>
              <p className="text-xs uppercase font-mono text-glass-text/90 mt-1">
                Reading pix_tbl and format_template definitions
              </p>
            </div>
          </>
        ) : pendingConfig ? (
          <div className="flex flex-col items-center justify-center gap-3.5 w-full" onClick={(e) => e.stopPropagation()}>
            <CheckCircle className="w-10 h-10 text-neon-emerald shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-mono font-black uppercase tracking-wider text-amber-400">
                // SPREADSHEET STAGED &amp; READY
              </p>
              <p className="text-xs text-glass-text font-bold">
                File: <code className="font-mono bg-glass-panel px-1.5 py-0.5 border border-glass-border/20 text-amber-300">{pendingFileName}</code>
              </p>
              <div className="flex items-center justify-center gap-4 text-xs font-mono text-glass-text/80 mt-1">
                <span>Row blocks: <strong className="text-black">{pendingConfig.rows.length}</strong></span>
                <span>•</span>
                <span>Total width: <strong className="text-black">{pendingConfig.total_cols} columns</strong></span>
              </div>
            </div>

            {/* Inline Action Buttons inside Drag and Drop */}
            <div className="flex items-center gap-2.5 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  discardPendingConfig();
                }}
                className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-300 hover:text-slate-900 glass-button rounded-lg transition cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  applyPendingConfig();
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-mono font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 border border-glass-border shadow-lg rounded-lg transition active:translate-y-0.5 active:shadow-none cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Apply &amp; Compile Spreadsheet
              </button>
            </div>

            <p className="text-sm uppercase font-mono text-glass-text/90 mt-2">
              Or drag another file here / <span className="underline cursor-pointer text-indigo-700 hover:text-indigo-900 font-bold" onClick={() => fileInputRef.current?.click()}>click to replace</span>
            </p>
          </div>
        ) : (
          <>
            <Upload className={`w-10 h-10 ${isDragging ? 'text-emerald-600' : 'text-glass-text/80'}`} />
            <div className="max-w-md">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-glass-text">
                Drop your layout workbook here to begin
              </p>
              <p className="text-xs uppercase font-mono text-glass-text/80 mt-1 leading-relaxed">
                Use a valid .xlsx file with the required sheets and columns. If you are unsure, start with the example template.
              </p>
            </div>
          </>
        )}
      </div>

      {errorDetails && (
        <div className="border-2 border-rose-600 bg-rose-50 p-4 space-y-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-rose-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-mono font-black uppercase tracking-wider text-rose-400">{errorDetails.title}</p>
              <p className="text-xs text-rose-200 mt-1">{errorDetails.summary}</p>
              {errorDetails.missingItem && (
                <p className="text-sm text-rose-200 mt-1"><span className="font-bold">Missing item:</span> {errorDetails.missingItem}</p>
              )}
              <p className="text-sm text-rose-200 mt-2 leading-relaxed">{errorDetails.fixSuggestion}</p>
            </div>
          </div>
          {errorDetails.showTemplateButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLoadExampleTemplate();
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-mono font-bold uppercase tracking-wider text-white bg-slate-200 hover:bg-slate-300 border border-glass-border rounded-lg transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Load Example Template
            </button>
          )}
        </div>
      )}

      {/* Template Actions */}
      <div className="flex items-center justify-between gap-4 p-4 bg-glass-bg rounded-lg border border-glass-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-wide">Need a starting point?</span>
          <span className="text-xs font-mono text-glass-text/80">Export your current config to .xlsx or load the example template if you are just getting started.</span>
        </div>
        <button
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-mono font-bold uppercase tracking-wider text-white glass-button rounded-lg transition-all cursor-pointer"
          >
          <FileDown className="w-3.5 h-3.5 text-green-400" />
          Export Active Config
        </button>
      </div>

      {/* Visual Explanation of Mixed Cell Layout (Saves user confusion) */}
      <div className="bg-slate-100 text-white p-6 rounded-lg border border-glass-border space-y-4">
        <div className="flex items-center gap-2 border-b border-glass-border pb-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          <h4 className="text-xs font-mono font-black uppercase tracking-widest text-emerald-600">
            How Mixed Cell (Heterogeneous) Row Layouts Work
          </h4>
        </div>
        
        <p className="text-xs leading-relaxed font-sans text-slate-300">
          To build complex arrays (e.g. adding <strong>dummy, idle, or guardring cells</strong> to the boundaries of rows), you do not need to manually map thousands of individual coordinates. 
          The compiler automatically splits any row block into structured <strong>segments</strong> based on Columns D & E in your sheet! Here is how to indicate exactly which physical unit cell gets inserted:
        </p>

        {/* Dynamic Graphic Explanation Map */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-[#1e1e1e] text-white border border-[#333] p-4 font-mono text-xs tracking-tight rounded-lg">
          {/* Box 1 */}
          <div>
            <div className="text-amber-400 font-bold uppercase mb-2">// 1. SPREADSHEET ROW DEFINITION</div><p className="text-slate-300 text-sm mb-2">In sheet <code className="text-white font-bold">format_template</code>, define row blocks. Reference your custom purpose keys for segments:
            </p>
            <div className="bg-[#2d2d2d] border border-[#444] p-2 space-y-1 rounded-lg text-sm">
              <div><code className="text-sky-600 font-bold">rov</code> ➔ 5 rows ➔ <code className="text-emerald-600 font-bold">dummy</code>:20, <code className="text-sky-600 font-bold">active</code>:100, <code className="text-emerald-600 font-bold">dummy</code>:20</div>
            </div>
          </div>

          {/* Box 2 */}
          <div>
            <div className="text-amber-400 font-bold uppercase mb-2">// 2. THE CELL CLASS MAPPING</div><p className="text-slate-300 text-sm mb-2">In sheet <code className="text-white font-bold">pix_tbl</code> (or Cell Mapping tab), tell the compiler exactly which physical unit cell coordinates correspond to each purpose key:
            </p>
            <div className="bg-[#2d2d2d] border border-[#444] p-2 space-y-1 rounded-lg text-sm">
              <div><code className="text-sky-600 font-bold">active</code> ➔ Cell: <code className="text-white font-bold">pixel_active</code>, Lib: <code className="text-white font-bold">pixel_lib</code></div>
              <div><code className="text-emerald-600 font-bold">dummy</code> ➔ Cell: <code className="text-white font-bold">pixel_dummy</code>, Lib: <code className="text-white font-bold">pixel_lib</code></div>
              <div><code className="text-purple-600 font-bold">idle</code> ➔ Cell: <code className="text-white font-bold">pixel_idle_1x</code>, Lib: <code className="text-white font-bold">sensor_lib</code></div>
            </div>
          </div>

          {/* Box 3 */}
          <div className="space-y-2 lg:pl-4">
            <div className="text-amber-400 font-bold uppercase">// 3. RESULTING CAD ROW LAYOUT</div>
            <p className="text-slate-300 text-sm leading-snug">
              The engine automatically calculates centering offsets &amp; outputs clean aligned simple mosaic blocks in the CAD coordinate:
            </p>
            <div className="mt-3 p-3 bg-[#2d2d2d] border border-[#444] rounded-lg text-xs font-mono space-y-2">
              <div className="text-white font-bold">Generated Physical Composition:</div>
              <div className="flex w-full h-4 rounded overflow-hidden">
                <span className="bg-emerald-900 border border-emerald-700 text-emerald-100 px-1 py-0.5 font-bold flex items-center justify-center">dummy x20</span>
                <span className="bg-purple-900 border border-purple-700 text-purple-100 px-1 py-0.5 font-bold flex items-center justify-center">idle x10</span>
                <span className="bg-sky-900 border border-sky-700 text-sky-100 px-1 py-0.5 flex-1 font-bold flex items-center justify-center">active (Center region)</span>
                <span className="bg-emerald-900 border border-emerald-700 text-emerald-100 px-1 py-0.5 font-bold flex items-center justify-center">dummy x20</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm bg-slate-200/50 p-3 rounded-lg border border-slate-300">
            <strong>Summary:</strong> By adding a custom map key (e.g. <code className="text-white bg-slate-300 px-1 font-mono">my_cell</code>) in the cell mapping sub-tab, you can insert it anywhere in your array row layout by simply using its key name followed by the columns count (e.g. <code className="text-emerald-700 font-mono font-bold">my_cell:16</code>). 
        </div>
      </div>

      {/* File Format Instructions */}
      <div className="space-y-2">
        <h4 className="text-sm font-black uppercase tracking-wider text-glass-text/80">Excel File Sheet Layout Specifications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-glass-bg/30 p-3 rounded-lg border border-glass-border overflow-x-auto">
            <div className="font-bold text-glass-text mb-1 font-mono text-sm uppercase italic">1. pix_tbl (Cell Library Map)</div>
            <p className="text-glass-text/90 text-sm leading-relaxed mb-2">
              Defines physical libraries, cell names, and placement rotations for purpose classes.
            </p>
            <div className="font-mono text-xs text-glass-text bg-glass-panel border border-glass-border rounded-lg overflow-hidden min-w-[300px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-glass-bg text-glass-text">
                  <tr>
                    <th className="p-1 border-b border-glass-border border-r w-6 text-center font-normal text-glass-muted"></th>
                    <th className="p-1 border-b border-glass-border border-r text-center font-normal">A</th>
                    <th className="p-1 border-b border-glass-border border-r text-center font-normal">B</th>
                    <th className="p-1 border-b border-glass-border border-r text-center font-normal">C</th>
                    <th className="p-1 border-b border-glass-border text-center font-normal">D</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-glass-border">
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center text-glass-muted">1</td>
                    <td className="p-1 border-r border-glass-border font-bold">Name</td>
                    <td className="p-1 border-r border-glass-border font-bold">library</td>
                    <td className="p-1 border-r border-glass-border font-bold">Cell</td>
                    <td className="p-1 font-bold">rotation</td>
                  </tr>
                  <tr className="border-b border-glass-border">
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center text-glass-muted">2</td>
                    <td className="p-1 border-r border-glass-border">active</td>
                    <td className="p-1 border-r border-glass-border">pixel_lib</td>
                    <td className="p-1 border-r border-glass-border">pixel_active</td>
                    <td className="p-1">R0</td>
                  </tr>
                  <tr>
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center text-glass-muted">3</td>
                    <td className="p-1 border-r border-glass-border">rov</td>
                    <td className="p-1 border-r border-glass-border">pixel_lib</td>
                    <td className="p-1 border-r border-glass-border">pixel_rov</td>
                    <td className="p-1">MX</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-glass-bg/30 p-3 rounded-lg border border-glass-border overflow-x-auto col-span-1 md:col-span-2">
            <div className="font-bold text-glass-text mb-1 font-mono text-sm uppercase italic">2. format_template (Params & Grid)</div>
            <p className="text-glass-text/90 text-sm leading-relaxed mb-3">
              Contains scalar metadata, column count, and stacked row blocks. 
              <strong> Heterogeneous Rows Support (Columns D & E):</strong> Specify left/right segment padding to create varying cell rows. 
            </p>
            <p className="text-xs text-glass-text/75 mt-2">
              Use format <code className="bg-slate-200 text-white px-1 font-bold">count</code> (e.g. <code className="bg-slate-200 text-white px-1">20</code>, defaults to <code className="bg-slate-200 text-white px-1">dummy</code>) or <code className="bg-slate-200 text-white px-1">purpose:count</code> (e.g. <code className="bg-slate-200 text-white px-1">dummy:20</code> or <code className="bg-slate-200 text-white px-1">idle:10,dummy:10</code>). The center active region columns count is calculated automatically!
            </p>
            <div className="font-mono text-xs text-glass-text bg-glass-panel border border-glass-border rounded-lg overflow-hidden min-w-[600px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-glass-bg text-glass-text">
                  <tr>
                    <th className="p-1 border-b border-glass-border border-r w-6 text-center font-normal text-glass-muted"></th>
                    <th className="p-1 border-b border-glass-border border-r text-center font-normal">A (row_num)</th>
                    <th className="p-1 border-b border-glass-border border-r text-center font-normal">B (Purpose)</th>
                    <th className="p-1 border-b border-glass-border border-r text-center font-normal">C (Marker)</th>
                    <th className="p-1 border-b border-glass-border border-r text-center font-normal">D (Left Padding)</th>
                    <th className="p-1 border-b border-glass-border text-center font-normal">E (Right Padding)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-glass-border text-glass-text/80 italic bg-glass-bg">
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center">...</td>
                    <td className="p-1 border-r border-glass-border">...</td>
                    <td className="p-1 border-r border-glass-border">...</td>
                    <td className="p-1 border-r border-glass-border">...</td>
                    <td className="p-1 border-r border-glass-border">...</td>
                    <td className="p-1">...</td>
                  </tr>
                  <tr className="border-b border-glass-border">
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center text-glass-muted">12</td>
                    <td className="p-1 border-r border-glass-border font-bold bg-amber-500/10 text-amber-200">col_num</td>
                    <td className="p-1 border-r border-glass-border bg-amber-500/10 text-amber-200">1936</td>
                    <td className="p-1 border-r border-glass-border">active</td>
                    <td className="p-1 border-r border-glass-border"></td>
                    <td className="p-1"></td>
                  </tr>
                  <tr className="border-b border-glass-border">
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center text-glass-muted">13</td>
                    <td className="p-1 border-r border-glass-border font-bold">row_num</td>
                    <td className="p-1 border-r border-glass-border font-bold">Row Count</td>
                    <td className="p-1 border-r border-glass-border font-bold">ROV Indicator</td>
                    <td className="p-1 border-r border-glass-border font-bold text-emerald-600">Left Column Segments</td>
                    <td className="p-1 font-bold text-emerald-600">Right Column Segments</td>
                  </tr>
                  <tr className="border-b border-glass-border">
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center text-glass-muted">14</td>
                    <td className="p-1 border-r border-glass-border">1294</td>
                    <td className="p-1 border-r border-glass-border">active (c1)</td>
                    <td className="p-1 border-r border-glass-border"></td>
                    <td className="p-1 border-r border-glass-border text-emerald-600 font-bold">dummy:20</td>
                    <td className="p-1 text-emerald-600 font-bold">dummy:20</td>
                  </tr>
                  <tr className="border-b border-glass-border">
                    <td className="p-1 border-r border-glass-border bg-glass-bg text-center text-glass-muted">15</td>
                    <td className="p-1 border-r border-glass-border">2</td>
                    <td className="p-1 border-r border-glass-border">rov (rov)</td>
                    <td className="p-1 border-r border-glass-border font-black text-red-500">ROV</td>
                    <td className="p-1 border-r border-glass-border"></td>
                    <td className="p-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
