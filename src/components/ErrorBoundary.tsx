import React from 'react';
import { t, useT } from '../services/i18n';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error?: Error }
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary caught', error, info); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 m-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900">
          <h3 className="font-bold">{t('err_ws_crashed')}</h3>
          <p className="text-xs mt-1 opacity-80">{this.state.error?.message || t('err_unexpected')}</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-3 px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100">{t('common_retry')}</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const WorkspaceCrashCard: React.FC<{ error?: Error; onRetry?: ()=>void }> = ({ error, onRetry }) => {
  const { t } = useT();
  return (
    <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900">
      <h3 className="font-bold text-sm">{t('err_ws_title')}</h3>
      <p className="text-xs mt-1">{error?.message || t('err_ws_desc')}</p>
      {onRetry && <button onClick={onRetry} className="mt-3 px-3 py-1.5 bg-white border rounded-xl text-xs font-bold">{t('common_retry')}</button>}
    </div>
  );
};
