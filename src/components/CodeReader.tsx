import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, FileDown, Minus, Plus, WrapText } from 'lucide-react';

interface CodeReaderProps {
  code: string;
  filename: string;
  language: string;
  children: React.ReactNode;
}

/** Shared reading controls; copy and download always use the original source. */
export function CodeReader({ code, filename, language, children }: CodeReaderProps) {
  const [wrap, setWrap] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const handleCopy = async () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
      copyTimer.current = setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="code-reader w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-200 shadow-sm" data-wrap={wrap}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-semibold" title={filename}>{filename}</div>
          <div className="mt-0.5 text-xs text-slate-400">{language} · {code.split('\n').length.toLocaleString()} lines</div>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${language} reader controls`}>
          <button type="button" className="code-reader-button" onClick={() => setFontSize(size => Math.max(12, size - 1))} disabled={fontSize === 12} aria-label="Decrease code font size" title="Smaller text">
            <Minus size={15} />
          </button>
          <span className="w-10 text-center font-mono text-xs tabular-nums text-slate-300" aria-live="polite">{fontSize}px</span>
          <button type="button" className="code-reader-button" onClick={() => setFontSize(size => Math.min(20, size + 1))} disabled={fontSize === 20} aria-label="Increase code font size" title="Larger text">
            <Plus size={15} />
          </button>
          <button type="button" className="code-reader-button" onClick={() => setWrap(value => !value)} aria-pressed={wrap} title="Toggle line wrapping">
            <WrapText size={15} /><span>Wrap</span>
          </button>
          <button type="button" className="code-reader-button" onClick={handleCopy} disabled={copyState === 'copying'} aria-label={`Copy ${language} code`}>
            {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}<span>{copyState === 'copied' ? 'Copied' : 'Copy'}</span>
          </button>
          <button type="button" className="code-reader-button" onClick={handleDownload} aria-label={`Download ${filename}`}>
            <FileDown size={15} /><span>Download</span>
          </button>
        </div>
      </div>
      <div className="code-reader-scroll flex-1 min-h-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400" role="region" aria-label={`${language} source code`} tabIndex={0}>
        <div className="code-reader-lines py-4 font-mono text-slate-200" style={{ fontSize, lineHeight: 1.7 }}>{children}</div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-t border-slate-800 bg-slate-900 pl-4 pr-7 py-2 text-xs text-slate-400">
        <span role="status" className={copyState === 'failed' ? 'text-rose-300' : undefined}>
          {copyState === 'failed' ? 'Copy failed. Select the code or download the file.' : copyState === 'copied' ? 'Source copied to clipboard.' : 'Select text to read or copy. Downloads preserve the original source.'}
        </span>
        <span>Drag the bottom-right corner to resize.</span>
      </div>
    </div>
  );
}
