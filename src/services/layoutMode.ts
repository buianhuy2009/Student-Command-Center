export type LayoutMode = 'calm' | 'classic';

export const LAYOUT_MODE_KEY = 'scc_layout_mode_v1';
export const LAYOUT_MODE_EVENT = 'scc-layout-mode';

export function getLayoutMode(): LayoutMode {
  try {
    const saved = localStorage.getItem(LAYOUT_MODE_KEY);
    if (saved === 'classic' || saved === 'calm') return saved;
  } catch {}
  return 'calm';
}

export function setLayoutMode(mode: LayoutMode): void {
  try {
    localStorage.setItem(LAYOUT_MODE_KEY, mode);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(LAYOUT_MODE_EVENT, { detail: mode }));
  } catch {}
}
