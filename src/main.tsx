import {StrictMode} from 'react';
// @ts-ignore -- @types/react-dom is not installed in devDependencies
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';
import { initTheme } from './services/theme';
import { migrateLocalStorageToDexie } from './services/db';
initTheme();
migrateLocalStorageToDexie();

import React from 'react';

/**
 * Last-resort boundary around the entire app. Boundaries inside App cover
 * individual workspaces, but a throw in App's own render (e.g. a malformed
 * record reaching an unguarded updater) used to unmount everything to a
 * plain white screen with no way back. This shows what happened + a recovery.
 */
class TopLevelBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('Top-level crash', error, info); }
  handleRecover = () => {
    try {
      // Drop potentially poisoned UI state, keep user data intact
      localStorage.removeItem('scc_active_tab_v1');
      localStorage.removeItem('scc_active_workspace_v1');
      const url = new URL(window.location.href);
      url.searchParams.delete('w');
      window.history.replaceState({}, '', url.toString());
    } catch {}
    this.setState({ error: null });
    try { window.location.reload(); } catch {}
  };
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF9F5', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 460, background: '#fff', border: '1px solid #DFDACB', borderRadius: 16, padding: 24 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Something went wrong — your data is safe</h2>
            <p style={{ fontSize: 13, color: '#6B6860', marginTop: 8 }}>
              The app hit an unexpected error instead of your workspace. Your assignments, notes and settings are still saved on this device.
            </p>
            <details style={{ fontSize: 12, color: '#6B6860', marginTop: 8 }}>
              <summary>Technical details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error)}</pre>
            </details>
            <button
              onClick={this.handleRecover}
              style={{ marginTop: 16, background: '#D97757', color: '#fff', border: 0, borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 44 }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TopLevelBoundary>
      <App />
    </TopLevelBoundary>
  </StrictMode>,
);
