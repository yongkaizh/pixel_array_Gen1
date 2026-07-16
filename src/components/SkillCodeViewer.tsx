import React, { useState, useMemo } from 'react';
import { generateSkillCode } from '../utils';
import { LayoutConfig } from '../types';
import { Copy, Check, FileDown, Terminal, Database } from 'lucide-react';

interface SkillCodeViewerProps {
  config: LayoutConfig;
}

export const SkillCodeViewer = React.memo(function SkillCodeViewer({ config }: SkillCodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const skillCode = useMemo(() => generateSkillCode(config), [config]);
  const highlightedCode = useMemo(() => highlightSkillCode(skillCode), [skillCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(skillCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([skillCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixel_array.il';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-none border-2 border-[#141414] p-6 flex flex-col gap-5 text-[#141414]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-sans font-black uppercase italic tracking-tight text-base mb-1 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#141414]" />
            Generated Cadence SKILL Script
          </h3>
          <p className="text-xs text-[#141414]/85">
            Copy or download this file directly into your Cadence Virtuoso working directory to run.
          </p>
        </div>
      </div>

      <div className="bg-[#E4E3E0] rounded-none p-3.5 border border-[#141414] text-xs text-[#141414] flex items-start gap-2.5">
        <Terminal className="w-4 h-4 text-[#141414]/60 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-mono font-bold uppercase text-[11px] tracking-wide text-[#141414]">Execution in Cadence Virtuoso:</span>
          <p className="leading-relaxed text-[11px]">
            1. Save as <code className="font-mono bg-[#141414] px-1 py-0.5 text-white font-bold">pixel_array.il</code> inside Virtuoso's working directory.<br />
            2. In the CIW console, load the compiled layout view: <code className="font-mono bg-[#141414] px-1 py-0.5 text-white font-bold">load("pixel_array.il")</code>.<br />
            3. The layout cellview is automatically compiled, centered, and written.
          </p>
        </div>
      </div>

      {/* Editor Frame */}
      <div className="relative rounded-none border-2 border-[#141414] bg-[#141414] overflow-hidden">
        {/* Editor Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#141414] bg-[#E4E3E0] text-[#141414]">
          <div className="text-[10px] text-[#141414] font-mono uppercase tracking-wider font-bold">
            pixel_array.il
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-none text-[#141414] hover:bg-white border border-transparent hover:border-[#141414] cursor-pointer transition active:scale-95"
              title="Copy SKILL Script"
            >
              {copied ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-none text-[#141414] hover:bg-white border border-transparent hover:border-[#141414] cursor-pointer transition active:scale-95"
              title="Download Script File"
            >
              <FileDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Script code with manual SKILL-like highlight */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto bg-[#141414]">
          <div className="p-5 font-mono text-[11px] leading-relaxed text-slate-300 min-w-max">
            {highlightedCode}
          </div>
        </div>
      </div>
    </div>
  );
});

// Custom syntax highlighting for Cadence SKILL (.il)
function highlightSkillCode(code: string) {
  const lines = code.split('\n');
  return lines.map((line, idx) => {
    // Handle comments separately for performance
    if (line.trim().startsWith(';')) {
      return (
        <div key={idx} className="flex hover:bg-slate-900/40 transition-colors group">
          <span className="inline-block text-right pr-4 text-slate-650 select-none w-12 shrink-0 border-r border-slate-800 mr-4 opacity-50 group-hover:opacity-100">{idx + 1}</span>
          <span className="text-slate-500 italic whitespace-pre">{line}</span>
        </div>
      );
    }

    // Split line by trailing comments
    const parts = line.split(/(;.*$)/);
    const mainCode = parts[0];
    const trailingComment = parts[1];

    const keywords = [
      'procedure', 'let', 'when', 'error', 'foreach', 'cons', 'car', 'errset', 'list', 'nil', 'return', 'if', 'else', 'case', 'for', 'while'
    ];
    const databaseFunctions = [
      'dbOpenCellViewByType', 'dbCreateSimpleMosaic', 'dbMoveFig', 'dbSave', 'dbClose', 'centerBox', 'geGetEditCellView', 'dbCreateInst', 'dbCreateRect'
    ];

    const tokens = mainCode.split(/(\s+|=|\(|\)|,|:|\.|\[|\]|\{|\})/);
    const styledCode: React.ReactNode[] = [];

    tokens.forEach((token, tIdx) => {
      if (keywords.includes(token)) {
        styledCode.push(<span key={tIdx} className="text-violet-400 font-semibold">{token}</span>);
      } else if (databaseFunctions.includes(token)) {
        styledCode.push(<span key={tIdx} className="text-sky-400 font-medium">{token}</span>);
      } else if (token.startsWith('"') || token.startsWith("'")) {
        styledCode.push(<span key={tIdx} className="text-emerald-400">{token}</span>);
      } else if (!isNaN(Number(token)) && token.trim() !== '') {
        styledCode.push(<span key={tIdx} className="text-amber-400">{token}</span>);
      } else if (['currentY', 'rovInst', 'allInsts', 'inst', 'master', 'cv', 'xPitch', 'yPitch', 'totalCols'].includes(token)) {
        styledCode.push(<span key={tIdx} className="text-indigo-300 font-medium">{token}</span>);
      } else {
        styledCode.push(<span key={tIdx}>{token}</span>);
      }
    });

    return (
      <div key={idx} className="flex hover:bg-slate-900/40 transition-colors group">
        <span className="inline-block text-right pr-4 text-slate-600 select-none w-12 shrink-0 border-r border-slate-800 mr-4 opacity-50 group-hover:opacity-100">{idx + 1}</span>
        <span className="whitespace-pre">
          {styledCode}
          {trailingComment && <span className="text-slate-500 italic">{trailingComment}</span>}
        </span>
      </div>
    );
  });
}
