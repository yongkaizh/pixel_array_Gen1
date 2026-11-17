import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CodeReader } from './CodeReader';

const source = '  original_code();\n\n"Quoted text"';
function renderReader() {
  return render(<CodeReader code={source} filename="example.il" language="SKILL"><div>Highlighted display</div></CodeReader>);
}

describe('CodeReader clipboard feedback', () => {
  it('copies the original source and waits for clipboard success', async () => {
    let resolveCopy!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { resolveCopy = resolve; }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderReader();
    const copy = screen.getByRole('button', { name: 'Copy SKILL code' });
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith(source);
    expect(copy.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Source copied to clipboard.')).toBeNull();
    await act(async () => resolveCopy());
    expect(screen.getByRole('status').textContent).toBe('Source copied to clipboard.');
  });

  it('reports clipboard failure without claiming success and permits retry', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('Permission denied')).mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Copy SKILL code' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Copy failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy SKILL code' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Source copied to clipboard.'));
  });
});
