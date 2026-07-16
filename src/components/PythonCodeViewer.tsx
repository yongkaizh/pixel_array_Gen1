import React, { useState } from 'react';
import { generatePythonCode } from '../utils';
import { Copy, Check, FileDown, CheckCircle } from 'lucide-react';

export const PythonCodeViewer = React.memo(function PythonCodeViewer() {
  const [copied, setCopied] = useState(false);

  // Generate only the correct, working Python script
  const correctedCode = generatePythonCode(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(correctedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([correctedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixel_array_generator.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-none border-2 border-[#141414] p-6 flex flex-col gap-4 text-[#141414]">
      <div>
        <h3 className="font-sans font-black uppercase italic tracking-tight text-base mb-1">
          Python Integration Automation Script
        </h3>
        <p className="text-xs text-[#141414]/80">
          Automates the conversion of layout spreadsheet configurations to Cadence SKILL layout files.
        </p>
      </div>

      <div className="bg-emerald-50 rounded-none border border-[#141414] p-4 text-[#141414] text-xs leading-relaxed">
        <span className="font-bold flex items-center gap-1.5 text-emerald-950 uppercase tracking-wider mb-1 font-mono text-[10px]">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
          Production-Ready Compiler Script
        </span>
        Use this script to automatically parse layout templates and export Cadence SKILL scripts directly on your local system or servers. It supports custom pixel dimensions, custom pitch/row configurations, and heterogeneous row block segments.
      </div>

      {/* Code Display Sandbox */}
      <div className="relative rounded-none border-2 border-[#141414] bg-[#141414] overflow-hidden">
        {/* Code Actions Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#141414] bg-[#E4E3E0] text-[#141414]">
          <div className="text-[10px] text-[#141414] font-mono uppercase tracking-wider font-bold">
            pixel_array_generator.py
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-none text-[#141414] hover:bg-white border border-transparent hover:border-[#141414] cursor-pointer transition active:scale-95 flex items-center gap-1"
              title="Copy to Clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[9px] font-bold font-mono">COPY</span>
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-none text-[#141414] hover:bg-white border border-transparent hover:border-[#141414] cursor-pointer transition active:scale-95 flex items-center gap-1"
              title="Download Script File"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="text-[9px] font-bold font-mono">DOWNLOAD</span>
            </button>
          </div>
        </div>

        {/* Highlighted Editor Body */}
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <pre className="p-5 font-mono text-[11px] leading-relaxed text-slate-300">
            <code>
              {highlightPythonCode(correctedCode)}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
});

// Minimalist client-side Python syntax helper to colorize key keywords, comments, and strings
function highlightPythonCode(code: string) {
  const lines = code.split('\n');
  return lines.map((line, idx) => {
    // Process line colors
    let content: React.ReactNode = line;

    // Check if full line is a comment
    if (line.trim().startsWith('#')) {
      return (
        <div key={idx} className="table-row">
          <span className="table-cell text-right pr-4 text-slate-650 select-none w-10 text-[9px] border-r border-slate-900/80 pr-2 mr-3">{idx + 1}</span>
          <span className="text-slate-500 italic pl-3">{line}</span>
        </div>
      );
    }

    // Basic regex styling for UI polish
    // Match string literals
    // Note: We represent text visually. To keep it robust, let's style comments, standard python keywords, and imports.
    const parts = line.split(/(#.*$)/); // Split at trailing comment if any
    const mainCode = parts[0];
    const trailingComment = parts[1];

    // Simple keyword coloring
    const keywords = ['def', 'import', 'from', 'as', 'try', 'except', 'while', 'for', 'in', 'if', 'else', 'elif', 'break', 'continue', 'raise', 'return', 'with', 'print', 'main'];
    const styledCode: React.ReactNode[] = [];
    
    // Split code by spaces/punctuation to color keywords (approximate)
    const tokens = mainCode.split(/(\s+|=|\(|\)|,|:|\.|\[|\]|\{|\})/);
    
    tokens.forEach((token, tIdx) => {
      if (keywords.includes(token)) {
        styledCode.push(<span key={tIdx} className="text-indigo-400 font-semibold">{token}</span>);
      } else if (token.startsWith('"') || token.startsWith("'")) {
        styledCode.push(<span key={tIdx} className="text-emerald-400">{token}</span>);
      } else if (!isNaN(Number(token)) && token.trim() !== '') {
        styledCode.push(<span key={tIdx} className="text-amber-400">{token}</span>);
      } else if (token === 'RuntimeError' || token === 'Exception') {
        styledCode.push(<span key={tIdx} className="text-rose-400 font-medium">{token}</span>);
      } else if (token === 'total_cols' || token === 'rov_purpose' || token === 'rows' || token === 'skill') {
        styledCode.push(<span key={tIdx} className="text-sky-300 font-medium">{token}</span>);
      } else {
        styledCode.push(<span key={tIdx}>{token}</span>);
      }
    });

    return (
      <div key={idx} className="table-row hover:bg-slate-900/40">
        <span className="table-cell text-right pr-4 text-slate-600 select-none w-10 text-[9px] border-r border-slate-900/80 pr-2 mr-3">{idx + 1}</span>
        <span className="pl-3">
          {styledCode}
          {trailingComment && <span className="text-slate-500 italic">{trailingComment}</span>}
        </span>
      </div>
    );
  });
}
