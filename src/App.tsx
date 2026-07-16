/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutConfig } from './types';
import { getDefaultLayoutConfig } from './utils';
import { CadViewer } from './components/CadViewer';
import { ExcelManager } from './components/ExcelManager';
import { ParamsForm } from './components/ParamsForm';
import { SkillCodeViewer } from './components/SkillCodeViewer';
import { PythonCodeViewer } from './components/PythonCodeViewer';
import { TourModal } from './components/TourModal';
import { Cpu, CheckCircle, AlertCircle, Sparkles, Code, HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeConfig, setActiveConfig] = useState<LayoutConfig>(getDefaultLayoutConfig());
  const [draftConfig, setDraftConfig] = useState<LayoutConfig>(getDefaultLayoutConfig());
  const [showTour, setShowTour] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({
    type: 'success',
    message: 'Silicon Array Generator loaded. Adjust parameters in the editor or upload an Excel spreadsheet.'
  });

  const isModified = JSON.stringify(draftConfig) !== JSON.stringify(activeConfig);

  const handleApplyChanges = () => {
    setActiveConfig(draftConfig);
    setStatus({
      type: 'success',
      message: 'Layout parameters applied successfully! Rendered CAD layout and Cadence SKILL code are now fully compiled and synchronized.'
    });
  };

  const handleApplyExcelConfig = (newConfig: LayoutConfig) => {
    setDraftConfig(newConfig);
    setActiveConfig(newConfig);
    setStatus({
      type: 'success',
      message: 'Excel spreadsheet layout specs parsed, compiled, and applied successfully!'
    });
  };

  const handleDiscardChanges = () => {
    setDraftConfig(activeConfig);
    setStatus({
      type: 'success',
      message: 'Draft changes discarded. Editor reset to current active layout config.'
    });
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col antialiased font-sans">
      {/* Visual Navigation Header */}
      <header className="border-b-2 border-[#141414] bg-white px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#141414] flex items-center justify-center font-mono font-bold text-xs text-[#E4E3E0]">
              I.S.
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-sans font-black text-[#141414] tracking-tighter text-lg uppercase italic">
                  Integrated Silicon Array Builder
                </h1>
                <span className="text-[10px] font-mono font-bold bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5 uppercase tracking-wider">
                  Layout Engine
                </span>
              </div>
              <p className="text-[11px] text-[#141414]/75 font-mono uppercase tracking-wide">
                Integrated Silicon Layout Script &amp; Automation Compiler
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {isModified && (
              <span className="text-amber-600 font-bold animate-pulse text-[10px] bg-amber-50 border border-amber-600 px-2 py-0.5 uppercase tracking-wider">
                UNAPPLIED DRAFT EDITS
              </span>
            )}
            <button
              onClick={() => setShowTour(true)}
              className="flex items-center gap-1.5 bg-[#141414] text-[#E4E3E0] px-3 py-1 text-[10px] uppercase font-bold tracking-widest hover:bg-rose-600 hover:text-white transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Tour & Guide
            </button>
            <span className="text-[#141414]/50">STATUS:</span>
            <span className="font-bold bg-[#141414] text-[#E4E3E0] px-2 py-0.5 tracking-widest text-[10px]">
              READY
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Global Apply/Discard Floating Staging Banner when modified */}
        <AnimatePresence>
          {isModified && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-5 bg-amber-50 border-4 border-amber-600 text-[#141414] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(217,119,6,1)] rounded-none"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-600 text-white rounded-none">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-mono font-black uppercase text-xs text-amber-950 tracking-wider">
                    DRAFT STAGE ACTIVE // CHANGES DETECTED
                  </h4>
                  <p className="text-xs text-amber-900 font-sans mt-0.5">
                    You have modified layout parameters. Click the button on the right to compile and render your edits on the CAD viewport and Cadence SKILL script!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                <button
                  onClick={handleDiscardChanges}
                  className="px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-widest text-amber-900 hover:text-rose-700 bg-white border-2 border-amber-600 hover:border-rose-600 rounded-none transition cursor-pointer"
                >
                  Discard Draft
                </button>
                <button
                  onClick={handleApplyChanges}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 border-2 border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none rounded-none transition cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply &amp; Compile Draft
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Parsing Status Notification banner */}
        <AnimatePresence>
          {status.type !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`p-4 border-2 border-[#141414] flex items-start justify-between gap-4 shadow-sm relative overflow-hidden ${
                status.type === 'success' 
                  ? 'bg-emerald-50/90 text-emerald-950 border-[#141414]' 
                  : 'bg-rose-50/90 text-rose-950 border-rose-600'
              }`}
            >
              <div className="flex items-start gap-3 flex-1">
                {status.type === 'success' ? (
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4.5 h-4.5 text-rose-700 shrink-0 mt-0.5" />
                )}
                <div className="text-xs font-mono">
                  <span className="font-bold uppercase block mb-1">
                    {status.type === 'success' ? 'SYSTEM OK // COMPILE SUCCESS' : 'SYSTEM CRITICAL // EXCEPTION'}
                  </span>
                  <span className="opacity-95 leading-relaxed">{status.message}</span>
                </div>
              </div>

              {/* Clear button */}
              <button
                onClick={() => setStatus({ type: 'idle', message: '' })}
                className="text-[#141414]/65 hover:text-[#141414] hover:bg-[#141414]/10 p-1.5 border border-transparent hover:border-[#141414]/20 transition shrink-0 cursor-pointer flex items-center justify-center"
                title="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Stack */}
        <div className="flex flex-col gap-6">
          
          {/* Interactive Layout Render stage */}
          <CadViewer config={activeConfig} />

          {/* Editable config form */}
          <ParamsForm 
            config={draftConfig} 
            onConfigChange={setDraftConfig} 
            isModified={isModified}
            onApplyChanges={handleApplyChanges}
            onDiscardChanges={handleDiscardChanges}
          />

          {/* Drag drop Excel manager */}
          <ExcelManager 
            config={draftConfig} 
            onConfigChange={setDraftConfig} 
            onApplyConfig={handleApplyExcelConfig}
            onSetStatus={setStatus} 
          />

          {/* Bug tracker & Python explanation */}
          <PythonCodeViewer />

          {/* Compiled Cadence SKILL file display */}
          <SkillCodeViewer config={activeConfig} />

        </div>
      </main>

      {/* Humble aesthetic footer */}
      <footer className="border-t-2 border-[#141414] bg-[#141414] text-[#E4E3E0] py-4 px-6 text-center text-[10px] uppercase tracking-widest">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Session: X782-99 // Memory: 24.1 MB</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
            SYSTEM OK &bull; Copyright © {new Date().getFullYear()} Yongkai Zhang
          </span>
        </div>
      </footer>
      <TourModal isOpen={showTour} onClose={() => setShowTour(false)} />
    </div>
  );
}


