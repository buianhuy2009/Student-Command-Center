import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
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
    document.body.removeChild(container);
    container = null as any;
  });

  it('renders null when modal is not open', () => {
    const modalState: ConfirmationModalState = {
      isOpen: false,
      title: 'Delete Assignment',
      description: 'Are you sure you want to delete this assignment?',
      onConfirm: vi.fn(),
    };

    act(() => {
      root.render(React.createElement(ConfirmationModal, { modal: modalState, onClose: vi.fn() }));
    });

    expect(container.innerHTML).toBe('');
  });

  it('renders dialog with proper accessibility attributes and IDs when open', () => {
    const modalState: ConfirmationModalState = {
      isOpen: true,
      title: 'Delete Assignment',
      description: 'Are you sure you want to delete this assignment?',
      onConfirm: vi.fn(),
    };

    act(() => {
      root.render(React.createElement(ConfirmationModal, { modal: modalState, onClose: vi.fn() }));
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('confirmation-modal-title');
    expect(dialog?.getAttribute('aria-describedby')).toBe('confirmation-modal-description');

    const titleEl = container.querySelector('#confirmation-modal-title');
    expect(titleEl?.textContent).toBe('Delete Assignment');

    const descEl = container.querySelector('#confirmation-modal-description');
    expect(descEl?.textContent).toBe('Are you sure you want to delete this assignment?');

    const closeBtn = container.querySelector('button[aria-label="Close modal"]');
    expect(closeBtn).not.toBeNull();
  });

  it('triggers onClose when Escape key is pressed', () => {
    const onCloseMock = vi.fn();
    const modalState: ConfirmationModalState = {
      isOpen: true,
      title: 'Delete Item',
      description: 'Confirm delete',
      onConfirm: vi.fn(),
    };

    act(() => {
      root.render(React.createElement(ConfirmationModal, { modal: modalState, onClose: onCloseMock }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
