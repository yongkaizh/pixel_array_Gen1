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
