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
    <div className="bg-white rounded-none border-2 border-[#141414] p-6 flex flex-col gap-6 text-[#141414]">
      <div className="space-y-1.5">
        <h3 className="font-sans font-black uppercase italic tracking-tight text-base">
          Excel Spreadsheet Integration
        </h3>
        <p className="text-xs text-[#141414]/80 leading-relaxed">
          Start by uploading an .xlsx layout file. The workbook feeds the same layout data that is later used to generate the final SKILL script, so the required structure stays important.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#141414]/65">
          <span className="bg-[#E4E3E0] px-2 py-1 border border-[#141414]/20">1. Upload</span>
          <span>→</span>
          <span className="bg-[#E4E3E0] px-2 py-1 border border-[#141414]/20">2. Review</span>
          <span>→</span>
          <span className="bg-[#E4E3E0] px-2 py-1 border border-[#141414]/20">3. Apply</span>
        </div>
      </div>

      <div className="border border-[#141414]/20 bg-[#F7F6F2] p-4 space-y-2.5">
        <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-[#141414]/70">
          What the workbook should contain
        </p>
        <ul className="text-[11px] text-[#141414]/80 space-y-1.5 list-disc pl-4 leading-relaxed">
          <li>A sheet named <span className="font-semibold">pix_tbl</span> with the logical-to-physical cell mappings.</li>
          <li>A sheet named <span className="font-semibold">format_template</span> with the row and column layout parameters.</li>
          <li>Enough filled values for the parser to build the same config used by the final SKILL layout generator.</li>
        </ul>
      </div>

      {/* Drag & Drop Box */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => {
          if (!pendingConfig && !parsing) {
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed p-8 flex flex-col items-center justify-center text-center gap-3 transition-all rounded-none ${
          pendingConfig
            ? 'border-amber-600 bg-amber-50/40 hover:bg-amber-50/70'
            : isDragging
            ? 'border-emerald-600 bg-emerald-50'
            : 'border-[#141414] hover:border-black bg-[#E4E3E0]/50 hover:bg-[#E4E3E0] cursor-pointer'
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
            <RefreshCw className="w-10 h-10 text-[#141414] animate-spin" />
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">
                Parsing Excel sheets...
              </p>
              <p className="text-[10px] uppercase font-mono text-[#141414]/50 mt-1">
                Reading pix_tbl and format_template definitions
              </p>
            </div>
          </>
        ) : pendingConfig ? (
          <div className="flex flex-col items-center justify-center gap-3.5 w-full" onClick={(e) => e.stopPropagation()}>
            <CheckCircle className="w-10 h-10 text-amber-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-mono font-black uppercase tracking-wider text-amber-950">
                // SPREADSHEET STAGED &amp; READY
              </p>
              <p className="text-xs text-[#141414] font-bold">
                File: <code className="font-mono bg-white px-1.5 py-0.5 border border-[#141414]/20 text-amber-800">{pendingFileName}</code>
              </p>
              <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-[#141414]/65 mt-1">
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
                className="px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#141414]/75 hover:text-rose-700 bg-white border border-[#141414]/30 hover:border-rose-600 rounded-none transition cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  applyPendingConfig();
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-mono font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 border-2 border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] rounded-none transition active:translate-y-0.5 active:shadow-none cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Apply &amp; Compile Spreadsheet
              </button>
            </div>

            <p className="text-[9px] uppercase font-mono text-[#141414]/50 mt-2">
              Or drag another file here / <span className="underline cursor-pointer text-indigo-700 hover:text-indigo-900 font-bold" onClick={() => fileInputRef.current?.click()}>click to replace</span>
            </p>
          </div>
        ) : (
          <>
            <Upload className={`w-10 h-10 ${isDragging ? 'text-emerald-600' : 'text-[#141414]/60'}`} />
            <div className="max-w-md">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">
                Drop your layout workbook here to begin
              </p>
              <p className="text-[10px] uppercase font-mono text-[#141414]/60 mt-1 leading-relaxed">
                Use a valid .xlsx file with the required sheets and columns. If you are unsure, start with the example template.
              </p>
            </div>
          </>
        )}
      </div>

      {errorDetails && (
        <div className="border-2 border-rose-600 bg-rose-50 p-4 space-y-3 rounded-none">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-rose-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-mono font-black uppercase tracking-wider text-rose-800">{errorDetails.title}</p>
              <p className="text-xs text-rose-900 mt-1">{errorDetails.summary}</p>
              {errorDetails.missingItem && (
                <p className="text-[11px] text-rose-900 mt-1"><span className="font-bold">Missing item:</span> {errorDetails.missingItem}</p>
              )}
              <p className="text-[11px] text-rose-900 mt-2 leading-relaxed">{errorDetails.fixSuggestion}</p>
            </div>
          </div>
          {errorDetails.showTemplateButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLoadExampleTemplate();
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-white bg-[#141414] hover:bg-black border border-[#141414] rounded-none transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Load Example Template
            </button>
          )}
        </div>
      )}

      {/* Template Actions */}
      <div className="flex items-center justify-between gap-4 p-4 bg-[#E4E3E0] rounded-none border border-[#141414]">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-wide">Need a starting point?</span>
          <span className="text-[10px] font-mono text-[#141414]/60">Export your current config to .xlsx or load the example template if you are just getting started.</span>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-white bg-[#141414] hover:bg-black border border-[#141414] rounded-none transition-all cursor-pointer"
        >
          <FileDown className="w-3.5 h-3.5 text-green-400" />
          Export Active Config
        </button>
      </div>

      {/* Visual Explanation of Mixed Cell Layout (Saves user confusion) */}
      <div className="bg-[#141414] text-white p-6 rounded-none border-2 border-[#141414] space-y-4">
        <div className="flex items-center gap-2 border-b border-white/20 pb-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h4 className="text-xs font-mono font-black uppercase tracking-widest text-emerald-400">
            How Mixed Cell (Heterogeneous) Row Layouts Work
          </h4>
        </div>
        
        <p className="text-xs leading-relaxed font-sans text-slate-300">
          To build complex arrays (e.g. adding <strong>dummy, idle, or guardring cells</strong> to the boundaries of rows), you do not need to manually map thousands of individual coordinates. 
          The compiler automatically splits any row block into structured <strong>segments</strong> based on Columns D & E in your sheet! Here is how to indicate exactly which physical unit cell gets inserted:
        </p>

        {/* Dynamic Graphic Explanation Map */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-zinc-900 border border-zinc-800 p-4 font-mono text-[10px] tracking-tight">
          {/* Box 1 */}
          <div className="space-y-2 border-b lg:border-b-0 lg:border-r border-zinc-800 pb-3 lg:pb-0 lg:pr-4">
            <div className="text-amber-400 font-bold uppercase">// 1. SPREADSHEET ROW DEFINITION</div>
            <p className="text-slate-400 text-[9px] leading-snug">
              In sheet <code className="text-white">format_template</code>, define row blocks. Reference your custom purpose keys for segments:
            </p>
            <div className="bg-black/40 border border-zinc-700 p-2 space-y-1 rounded-none text-[9px]">
              <div>Row purpose: <code className="text-sky-300 font-bold">active</code></div>
              <div>Col D (Left Padding): <code className="text-emerald-400 font-bold">dummy:20, idle:10</code></div>
              <div>Col E (Right Padding): <code className="text-emerald-400 font-bold">dummy:20</code></div>
            </div>
          </div>

          {/* Box 2 */}
          <div className="space-y-2 border-b lg:border-b-0 lg:border-r border-zinc-800 pb-3 lg:pb-0 lg:px-4">
            <div className="text-amber-400 font-bold uppercase">// 2. THE CELL CLASS MAPPING</div>
            <p className="text-slate-400 text-[9px] leading-snug">
              In sheet <code className="text-white">pix_tbl</code> (or Cell Mapping tab), tell the compiler exactly which physical unit cell coordinates correspond to each purpose key:
            </p>
            <div className="bg-black/40 border border-zinc-700 p-2 space-y-1 rounded-none text-[9px]">
              <div><code className="text-sky-300">active</code> ➔ Cell: <code className="text-white">pixel_active</code>, Lib: <code className="text-white">pixel_lib</code></div>
              <div><code className="text-emerald-400">dummy</code> ➔ Cell: <code className="text-white">pixel_dummy</code>, Lib: <code className="text-white">pixel_lib</code></div>
              <div><code className="text-purple-400">idle</code> ➔ Cell: <code className="text-white">pixel_idle_1x</code>, Lib: <code className="text-white">sensor_lib</code></div>
            </div>
          </div>

          {/* Box 3 */}
          <div className="space-y-2 lg:pl-4">
            <div className="text-amber-400 font-bold uppercase">// 3. RESULTING CAD ROW LAYOUT</div>
            <p className="text-slate-400 text-[9px] leading-snug">
              The engine automatically calculates centering offsets &amp; outputs clean aligned simple mosaic blocks in the CAD coordinate:
            </p>
            <div className="border border-emerald-800 bg-emerald-950/20 p-2 text-center rounded-none font-bold text-[9px] space-y-1">
              <div className="text-white">Generated Physical Composition:</div>
              <div className="flex items-center gap-0.5 justify-center mt-1.5 text-[8px]">
                <span className="bg-emerald-900 border border-emerald-700 text-white px-1 py-0.5">dummy x20</span>
                <span className="text-slate-500 font-normal">➔</span>
                <span className="bg-purple-900 border border-purple-700 text-white px-1 py-0.5">idle x10</span>
                <span className="text-slate-500 font-normal">➔</span>
                <span className="bg-sky-900 border border-sky-700 text-white px-1 py-0.5 flex-1">active (Center region)</span>
                <span className="text-slate-500 font-normal">➔</span>
                <span className="bg-emerald-900 border border-emerald-700 text-white px-1 py-0.5">dummy x20</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-zinc-400 text-[11px] leading-relaxed font-sans bg-zinc-900/60 p-3 border border-zinc-800">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong>Summary:</strong> By adding a custom map key (e.g. <code className="text-white bg-black px-1 font-mono">my_cell</code>) in the cell mapping sub-tab, you can insert it anywhere in your array row layout by simply using its key name followed by the columns count (e.g. <code className="text-emerald-400 font-mono font-bold">my_cell:16</code>). 
          </div>
        </div>
      </div>

      {/* File Format Instructions */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#141414]/60">Excel File Sheet Layout Specifications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#E4E3E0]/30 p-3 rounded-none border border-[#141414] overflow-x-auto">
            <div className="font-bold text-[#141414] mb-1 font-mono text-[11px] uppercase italic">1. pix_tbl (Cell Library Map)</div>
            <p className="text-[#141414]/70 text-[11px] leading-relaxed mb-2">
              Defines physical libraries, cell names, and placement rotations for purpose classes.
            </p>
            <div className="font-mono text-[10px] text-[#141414] bg-white border border-[#141414] rounded-none overflow-hidden min-w-[300px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F0F0F0] text-[#141414]">
                  <tr>
                    <th className="p-1 border-b border-[#141414] border-r w-6 text-center font-normal text-[#888]"></th>
                    <th className="p-1 border-b border-[#141414] border-r text-center font-normal">A</th>
                    <th className="p-1 border-b border-[#141414] border-r text-center font-normal">B</th>
                    <th className="p-1 border-b border-[#141414] border-r text-center font-normal">C</th>
                    <th className="p-1 border-b border-[#141414] text-center font-normal">D</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#E4E3E0]">
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center text-[#888]">1</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold">Name</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold">library</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold">Cell</td>
                    <td className="p-1 font-bold">rotation</td>
                  </tr>
                  <tr className="border-b border-[#E4E3E0]">
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center text-[#888]">2</td>
                    <td className="p-1 border-r border-[#E4E3E0]">active</td>
                    <td className="p-1 border-r border-[#E4E3E0]">pixel_lib</td>
                    <td className="p-1 border-r border-[#E4E3E0]">pixel_active</td>
                    <td className="p-1">R0</td>
                  </tr>
                  <tr>
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center text-[#888]">3</td>
                    <td className="p-1 border-r border-[#E4E3E0]">rov</td>
                    <td className="p-1 border-r border-[#E4E3E0]">pixel_lib</td>
                    <td className="p-1 border-r border-[#E4E3E0]">pixel_rov</td>
                    <td className="p-1">MX</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-[#E4E3E0]/30 p-3 rounded-none border border-[#141414] overflow-x-auto col-span-1 md:col-span-2">
            <div className="font-bold text-[#141414] mb-1 font-mono text-[11px] uppercase italic">2. format_template (Params & Grid)</div>
            <p className="text-[#141414]/70 text-[11px] leading-relaxed mb-3">
              Contains scalar metadata, column count, and stacked row blocks. 
              <strong> Heterogeneous Rows Support (Columns D & E):</strong> Specify left/right segment padding to create varying cell rows. 
              Use format <code className="bg-[#141414]/10 px-1 font-bold">count</code> (e.g. <code className="bg-[#141414]/10 px-1">20</code>, defaults to <code className="bg-[#141414]/10 px-1">dummy</code>) or <code className="bg-[#141414]/10 px-1">purpose:count</code> (e.g. <code className="bg-[#141414]/10 px-1">dummy:20</code> or <code className="bg-[#141414]/10 px-1">idle:10,dummy:10</code>). The center active region columns count is calculated automatically!
            </p>
            <div className="font-mono text-[10px] text-[#141414] bg-white border border-[#141414] rounded-none overflow-hidden min-w-[600px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F0F0F0] text-[#141414]">
                  <tr>
                    <th className="p-1 border-b border-[#141414] border-r w-6 text-center font-normal text-[#888]"></th>
                    <th className="p-1 border-b border-[#141414] border-r text-center font-normal">A (row_num)</th>
                    <th className="p-1 border-b border-[#141414] border-r text-center font-normal">B (Purpose)</th>
                    <th className="p-1 border-b border-[#141414] border-r text-center font-normal">C (Marker)</th>
                    <th className="p-1 border-b border-[#141414] border-r text-center font-normal">D (Left Padding)</th>
                    <th className="p-1 border-b border-[#141414] text-center font-normal">E (Right Padding)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#E4E3E0] text-[#141414]/40 italic bg-[#FAFAFA]">
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center">...</td>
                    <td className="p-1 border-r border-[#E4E3E0]">...</td>
                    <td className="p-1 border-r border-[#E4E3E0]">...</td>
                    <td className="p-1 border-r border-[#E4E3E0]">...</td>
                    <td className="p-1 border-r border-[#E4E3E0]">...</td>
                    <td className="p-1">...</td>
                  </tr>
                  <tr className="border-b border-[#E4E3E0]">
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center text-[#888]">12</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold bg-amber-50">col_num</td>
                    <td className="p-1 border-r border-[#E4E3E0] bg-amber-50">1936</td>
                    <td className="p-1 border-r border-[#E4E3E0]">active</td>
                    <td className="p-1 border-r border-[#E4E3E0]"></td>
                    <td className="p-1"></td>
                  </tr>
                  <tr className="border-b border-[#E4E3E0]">
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center text-[#888]">13</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold">row_num</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold">Row Count</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold">ROV Indicator</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-bold text-emerald-600">Left Column Segments</td>
                    <td className="p-1 font-bold text-emerald-600">Right Column Segments</td>
                  </tr>
                  <tr className="border-b border-[#E4E3E0]">
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center text-[#888]">14</td>
                    <td className="p-1 border-r border-[#E4E3E0]">1294</td>
                    <td className="p-1 border-r border-[#E4E3E0]">active (c1)</td>
                    <td className="p-1 border-r border-[#E4E3E0]"></td>
                    <td className="p-1 border-r border-[#E4E3E0] text-emerald-600 font-bold">dummy:20</td>
                    <td className="p-1 text-emerald-600 font-bold">dummy:20</td>
                  </tr>
                  <tr className="border-b border-[#E4E3E0]">
                    <td className="p-1 border-r border-[#141414] bg-[#F0F0F0] text-center text-[#888]">15</td>
                    <td className="p-1 border-r border-[#E4E3E0]">2</td>
                    <td className="p-1 border-r border-[#E4E3E0]">rov (rov)</td>
                    <td className="p-1 border-r border-[#E4E3E0] font-black text-red-500">ROV</td>
                    <td className="p-1 border-r border-[#E4E3E0]"></td>
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
