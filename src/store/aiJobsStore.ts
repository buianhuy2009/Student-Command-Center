import { create } from 'zustand';

export type AiJobKind = 'lecture' | 'ocr' | 'gmail' | 'chat';
export type AiJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface AiJob {
  id: string;
  kind: AiJobKind;
  title: string;
  status: AiJobStatus;
  percent: number;
  indeterminate?: boolean;
  label: string;
  detail?: string;
  currentItem?: number;
  totalItems?: number;
  etaText?: string;
  targetTab: string;
  startedAt: number;
  updatedAt: number;
  error?: string;
  cancel?: () => void;
}

export interface AiJobToast {
  id: string;
  jobId: string;
  kind: AiJobKind;
  title: string;
  status: 'done' | 'error';
  message: string;
  targetTab: string;
  createdAt: number;
}

export interface StartAiJobInput {
  id: string;
  kind: AiJobKind;
  title: string;
  label: string;
  targetTab: string;
  percent?: number;
  indeterminate?: boolean;
  detail?: string;
  currentItem?: number;
  totalItems?: number;
  etaText?: string;
  cancel?: () => void;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

interface AiJobsState {
  jobs: Record<string, AiJob>;
  toasts: AiJobToast[];
  startJob: (input: StartAiJobInput) => void;
  updateJob: (id: string, patch: Partial<Omit<AiJob, 'id' | 'kind' | 'startedAt'>>) => void;
  completeJob: (id: string, patch?: Partial<Pick<AiJob, 'label' | 'detail' | 'title'>>) => void;
  failJob: (id: string, error: string, detail?: string) => void;
  cancelJob: (id: string) => void;
  dismissJob: (id: string) => void;
  dismissToast: (toastId: string) => void;
  clearFinished: () => void;
}

export const useAiJobsStore = create<AiJobsState>((set, get) => ({
  jobs: {},
  toasts: [],

  startJob: (input) => {
    const now = Date.now();
    const job: AiJob = {
      id: input.id,
      kind: input.kind,
      title: input.title,
      status: 'running',
      percent: clampPercent(input.percent ?? 0),
      indeterminate: input.indeterminate,
      label: input.label,
      detail: input.detail,
      currentItem: input.currentItem,
      totalItems: input.totalItems,
      etaText: input.etaText,
      targetTab: input.targetTab,
      startedAt: now,
      updatedAt: now,
      cancel: input.cancel,
    };
    set((state) => ({
      jobs: { ...state.jobs, [input.id]: job },
    }));
  },

  updateJob: (id, patch) => {
    set((state) => {
      const existing = state.jobs[id];
      if (!existing || existing.status === 'cancelled') return state;
      const nextPercent =
        patch.percent !== undefined ? clampPercent(patch.percent) : existing.percent;
      return {
        jobs: {
          ...state.jobs,
          [id]: {
            ...existing,
            ...patch,
            percent: nextPercent,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  completeJob: (id, patch) => {
    const existing = get().jobs[id];
    if (!existing || existing.status === 'cancelled') return;
    const now = Date.now();
    const completed: AiJob = {
      ...existing,
      ...patch,
      status: 'done',
      percent: 100,
      indeterminate: false,
      updatedAt: now,
      cancel: undefined,
    };
    const toast: AiJobToast = {
      id: `${id}-${now}`,
      jobId: id,
      kind: completed.kind,
      title: completed.title,
      status: 'done',
      message: patch?.detail || patch?.label || completed.label,
      targetTab: completed.targetTab,
      createdAt: now,
    };
    set((state) => ({
      jobs: { ...state.jobs, [id]: completed },
      toasts: [toast, ...state.toasts].slice(0, 4),
    }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scc-ai-job-finished', { detail: completed }));
    }
  },

  failJob: (id, error, detail) => {
    const existing = get().jobs[id];
    if (!existing || existing.status === 'cancelled') return;
    const now = Date.now();
    const failed: AiJob = {
      ...existing,
      status: 'error',
      error,
      detail: detail ?? error,
      indeterminate: false,
      updatedAt: now,
      cancel: undefined,
    };
    const toast: AiJobToast = {
      id: `${id}-err-${now}`,
      jobId: id,
      kind: failed.kind,
      title: failed.title,
      status: 'error',
      message: error,
      targetTab: failed.targetTab,
      createdAt: now,
    };
    set((state) => ({
      jobs: { ...state.jobs, [id]: failed },
      toasts: [toast, ...state.toasts].slice(0, 4),
    }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scc-ai-job-finished', { detail: failed }));
    }
  },

  cancelJob: (id) => {
    const existing = get().jobs[id];
    if (!existing) return;
    try {
      existing.cancel?.();
    } catch {
      // Ignore cancel callback errors.
    }
    set((state) => ({
      jobs: {
        ...state.jobs,
        [id]: {
          ...existing,
          status: 'cancelled',
          indeterminate: false,
          updatedAt: Date.now(),
          cancel: undefined,
        },
      },
    }));
  },

  dismissJob: (id) => {
    set((state) => {
      const next = { ...state.jobs };
      delete next[id];
      return { jobs: next };
    });
  },

  dismissToast: (toastId) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== toastId),
    }));
  },

  clearFinished: () => {
    set((state) => {
      const next: Record<string, AiJob> = {};
      for (const [k, v] of Object.entries(state.jobs)) {
        if (v.status === 'running' || v.status === 'queued') {
          next[k] = v;
        }
      }
      return { jobs: next };
    });
  },
}));
