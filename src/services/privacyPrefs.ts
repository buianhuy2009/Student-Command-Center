export interface StudentPrivacyPrefs {
  /** Allow sending trimmed assignment/schedule/alert summary context to AI Tutor (default: true). */
  shareAcademicContextWithTutor: boolean;
  /** Socratic Hint-Only mode is always enforced for student safety. */
  enforceHintOnlyTutor: true;
}

const STORAGE_KEY = 'scc-privacy-prefs-v1';
export const PRIVACY_PREFS_EVENT = 'scc-privacy-prefs-updated';

const DEFAULT_PREFS: StudentPrivacyPrefs = {
  shareAcademicContextWithTutor: true,
  enforceHintOnlyTutor: true,
};

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getPrivacyPrefs(): StudentPrivacyPrefs {
  if (!hasStorage()) {
    return { ...DEFAULT_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFS };
    const record = parsed as Record<string, unknown>;
    return {
      shareAcademicContextWithTutor:
        typeof record.shareAcademicContextWithTutor === 'boolean'
          ? record.shareAcademicContextWithTutor
          : DEFAULT_PREFS.shareAcademicContextWithTutor,
      enforceHintOnlyTutor: true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function updatePrivacyPrefs(
  partial: Partial<Pick<StudentPrivacyPrefs, 'shareAcademicContextWithTutor'>>
): StudentPrivacyPrefs {
  const current = getPrivacyPrefs();
  const next: StudentPrivacyPrefs = {
    shareAcademicContextWithTutor:
      typeof partial.shareAcademicContextWithTutor === 'boolean'
        ? partial.shareAcademicContextWithTutor
        : current.shareAcademicContextWithTutor,
    enforceHintOnlyTutor: true,
  };
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent<StudentPrivacyPrefs>(PRIVACY_PREFS_EVENT, { detail: next }));
    } catch {
      // Ignore storage quota or private-browsing errors
    }
  }
  return next;
}

export function subscribePrivacyPrefs(cb: (prefs: StudentPrivacyPrefs) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<StudentPrivacyPrefs>).detail;
    cb(detail ? { ...detail, enforceHintOnlyTutor: true } : getPrivacyPrefs());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cb(getPrivacyPrefs());
    }
  };
  window.addEventListener(PRIVACY_PREFS_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PRIVACY_PREFS_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
