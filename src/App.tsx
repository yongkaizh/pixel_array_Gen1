/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutConfig } from './types';
import { getDefaultLayoutConfig } from './config/defaults';
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
    <div className="min-h-screen bg-transparent text-glass-text flex flex-col antialiased font-sans relative z-0">
      {/* Visual Navigation Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel sticky top-0 z-30 border-b-0 border-x-0 border-t-0 bg-white/40"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center font-mono font-bold text-sm text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              I.S.
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-sans font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tighter text-lg uppercase">
                  Integrated Silicon Array Builder
                </h1>
                <span className="text-xs font-mono font-bold bg-black/5 text-neon-cyan px-2 py-0.5 rounded-full uppercase tracking-wider border border-neon-cyan/30">
                  Layout Engine
                </span>
              </div>
              <p className="text-xs text-glass-muted font-mono uppercase tracking-wide">
                Integrated Silicon Layout Script &amp; Automation Compiler
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-[11px]">
                <span className="bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded border border-slate-300 font-bold">
                  ROWS: {activeConfig.rows.reduce((sum, r) => sum + r.rows, 0)}
                </span>
                <span className="bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded border border-slate-300 font-bold">
                  COLS: {activeConfig.total_cols}
                </span>
                <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded border border-sky-300 font-bold">
                  PITCH: {activeConfig.x_pitch} &times; {activeConfig.y_pitch} μm
                </span>
                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-300 font-bold">
                  CENTER: {activeConfig.center_layer || 'BDTID'} {activeConfig.center_purpose || 'drawing'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {isModified && (
              <span className="text-neon-rose font-bold animate-pulse text-xs bg-neon-rose/10 border border-neon-rose/30 px-3 py-1 rounded-full uppercase tracking-wider">
                UNAPPLIED DRAFT EDITS
              </span>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowTour(true)}
              className="flex items-center gap-1.5 glass-button text-glass-text px-4 py-1.5 rounded-full text-xs uppercase font-bold tracking-widest cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Tour & Guide
            </motion.button>
            <span className="text-glass-muted">STATUS:</span>
            <span className="font-bold bg-neon-emerald/10 text-neon-emerald border border-neon-emerald/30 px-3 py-1 rounded-full tracking-widest text-xs shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              READY
            </span>
          </div>
        </div>
      </motion.header>

      {/* Main Container */}
      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 relative z-10"
      >
        
        {/* Global Apply/Discard Floating Staging Banner when modified */}
        <AnimatePresence>
          {isModified && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="sticky top-24 z-40 p-5 glass-panel border border-neon-rose/30 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl shadow-[0_12px_40px_rgba(244,63,94,0.2)] overflow-hidden bg-white/80 backdrop-blur-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-neon-rose/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-neon-rose/20 text-neon-rose rounded-lg shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-mono font-black uppercase text-sm text-slate-800 tracking-wider">
                    DRAFT STAGE ACTIVE // CHANGES DETECTED
                  </h4>
                  <p className="text-sm text-glass-muted font-sans mt-1">
                    You have modified layout parameters. Click the button on the right to compile and render your edits on the CAD viewport and Cadence SKILL script!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end relative z-10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDiscardChanges}
                  className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest text-glass-muted hover:text-slate-900 glass-button rounded-lg cursor-pointer"
                >
                  Discard Draft
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApplyChanges}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-widest text-white bg-gradient-to-r from-neon-purple to-neon-cyan hover:opacity-90 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] transition-all cursor-pointer border border-white/20"
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  Apply &amp; Compile Draft
                </motion.button>
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
              className={`p-4 glass-panel flex items-start justify-between gap-4 rounded-xl shadow-lg relative overflow-hidden ${
                status.type === 'success' 
                  ? 'border border-neon-emerald/30 shadow-[0_4px_20px_rgba(16,185,129,0.1)]' 
                  : 'border border-neon-rose/30 shadow-[0_4px_20px_rgba(244,63,94,0.1)]'
              }`}
            >
              <div className="flex items-start gap-3 flex-1 relative z-10">
                {status.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-neon-emerald shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-neon-rose shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                )}
                <div className="text-sm font-mono">
                  <span className="font-bold uppercase block mb-1 text-slate-800 tracking-wider">
                    {status.type === 'success' ? 'SYSTEM OK // COMPILE SUCCESS' : 'SYSTEM CRITICAL // EXCEPTION'}
                  </span>
                  <span className="text-glass-muted leading-relaxed">{status.message}</span>
                </div>
              </div>

              {/* Clear button */}
              <button
                onClick={() => setStatus({ type: 'idle', message: '' })}
                className="text-glass-muted hover:text-slate-900 hover:bg-black/5 p-2 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center justify-center relative z-10"
                title="Dismiss notification"
              >
                <X className="w-4 h-4" />
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
      </motion.main>

      <footer className="glass-panel border-b-0 border-x-0 border-t border-glass-border py-6 px-6 text-center text-xs uppercase tracking-widest mt-auto bg-white/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-glass-muted font-mono">Session: X782-99 // Memory: 24.1 MB</span>
          <span className="flex items-center gap-2 font-mono text-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-neon-emerald shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse inline-block"></span>
            SYSTEM OK &bull; Copyright © {new Date().getFullYear()} Yongkai Zhang
          </span>
        </div>
      </footer>
      <TourModal isOpen={showTour} onClose={() => setShowTour(false)} />
    </div>
  );
}


