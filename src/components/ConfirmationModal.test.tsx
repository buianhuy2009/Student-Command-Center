import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ConfirmationModal } from './ConfirmationModal';
import { ConfirmationModalState } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ConfirmationModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const baseModal: ConfirmationModalState = {
    isOpen: true,
    title: 'Delete Assignment',
    description: 'Are you sure you want to delete this assignment?',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    isDestructive: true,
    onConfirm: vi.fn(),
  };

  it('renders null when modal is not open', () => {
    act(() => {
      root.render(<ConfirmationModal modal={{ ...baseModal, isOpen: false }} onClose={vi.fn()} />);
    });
    expect(container.textContent).toBe('');
  });

  it('renders with ARIA dialog roles and attributes when open', () => {
    act(() => {
      root.render(<ConfirmationModal modal={baseModal} onClose={vi.fn()} />);
    });

    const backdrop = container.querySelector('#confirmation-modal-backdrop');
    expect(backdrop).not.toBeNull();

    const content = container.querySelector('#confirmation-modal-content');
    expect(content).not.toBeNull();
    expect(content?.getAttribute('role')).toBe('dialog');
    expect(content?.getAttribute('aria-modal')).toBe('true');
    expect(content?.getAttribute('aria-labelledby')).toBe('confirmation-modal-title');
    expect(content?.getAttribute('aria-describedby')).toBe('confirmation-modal-description');

    const title = container.querySelector('#confirmation-modal-title');
    expect(title?.textContent).toBe('Delete Assignment');

    const desc = container.querySelector('#confirmation-modal-description');
    expect(desc?.textContent).toBe('Are you sure you want to delete this assignment?');

    const closeBtn = container.querySelector('button[aria-label="Close modal"]');
    expect(closeBtn).not.toBeNull();
  });

  it('triggers onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<ConfirmationModal modal={baseModal} onClose={onClose} />);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
