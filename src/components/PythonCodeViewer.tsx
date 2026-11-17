import React, { useMemo } from 'react';
import { generatePythonCode } from '../utils';
import { Code } from 'lucide-react';
import { CodeReader } from './CodeReader';

export const PythonCodeViewer = React.memo(function PythonCodeViewer() {
  const correctedCode = generatePythonCode(true);
  const highlightedCode = useMemo(() => highlightPythonCode(correctedCode), [correctedCode]);
  return (
    <section className="min-w-0 bg-glass-panel rounded-xl border border-glass-border p-4 sm:p-6 flex flex-col gap-4 text-glass-text">
      <div>
        <h3 className="font-sans font-bold text-base mb-1 flex items-center gap-2">
          <Code className="w-4 h-4 shrink-0" /> Python automation script
        </h3>
        <p className="text-sm text-glass-muted">Convert your Excel specification to SKILL locally or on a server.</p>
      </div>
      <details className="rounded-lg border border-glass-border bg-glass-bg px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium focus-visible:outline-sky-500">How to run the Python generator</summary>
        <div className="mt-3 space-y-2 text-glass-muted leading-relaxed">
          <p>Install the dependencies: <code className="text-glass-text">pip install pandas openpyxl</code>.</p>
          <p>Save your workbook as <code className="text-glass-text">array_pixel.xlsx</code> beside the downloaded script, then run{' '}
            <code className="break-all text-glass-text">python3 pixel_array_generator.py</code>.</p>
          <p>The generator writes <code className="text-glass-text">pixel_array.il</code> using the workbook’s settings.</p>
        </div>
      </details>
      <CodeReader code={correctedCode} filename="pixel_array_generator.py" language="Python">{highlightedCode}</CodeReader>
    </section>
  );
});

// Minimalist client-side Python syntax helper to colorize key keywords, comments, and strings
function highlightPythonCode(code: string) {
  const lines = code.split('\n');
  return lines.map((line, idx) => {
    // Process line colors

    // Check if full line is a comment
    if (line.trim().startsWith('#')) {
      return (
        <div key={idx} className="code-line">
          <span className="code-line-number">{idx + 1}</span>
          <span className="code-line-text text-slate-400 italic">{line}</span>
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
