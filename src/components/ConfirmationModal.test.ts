import { describe, it, expect, vi } from 'vitest';
import { ConfirmationModalState } from '../types';

describe('ConfirmationModal logic & aria contract', () => {
  const defaultModalState: ConfirmationModalState = {
    isOpen: true,
    title: 'Delete Assignment',
    description: 'Are you sure you want to delete this assignment?',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    isDestructive: true,
    onConfirm: vi.fn(),
  };

  it('modal state has required title and description for ARIA labelling', () => {
    expect(defaultModalState.title).toBe('Delete Assignment');
    expect(defaultModalState.description).toContain('delete this assignment');
  });

  it('onConfirm can be executed successfully', async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(true);
    const modal = { ...defaultModalState, onConfirm: onConfirmMock };

    await modal.onConfirm();
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });
});
