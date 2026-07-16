import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, Database, Edit3, Code, FileDown } from 'lucide-react';

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TourModal({ isOpen, onClose }: TourModalProps) {
  const steps = [
    {
      icon: <Database className="w-6 h-6 text-blue-600" />,
      title: "1. Upload Specifications",
      description: "Use the Excel Manager to upload your .xlsx file containing 'pix_tbl' (cell mapping) and 'format_template' (array dimensions) sheets. You can also download our template as a starting point."
    },
    {
      icon: <Edit3 className="w-6 h-6 text-emerald-600" />,
      title: "2. Adjust Parameters",
      description: "Review and manually tweak layout parameters (like pitches, row counts, and library names) directly in the web-based Layout Parameter Editor. Click 'Apply Changes' to rebuild the visualization."
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-purple-600" />,
      title: "3. Interactive Visualization",
      description: "The 2D Layout CAD Viewer provides a scaled visual preview of your pixel array. You can zoom, pan, and hover over segments to inspect their properties before exporting."
    },
    {
      icon: <Code className="w-6 h-6 text-amber-600" />,
      title: "4. Generate SKILL Code",
      description: "Once the layout is verified, jump to the SKILL Code Generator tab. The system automatically compiles the precise Cadence SKILL (dbCreateMosaic) syntax needed for your layout."
    },
    {
      icon: <FileDown className="w-6 h-6 text-rose-600" />,
      title: "5. Export Artifacts",
      description: "Download the fully generated .il SKILL script, standalone Python parsers, or high-resolution PNG/SVG captures of your layout directly to your machine."
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#141414]/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-4 border-[#141414] bg-white p-4 sticky top-0 z-10">
              <h2 className="text-xl font-black uppercase tracking-tighter italic">Interactive Tour & Guide</h2>
              <button
                onClick={onClose}
                className="bg-[#141414] text-white p-1 hover:bg-rose-600 transition-colors"
                aria-label="Close Tour"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 space-y-6">
              <p className="font-mono text-sm leading-relaxed border-l-4 border-rose-600 pl-4">
                Welcome to the Silicon Array Builder. This tool transforms abstract spreadsheet data into executable Cadence SKILL layouts. Here is how to use it:
              </p>
              
              <div className="grid gap-4">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-4 p-4 border-2 border-[#141414] bg-white hover:bg-gray-50 transition-colors">
                    <div className="shrink-0 flex items-center justify-center w-12 h-12 border-2 border-[#141414] rounded-full bg-gray-100">
                      {step.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                      <p className="text-sm font-mono text-gray-700 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  onClick={onClose}
                  className="bg-[#141414] text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-blue-600 transition-colors border-2 border-transparent"
                >
                  Get Started
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
