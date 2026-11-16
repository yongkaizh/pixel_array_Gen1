import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RowItemEditor } from './ParamsForm';
import { RowConfig, CellInfo } from '../types';

describe('RowItemEditor Validation', () => {
  const cellMap: Record<string, CellInfo> = {
    dummy: { name: 'dummy', lib: 'pix', cell: 'cell_dummy', rot: 'R0' },
    active: { name: 'active', lib: 'pix', cell: 'cell_active', rot: 'R0' },
  };

  const defaultRow: RowConfig = {
    purpose: 'active',
    rows: 10,
    segments: [],
    leftStr: '',
    rightStr: '',
  };

  it('rejects unmapped cells and does not update segments', () => {
    const handleUpdate = vi.fn();
    
    render(
      <RowItemEditor
        row={defaultRow}
        idx={0}
        cellMap={cellMap}
        totalCols={100}
        onUpdate={handleUpdate}
        onDelete={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        isFirst={true}
        isLast={true}
      />
    );

    const inputs = screen.getAllByPlaceholderText('e.g. dummy:20 or 20');
    
    // Type an invalid mapped cell
    fireEvent.change(inputs[0], { target: { value: 'idle2:20' } });

    // The component should call onUpdate with leftStr: 'idle2:20', but NOT segments
    expect(handleUpdate).toHaveBeenCalledWith({ leftStr: 'idle2:20' });
    expect(handleUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      segments: expect.anything()
    }));

    // Error message should be rendered
    expect(screen.getByText('Unmapped cell: idle2')).toBeDefined();

    handleUpdate.mockClear();

    // Now fix the error
    fireEvent.change(inputs[0], { target: { value: 'dummy:20' } });

    // It should now apply segments
    expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({
      segments: expect.arrayContaining([
        { purpose: 'dummy', cols: 20 },
        { purpose: 'active', cols: 80 }
      ])
    }));
  });
});

// Invalid drafts must remain visible and must not turn into different geometry.
describe('RowItemEditor padding limits', () => {
  it('keeps excessive padding as a draft without generating an oversized row', () => {
    const onUpdate = vi.fn();
    const cellMap = { dummy: { name: 'dummy', lib: 'lib', cell: 'dummy', rot: 'R0' }, active: { name: 'active', lib: 'lib', cell: 'active', rot: 'R0' } };
    render(<RowItemEditor row={{ purpose: 'active', rows: 2 }} idx={0} cellMap={cellMap} totalCols={10}
      onUpdate={onUpdate} onDelete={() => {}} onMoveUp={() => {}} onMoveDown={() => {}} isFirst isLast />);
    fireEvent.change(screen.getAllByPlaceholderText('e.g. dummy:20 or 20')[0], { target: { value: 'dummy:12' } });
    expect(onUpdate).toHaveBeenCalledWith({ leftStr: 'dummy:12', rightStr: '' });
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ segments: expect.anything() }));
    expect(screen.getAllByText('Padding must leave a main cell').length).toBeGreaterThan(0);
  });
});

describe('RowItemEditor invalid padding and purpose changes', () => {
  it('changes the stored main segment while preserving an incomplete padding draft', () => {
    const onUpdate = vi.fn();
    const cellMap = { dummy: { name: 'dummy', lib: 'lib', cell: 'dummy', rot: 'R0' }, active: { name: 'active', lib: 'lib', cell: 'active', rot: 'R0' }, idle: { name: 'idle', lib: 'lib', cell: 'idle', rot: 'R0' } };
    const row = { purpose: 'active', rows: 2, leftStr: 'dummy:', rightStr: '', segments: [{ purpose: 'dummy', cols: 2 }, { purpose: 'active', cols: 8 }] };
    const { container } = render(<RowItemEditor row={row} idx={0} cellMap={cellMap} totalCols={10}
      onUpdate={onUpdate} onDelete={() => {}} onMoveUp={() => {}} onMoveDown={() => {}} isFirst isLast />);
    fireEvent.change(container.querySelector('select')!, { target: { value: 'idle' } });
    expect(onUpdate).toHaveBeenCalledWith({ purpose: 'idle', segments: [{ purpose: 'dummy', cols: 2 }, { purpose: 'idle', cols: 8 }] });
  });
});
