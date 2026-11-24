import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAiJobsStore } from './aiJobsStore';

describe('useAiJobsStore', () => {
  beforeEach(() => {
    useAiJobsStore.setState({ jobs: {}, toasts: [] });
  });

  it('tracks job lifecycle and clamps percent between 0 and 100', () => {
    const store = useAiJobsStore.getState();
    store.startJob({
      id: 'ocr-1',
      kind: 'ocr',
      title: 'Note Scanner',
      label: 'Starting...',
      percent: -10,
      targetTab: 'note-scanner',
    });

    expect(useAiJobsStore.getState().jobs['ocr-1']?.percent).toBe(0);
    expect(useAiJobsStore.getState().jobs['ocr-1']?.status).toBe('running');

    store.updateJob('ocr-1', { percent: 150, label: 'Reading line 10 of 10' });
    expect(useAiJobsStore.getState().jobs['ocr-1']?.percent).toBe(100);

    store.completeJob('ocr-1', { label: 'Done' });
    const done = useAiJobsStore.getState().jobs['ocr-1'];
    expect(done?.status).toBe('done');
    expect(done?.percent).toBe(100);
    expect(useAiJobsStore.getState().toasts.length).toBe(1);
    expect(useAiJobsStore.getState().toasts[0]?.jobId).toBe('ocr-1');
  });

  it('invokes cancel callback and blocks further updates after cancel', () => {
    const cancelSpy = vi.fn();
    const store = useAiJobsStore.getState();
    store.startJob({
      id: 'gmail-scan',
      kind: 'gmail',
      title: 'Gmail Radar',
      label: 'Analyzing email 1 of 10',
      percent: 25,
      targetTab: 'gmail',
      cancel: cancelSpy,
    });

    store.cancelJob('gmail-scan');
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(useAiJobsStore.getState().jobs['gmail-scan']?.status).toBe('cancelled');

    store.updateJob('gmail-scan', { percent: 80 });
    expect(useAiJobsStore.getState().jobs['gmail-scan']?.percent).toBe(25);
  });
});
