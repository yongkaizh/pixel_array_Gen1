import React, { useMemo } from 'react';
import { generateSkillCode } from '../utils';
import { LayoutConfig } from '../types';
import { Database, Terminal } from 'lucide-react';
import { CodeReader } from './CodeReader';

interface SkillCodeViewerProps {
  config: LayoutConfig;
}

export const SkillCodeViewer = React.memo(function SkillCodeViewer({ config }: SkillCodeViewerProps) {
  const skillCode = useMemo(() => generateSkillCode(config), [config]);
  const highlightedCode = useMemo(() => highlightSkillCode(skillCode), [skillCode]);
  return (
    <section className="min-w-0 bg-glass-panel rounded-xl border border-glass-border p-4 sm:p-6 flex flex-col gap-4 text-glass-text">
      <div>
        <h3 className="font-sans font-bold text-base mb-1 flex items-center gap-2">
          <Database className="w-4 h-4 shrink-0" /> Cadence SKILL script
        </h3>
        <p className="text-sm text-glass-muted">Generated from your applied layout. Ready to copy or download.</p>
      </div>
      <details className="rounded-lg border border-glass-border bg-glass-bg px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium focus-visible:outline-sky-500">
          <Terminal className="inline-block w-4 h-4 mr-2" />How to run in Virtuoso
        </summary>
        <p className="mt-3 leading-relaxed text-glass-muted">
          Save <code className="text-glass-text">pixel_array.il</code> in Virtuoso’s working directory, then run{' '}
          <code className="break-all text-glass-text">load("pixel_array.il")</code> in the CIW.
          The script creates, centers, and saves the layout.
        </p>
      </details>
      <CodeReader code={skillCode} filename="pixel_array.il" language="SKILL">{highlightedCode}</CodeReader>
    </section>
  );
});

// Custom syntax highlighting for Cadence SKILL (.il)
function highlightSkillCode(code: string) {
  const lines = code.split('\n');
  return lines.map((line, idx) => {
    // Handle comments separately for performance
    if (line.trim().startsWith(';')) {
      return (
        <div key={idx} className="code-line">
          <span className="code-line-number">{idx + 1}</span>
          <span className="code-line-text text-slate-400 italic">{line}</span>
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
      <div key={idx} className="code-line">
        <span className="code-line-number">{idx + 1}</span>
        <span className="code-line-text">
          {styledCode}
          {trailingComment && <span className="text-slate-400 italic">{trailingComment}</span>}
        </span>
      </div>
    );
  });
}
