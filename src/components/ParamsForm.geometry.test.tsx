import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ParamsForm } from './ParamsForm';
import { getDefaultLayoutConfig } from '../config/defaults';

describe('layout parameter drafts', () => {
  it('retains zero and blank pitches for validation instead of replacing them with 1', () => {
    const onConfigChange = vi.fn();
    const { container } = render(<ParamsForm config={getDefaultLayoutConfig()} onConfigChange={onConfigChange} />);
    const input = container.querySelectorAll('input[type="number"]')[0];
    fireEvent.change(input, { target: { value: '0' } });
    expect(onConfigChange.mock.lastCall[0].x_pitch).toBe(0);
    fireEvent.change(input, { target: { value: '' } });
    expect(onConfigChange.mock.lastCall[0].x_pitch).toBeNaN();
  });
  it('reflows the main segment when the total column count changes', () => {
    const base = getDefaultLayoutConfig();
    const config = { ...base, total_cols: 10, rows: [{ purpose: 'core', rows: 2, segments: [
      { purpose: 'dummy', cols: 1 }, { purpose: 'core', cols: 7 }, { purpose: 'dummy', cols: 2 },
    ] }] };
    const onConfigChange = vi.fn();
    const { container } = render(<ParamsForm config={config} onConfigChange={onConfigChange} />);
    fireEvent.change(container.querySelectorAll('input[type="number"]')[2], { target: { value: '20' } });
    expect(onConfigChange.mock.lastCall[0].rows[0].segments.map((s: any) => s.cols)).toEqual([1, 17, 2]);
  });
});
