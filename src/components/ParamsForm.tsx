import React, { useState } from 'react';
import { LayoutConfig, RowConfig, CellInfo, RowSegment } from '../types';
import { Plus, Trash, Settings, RefreshCw, Layers, CheckCircle, Edit, Info, AlertCircle, Play } from 'lucide-react';
import { parseSegmentsString, getLeftRightStringsFromSegments } from '../utils';

interface ParamsFormProps {
  config: LayoutConfig;
  onConfigChange: (config: LayoutConfig) => void;
  isModified?: boolean;
  onApplyChanges?: () => void;
  onDiscardChanges?: () => void;
}

export function ParamsForm({ config, onConfigChange, isModified, onApplyChanges, onDiscardChanges }: ParamsFormProps) {
  const [activeSubTab, setActiveSubTab] = useState<'globals' | 'rows' | 'cells'>('globals');

  // Inline state managers to replace window.prompt / confirm / alert
  const [isAddingPurpose, setIsAddingPurpose] = useState(false);
  const [newPurposeName, setNewPurposeName] = useState('');
  const [newPurposeLib, setNewPurposeLib] = useState('pixel_lib');
  const [newPurposeCell, setNewPurposeCell] = useState('');
  const [newPurposeRot, setNewPurposeRot] = useState('R0');
  const [addPurposeError, setAddPurposeError] = useState('');

  const [editingPurposeKey, setEditingPurposeKey] = useState<string | null>(null);
  const [editingPurposeName, setEditingPurposeName] = useState('');
  const [editingPurposeError, setEditingPurposeError] = useState('');

  const [confirmDeletePurposeKey, setConfirmDeletePurposeKey] = useState<string | null>(null);

  const updateGlobal = (key: keyof LayoutConfig, value: any) => {
    onConfigChange({
      ...config,
      [key]: value
    });
  };

  const handleRowChange = (index: number, keyOrObject: keyof RowConfig | Partial<RowConfig>, value?: any) => {
    const updatedRows = [...config.rows];
    if (typeof keyOrObject === 'object') {
      updatedRows[index] = {
        ...updatedRows[index],
        ...keyOrObject
      };
    } else {
      updatedRows[index] = {
        ...updatedRows[index],
        [keyOrObject]: value
      };
    }
    const updatedCellMap = { ...config.cell_map };
    updatedRows.forEach(row => {
      const p = row.purpose.toLowerCase();
      if (!updatedCellMap[p]) {
        updatedCellMap[p] = { name: row.purpose, lib: 'pixel_lib', cell: `cell_${p}`, rot: 'R0' };
      }
      if (row.segments) {
        row.segments.forEach(seg => {
          const sp = seg.purpose.toLowerCase();
          if (!updatedCellMap[sp]) {
            updatedCellMap[sp] = { name: seg.purpose, lib: 'pixel_lib', cell: `cell_${sp}`, rot: 'R0' };
          }
        });
      }
    });

    onConfigChange({
      ...config,
      rows: updatedRows,
      cell_map: updatedCellMap
    });
  };

  const addRow = () => {
    const defaultPurpose = 'dummy';
    const updatedRows = [...config.rows, { purpose: defaultPurpose, rows: 4 }];
    
    // Ensure defaultPurpose exists in cell map
    const updatedCellMap = { ...config.cell_map };
    if (!updatedCellMap[defaultPurpose]) {
      updatedCellMap[defaultPurpose] = {
        name: defaultPurpose,
        lib: 'pixel_lib',
        cell: `pixel_${defaultPurpose}`,
        rot: 'R0'
      };
    }

    onConfigChange({
      ...config,
      rows: updatedRows,
      cell_map: updatedCellMap
    });
  };

  const deleteRow = (index: number) => {
    const updatedRows = config.rows.filter((_, idx) => idx !== index);
    onConfigChange({
      ...config,
      rows: updatedRows
    });
  };

  const handleCellChange = (purposeKey: string, cellKey: keyof CellInfo, value: string) => {
    const updatedCellMap = { ...config.cell_map };
    updatedCellMap[purposeKey] = {
      ...updatedCellMap[purposeKey],
      [cellKey]: value
    };
    onConfigChange({
      ...config,
      cell_map: updatedCellMap
    });
  };

  // State driven Add
  const executeAddCellPurpose = () => {
    const cleanName = newPurposeName.trim().toLowerCase();
    if (!cleanName) {
      setAddPurposeError('Purpose name cannot be empty!');
      return;
    }
    if (config.cell_map[cleanName]) {
      setAddPurposeError('This purpose key already exists!');
      return;
    }

    const updatedCellMap = {
      ...config.cell_map,
      [cleanName]: {
        name: cleanName,
        lib: newPurposeLib.trim() || 'pixel_lib',
        cell: newPurposeCell.trim() || `pixel_${cleanName}`,
        rot: newPurposeRot
      }
    };

    onConfigChange({
      ...config,
      cell_map: updatedCellMap
    });

    setIsAddingPurpose(false);
    setNewPurposeName('');
    setNewPurposeCell('');
    setAddPurposeError('');
  };

  // State driven Rename
  const executeRenameCellPurpose = (oldKey: string) => {
    const cleanNewName = editingPurposeName.trim().toLowerCase();
    if (!cleanNewName) {
      setEditingPurposeError('Name cannot be empty!');
      return;
    }
    if (cleanNewName === oldKey) {
      setEditingPurposeKey(null);
      return;
    }
    if (config.cell_map[cleanNewName]) {
      setEditingPurposeError(`"${cleanNewName}" already exists!`);
      return;
    }

    const updatedCellMap = { ...config.cell_map };
    updatedCellMap[cleanNewName] = {
      ...updatedCellMap[oldKey],
      name: cleanNewName
    };
    delete updatedCellMap[oldKey];

    // Cascade rename to rows referencing this old key
    const updatedRows = config.rows.map(row => {
      if (row.purpose === oldKey) {
        return { ...row, purpose: cleanNewName };
      }
      return row;
    });

    // Cascade rename to rov_purpose if it matches
    let updatedRov = config.rov_purpose;
    if (config.rov_purpose === oldKey) {
      updatedRov = cleanNewName;
    }



    onConfigChange({
      ...config,
      cell_map: updatedCellMap,
      rows: updatedRows,
      rov_purpose: updatedRov,
    });

    setEditingPurposeKey(null);
    setEditingPurposeName('');
    setEditingPurposeError('');
  };

  // State driven Delete
  const executeDeleteCellPurpose = (purposeKey: string) => {
    const updatedCellMap = { ...config.cell_map };
    delete updatedCellMap[purposeKey];

    const remainingKeys = Object.keys(updatedCellMap);
    const fallbackKey = remainingKeys[0];

    // Cascade update to rows referencing this deleted key
    const updatedRows = config.rows.map(row => {
      if (row.purpose === purposeKey) {
        return { ...row, purpose: fallbackKey };
      }
      return row;
    });

    // Cascade update to rov_purpose if it matches
    let updatedRov = config.rov_purpose;
    if (config.rov_purpose === purposeKey) {
      updatedRov = fallbackKey;
    }



    onConfigChange({
      ...config,
      cell_map: updatedCellMap,
      rows: updatedRows,
      rov_purpose: updatedRov,
    });

    setConfirmDeletePurposeKey(null);
  };

  return (
    <div className="bg-glass-panel rounded-lg border border-glass-border p-6 flex flex-col gap-5 text-glass-text">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-sans font-black uppercase italic tracking-tight text-base mb-1">
            Layout Parameter Editor
          </h3>
          <p className="text-xs text-glass-text/80">
            Edit parameters, stack rows, and configure layout rotations interactively.
          </p>
        </div>
      </div>

      {/* Editor Sub Tabs */}
      <div className="flex items-center gap-1 bg-glass-bg p-1 border border-glass-border rounded-lg">
        <button
          onClick={() => setActiveSubTab('globals')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'globals'
              ? 'glass-button bg-white/10 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]'
              : 'text-glass-text/80 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Global Constants
        </button>
        <button
          onClick={() => setActiveSubTab('rows')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'rows'
              ? 'glass-button bg-white/10 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]'
              : 'text-glass-text/80 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Row Stack ({config.rows.length})
        </button>
        <button
          onClick={() => setActiveSubTab('cells')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'cells'
              ? 'glass-button bg-white/10 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]'
              : 'text-glass-text/80 hover:text-white hover:bg-white/5'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Cell Mapping ({Object.keys(config.cell_map).length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeSubTab === 'globals' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-black text-glass-text/80 uppercase tracking-widest">Top Library Name</label>
            <input
              type="text"
              value={config.top_lib}
              onChange={(e) => updateGlobal('top_lib', e.target.value)}
              className="w-full glass-input rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-black text-glass-text/80 uppercase tracking-widest">Top Cell Name</label>
            <input
              type="text"
              value={config.top_cell}
              onChange={(e) => updateGlobal('top_cell', e.target.value)}
              className="w-full glass-input rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-black text-glass-text/80 uppercase tracking-widest">X Pitch (μm)</label>
            <input
              type="number"
              step="0.01"
              value={config.x_pitch}
              onChange={(e) => updateGlobal('x_pitch', parseFloat(e.target.value) || 1.0)}
              className="w-full glass-input rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-black text-glass-text/80 uppercase tracking-widest">Y Pitch (μm)</label>
            <input
              type="number"
              step="0.01"
              value={config.y_pitch}
              onChange={(e) => updateGlobal('y_pitch', parseFloat(e.target.value) || 1.0)}
              className="w-full glass-input rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-black text-glass-text/80 uppercase tracking-widest">Total Columns (Cols)</label>
            <input
              type="number"
              value={config.total_cols}
              onChange={(e) => updateGlobal('total_cols', parseInt(e.target.value, 10) || 1)}
              className="w-full glass-input rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-black text-glass-text/80 uppercase tracking-widest">ROV Target Purpose</label>
            <select
              value={config.rov_purpose}
              onChange={(e) => updateGlobal('rov_purpose', e.target.value)}
              className="w-full glass-input rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan transition-all"
            >
              {Object.keys(config.cell_map).map((key) => (
                <option key={key} value={key}>
                  {key.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

        </div>
      )}

      {activeSubTab === 'rows' && (
        <div className="space-y-3">
          <div className="max-h-[380px] overflow-y-auto space-y-3.5 pr-1">
            {config.rows.map((row, idx) => (
              <RowItemEditor
                key={idx}
                row={row}
                idx={idx}
                cellMap={config.cell_map}
                totalCols={config.total_cols}
                onUpdate={(updatedFields) => handleRowChange(idx, updatedFields)}
                onDelete={() => deleteRow(idx)}
              />
            ))}
          </div>

          <button
            onClick={addRow}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-glass-bg/50 border border-glass-border border-dashed hover:bg-glass-bg rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-glass-text transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-glass-text" />
            Add Row Block Section
          </button>
        </div>
      )}

      {activeSubTab === 'cells' && (
        <div className="space-y-3">
          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {Object.entries(config.cell_map).map(([key, cell]) => (
              <div key={key} className="flex flex-col gap-2.5 bg-glass-bg/30 p-3 rounded-lg border border-glass-border">
                <div className="flex items-center justify-between border-b border-[#141414]/30 pb-1.5">
                  {editingPurposeKey === key ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="text"
                        value={editingPurposeName}
                        onChange={(e) => {
                          setEditingPurposeName(e.target.value);
                          setEditingPurposeError('');
                        }}
                        placeholder="new name"
                        className="glass-input px-1.5 py-0.5 text-xs font-mono w-32 rounded focus:ring-1 focus:ring-neon-cyan"
                        autoFocus
                      />
                      <button
                        onClick={() => executeRenameCellPurpose(key)}
                        className="text-xs font-mono bg-white/10 text-white hover:bg-emerald-700 px-1.5 py-0.5 font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingPurposeKey(null);
                          setEditingPurposeError('');
                        }}
                        className="text-xs font-mono text-glass-text/80 hover:text-black font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      {editingPurposeError && (
                        <span className="text-sm text-rose-600 font-bold font-mono ml-2">
                          {editingPurposeError}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-mono font-bold text-glass-text tracking-wide uppercase italic">
                        // {key} Mapping
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            setEditingPurposeKey(key);
                            setEditingPurposeName(key);
                            setEditingPurposeError('');
                          }}
                          className="text-xs font-mono text-glass-text/80 hover:text-indigo-600 font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                          title="Rename purpose class"
                        >
                          <Edit className="w-3 h-3" />
                          Rename
                        </button>
                        <span className="text-glass-text/80 select-none">|</span>
                        <button
                          onClick={() => {
                            const keys = Object.keys(config.cell_map);
                            if (keys.length <= 1) {
                              alert('Cannot delete the last remaining cell mapping!');
                              return;
                            }
                            setConfirmDeletePurposeKey(key);
                          }}
                          className="text-xs font-mono text-glass-text/80 hover:text-rose-600 font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                          title="Delete purpose class"
                        >
                          <Trash className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {confirmDeletePurposeKey === key ? (
                  <div className="flex flex-col gap-3 bg-rose-50 border border-rose-600 p-2.5">
                    <div className="text-xs text-rose-950 font-bold flex items-center gap-1.5 uppercase font-mono">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      Confirm Deletion
                    </div>
                    <p className="text-xs text-rose-900 leading-normal font-mono">
                      Are you sure you want to delete the "{key}" cell mapping? Row blocks referencing this purpose will be updated.
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setConfirmDeletePurposeKey(null)}
                        className="px-2 py-1 text-sm font-mono font-bold uppercase tracking-wider bg-glass-panel border border-glass-border/30 hover:border-black text-glass-text transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => executeDeleteCellPurpose(key)}
                        className="px-2 py-1 text-sm font-mono font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <span className="text-sm text-glass-text/90 font-black uppercase font-mono tracking-wider">Library</span>
                      <input
                        type="text"
                        value={cell.lib}
                        onChange={(e) => handleCellChange(key, 'lib', e.target.value)}
                        className="w-full bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-glass-text/90 font-black uppercase font-mono tracking-wider">Cell Name</span>
                      <input
                        type="text"
                        value={cell.cell}
                        onChange={(e) => handleCellChange(key, 'cell', e.target.value)}
                        className="w-full bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-glass-text/90 font-black uppercase font-mono tracking-wider">Rotation</span>
                      <select
                        value={cell.rot}
                        onChange={(e) => handleCellChange(key, 'rot', e.target.value)}
                        className="w-full bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
                      >
                        {['R0', 'R90', 'R180', 'R270', 'MX', 'MY', 'MXR90', 'MYR90'].map((rot) => (
                          <option key={rot} value={rot}>
                            {rot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isAddingPurpose ? (
            <div className="bg-glass-bg/50 p-4 border-2 border-dashed border-[#141414] space-y-3 rounded-lg">
              <div className="text-xs font-mono font-bold text-glass-text uppercase tracking-wider italic">
                // Create New Purpose Mapping
              </div>
              
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-sm text-glass-text/80 font-black uppercase font-mono tracking-wider">Purpose Name</span>
                  <input
                    type="text"
                    placeholder="e.g. guardring"
                    value={newPurposeName}
                    onChange={(e) => {
                      setNewPurposeName(e.target.value);
                      setAddPurposeError('');
                    }}
                    className="w-full bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-glass-text/80 font-black uppercase font-mono tracking-wider">Library</span>
                  <input
                    type="text"
                    value={newPurposeLib}
                    onChange={(e) => setNewPurposeLib(e.target.value)}
                    className="w-full bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-glass-text/80 font-black uppercase font-mono tracking-wider">Cell Name</span>
                  <input
                    type="text"
                    placeholder="pixel_guardring"
                    value={newPurposeCell}
                    onChange={(e) => setNewPurposeCell(e.target.value)}
                    className="w-full bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-glass-text/80 font-black uppercase font-mono tracking-wider">Rotation</span>
                  <select
                    value={newPurposeRot}
                    onChange={(e) => setNewPurposeRot(e.target.value)}
                    className="w-full bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
                  >
                    {['R0', 'R90', 'R180', 'R270', 'MX', 'MY', 'MXR90', 'MYR90'].map((rot) => (
                      <option key={rot} value={rot}>
                        {rot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {addPurposeError && (
                <p className="text-xs text-rose-600 font-bold font-mono">
                  Error: {addPurposeError}
                </p>
              )}

              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  onClick={() => {
                    setIsAddingPurpose(false);
                    setAddPurposeError('');
                  }}
                  className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-glass-panel border border-glass-border/30 hover:border-black text-glass-text transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeAddCellPurpose}
                  className="px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 transition cursor-pointer"
                >
                  Save Mapping
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsAddingPurpose(true);
                setNewPurposeName('');
                setNewPurposeCell('');
                setAddPurposeError('');
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-glass-bg/50 border border-glass-border border-dashed hover:bg-glass-bg rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-glass-text transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-glass-text" />
              Add Custom Purpose Class
            </button>
          )}
        </div>
      )}

      {/* Form Level Action Bar */}
      {isModified && (
        <div className="mt-4 pt-4 border-t-2 border-[#141414] flex items-center justify-between gap-4 bg-amber-50 p-4 border border-glass-border rounded-lg animate-in fade-in duration-150">
          <div className="text-sm font-mono leading-normal">
            <span className="font-bold uppercase text-amber-950 block mb-0.5">// Draft Staged</span>
            <span className="text-glass-text/80">Apply changes to regenerate layout.</span>
          </div>
          <div className="flex items-center gap-2">
            {onDiscardChanges && (
              <button
                onClick={onDiscardChanges}
                className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-glass-text/90 hover:text-rose-700 bg-glass-panel border border-glass-border/30 hover:border-rose-600 rounded-lg transition cursor-pointer"
              >
                Discard
              </button>
            )}
            {onApplyChanges && (
              <button
                onClick={onApplyChanges}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-glass-border shadow-lg rounded-lg transition active:translate-y-0.5 active:shadow-none cursor-pointer"
              >
                <Play className="w-3 h-3 fill-white" />
                Apply
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface RowItemEditorProps {
  key?: React.Key;
  row: RowConfig;
  idx: number;
  cellMap: Record<string, CellInfo>;
  totalCols: number;
  onUpdate: (updatedFields: Partial<RowConfig>) => void;
  onDelete: () => void;
}

export function RowItemEditor({ row, idx, cellMap, totalCols, onUpdate, onDelete }: RowItemEditorProps) {
  const { leftStr, rightStr } = getLeftRightStringsFromSegments(row.segments, row.purpose);
  const [leftInput, setLeftInput] = useState(leftStr);
  const [rightInput, setRightInput] = useState(rightStr);

  const handleLeftChange = (val: string) => {
    setLeftInput(val);
    applySegments(val, rightInput);
  };

  const handleRightChange = (val: string) => {
    setRightInput(val);
    applySegments(leftInput, val);
  };

  const applySegments = (leftVal: string, rightVal: string) => {
    const leftSegs = parseSegmentsString(leftVal, 'dummy');
    const rightSegs = parseSegmentsString(rightVal, 'dummy');
    
    const leftSum = leftSegs.reduce((sum, s) => sum + s.cols, 0);
    const rightSum = rightSegs.reduce((sum, s) => sum + s.cols, 0);
    
    const segments: RowSegment[] = [];
    if (leftSum > 0 || rightSum > 0) {
      leftSegs.forEach(s => segments.push(s));
      const centerCols = totalCols - leftSum - rightSum;
      if (centerCols > 0) {
        segments.push({ purpose: row.purpose.toLowerCase(), cols: centerCols });
      }
      rightSegs.forEach(s => segments.push(s));
    }

    onUpdate({
      segments: segments.length > 0 ? segments : undefined,
      leftStr: leftVal,
      rightStr: rightVal
    });
  };

  // Sync state if external changes happen (e.g., spreadsheet upload)
  React.useEffect(() => {
    const { leftStr: newLeft, rightStr: newRight } = getLeftRightStringsFromSegments(row.segments, row.purpose, row);
    setLeftInput(newLeft);
    setRightInput(newRight);
  }, [row.segments, row.purpose, row.leftStr, row.rightStr]);

  return (
    <div className="flex flex-col gap-3 bg-glass-bg/30 p-3 rounded-lg border border-glass-border group hover:border-[#141414] hover:bg-glass-bg/40 transition-all">
      <div className="flex items-center justify-between border-b border-[#141414]/10 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-glass-text/80 text-xs font-mono select-none font-bold">#{idx + 1}</span>
          <span className="text-xs font-mono font-bold text-glass-text tracking-wide uppercase italic">
            // Block Config
          </span>
        </div>
        
        <button
          onClick={onDelete}
          className="p-1 rounded-lg text-glass-text/80 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-[#141414] transition-all active:scale-95 cursor-pointer"
          title="Remove Row Block"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-glass-text/90 font-black uppercase font-mono tracking-wider">Purpose Name</span>
          <select
            value={row.purpose}
            onChange={(e) => {
              const newPurp = e.target.value;
              // Re-apply segments if purpose changes
              const leftSegs = parseSegmentsString(leftInput, 'dummy');
              const rightSegs = parseSegmentsString(rightInput, 'dummy');
              const leftSum = leftSegs.reduce((sum, s) => sum + s.cols, 0);
              const rightSum = rightSegs.reduce((sum, s) => sum + s.cols, 0);
              const segments: RowSegment[] = [];
              if (leftSum > 0 || rightSum > 0) {
                leftSegs.forEach(s => segments.push(s));
                const centerCols = totalCols - leftSum - rightSum;
                if (centerCols > 0) {
                  segments.push({ purpose: newPurp.toLowerCase(), cols: centerCols });
                }
                rightSegs.forEach(s => segments.push(s));
              }
              onUpdate({ purpose: newPurp, segments: segments.length > 0 ? segments : undefined });
            }}
            className="bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
          >
            {Object.keys(cellMap).map((key) => (
              <option key={key} value={key}>
                {key.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-glass-text/90 font-black uppercase font-mono tracking-wider">Row Count</span>
          <input
            type="number"
            value={row.rows}
            onChange={(e) => onUpdate({ rows: parseInt(e.target.value, 10) || 1 })}
            className="bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-xs font-mono text-glass-text focus:outline-none transition"
          />
        </div>
      </div>

      {/* Advanced Row Segments (Mixed Cells) Editing */}
      <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-[#141414]/10">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-glass-text/80 font-black uppercase font-mono tracking-wider">
            Left Padding (segs)
          </span>
          <input
            type="text"
            value={leftInput}
            onChange={(e) => handleLeftChange(e.target.value)}
            placeholder="e.g. dummy:20 or 20"
            className="bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-sm font-mono text-glass-text focus:outline-none transition"
            title="Specify columns on the left. Format: purpose:cols or count (e.g. dummy:20 or simply 20)"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-glass-text/80 font-black uppercase font-mono tracking-wider">
            Right Padding (segs)
          </span>
          <input
            type="text"
            value={rightInput}
            onChange={(e) => handleRightChange(e.target.value)}
            placeholder="e.g. dummy:20 or 20"
            className="bg-glass-panel border border-glass-border rounded-lg px-2.5 py-1 text-sm font-mono text-glass-text focus:outline-none transition"
            title="Specify columns on the right. Format: purpose:cols or count (e.g. dummy:20 or simply 20)"
          />
        </div>
      </div>
      
      {row.segments && row.segments.length > 0 && (
        <div className="bg-white/10 text-white/90 p-1.5 font-mono text-sm rounded-lg flex flex-wrap items-center gap-1 border border-glass-border">
          <span className="text-emerald-400 font-bold">SEGMENTS:</span>
          {row.segments.map((seg, sIdx) => (
            <span key={sIdx} className="bg-zinc-800 px-1 py-0.5 border border-zinc-700">
              {seg.purpose}:{seg.cols}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

