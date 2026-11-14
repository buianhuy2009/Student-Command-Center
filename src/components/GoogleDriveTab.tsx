import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  FileText,
  ExternalLink,
  RefreshCw,
  Search,
  Layers,
  X,
  FileSpreadsheet,
  Presentation,
  File,
  Share2,
  Users,
  Check,
  Sparkles,
} from 'lucide-react';
import { SchoolFile, ApiEnablementInfo } from '../types';
import { ApiActivationBanner } from './ApiActivationBanner';
import { shareGoogleDriveFile } from '../services/googleWorkspace';
import { useT } from '../services/i18n';

interface GoogleDriveTabProps {
  recentFiles: SchoolFile[];
  isLoadingFiles: boolean;
  onRefreshFiles: () => void;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  driveError?: string | null;
  driveApiInfo?: ApiEnablementInfo | null;
  googleToken?: string;
}

export const GoogleDriveTab: React.FC<GoogleDriveTabProps> = ({
  recentFiles,
  isLoadingFiles,
  onRefreshFiles,
  isGoogleConnected = true,
  onConnectGoogle,
  driveError,
  driveApiInfo,
  googleToken,
}) => {
  const { t, formatDate, formatTime } = useT();
  const [searchQuery, setSearchQuery] = useState('');
  const [fileCategory, setFileCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('DEFAULT');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Sharing state
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const getFileTypeDetails = (mimeType: string) => {
    if (mimeType.includes('document') || mimeType.includes('docx')) {
      return { label: t('drive_type_doc'), icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('sheet')) {
      return { label: t('drive_type_sheet'), icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
    }
    if (mimeType.includes('presentation') || mimeType.includes('slide')) {
      return { label: t('drive_type_slide'), icon: Presentation, color: 'text-[var(--status-warn-text)]', bg: 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border-[var(--status-warn-border)]' };
    }
    if (mimeType.includes('pdf')) {
      return { label: t('drive_type_pdf'), icon: File, color: 'text-rose-500', bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
    }
    return { label: t('drive_type_other'), icon: File, color: 'text-slate-500', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
  };

  const filteredFiles = useMemo(() => {
    const filtered = recentFiles.filter((file) => {
      if (fileCategory === 'DOCS' && !file.mimeType.includes('document') && !file.mimeType.includes('docx')) return false;
      if (fileCategory === 'SHEETS' && !file.mimeType.includes('spreadsheet') && !file.mimeType.includes('sheet')) return false;
      if (fileCategory === 'SLIDES' && !file.mimeType.includes('presentation') && !file.mimeType.includes('slide')) return false;
      if (fileCategory === 'PDF' && !file.mimeType.includes('pdf')) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!file.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    if (sortOrder === 'NAME') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'NEWEST') {
      sorted.sort((a, b) => new Date(b.modifiedTime || 0).getTime() - new Date(a.modifiedTime || 0).getTime());
    } else if (sortOrder === 'OLDEST') {
      sorted.sort((a, b) => new Date(a.modifiedTime || 0).getTime() - new Date(b.modifiedTime || 0).getTime());
    }
    return sorted;
  }, [recentFiles, fileCategory, searchQuery, sortOrder]);

  const activeFile = useMemo(() => {
    if (selectedFileId) {
      const found = filteredFiles.find((f) => f.id === selectedFileId);
      if (found) return found;
    }
    return filteredFiles[0] || null;
  }, [selectedFileId, filteredFiles]);

  const handleShareFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFile || !shareEmail.trim()) return;
    if (!isGoogleConnected || !googleToken) {
      setShareError(t('drive_connect_to_share'));
      if (onConnectGoogle) onConnectGoogle();
      return;
    }
    setIsSharing(true);
    setShareSuccess(false);
    setShareError(null);
    try {
      await shareGoogleDriveFile(googleToken, activeFile.id, shareEmail.trim());
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error sharing file:', err);
      setShareError(err?.message || t('drive_share_err'));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'ALL', label: t('drive_all') },
            { id: 'DOCS', label: t('drive_docs') },
            { id: 'SHEETS', label: t('drive_sheets') },
            { id: 'SLIDES', label: t('drive_slides') },
            { id: 'PDF', label: t('drive_pdfs') },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFileCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                fileCategory === cat.id
                  ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Right Search & Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label={t('drive_sort_label')}
            className="px-2 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-secondary)] font-semibold cursor-pointer"
          >
            <option value="DEFAULT">{t('drive_sort_default')}</option>
            <option value="NAME">{t('drive_sort_name')}</option>
            <option value="NEWEST">{t('drive_sort_newest')}</option>
            <option value="OLDEST">{t('drive_sort_oldest')}</option>
          </select>
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('drive_search_ph')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
            />
          </div>

          <button
            onClick={() => (!isGoogleConnected && onConnectGoogle ? onConnectGoogle() : onRefreshFiles())}
            disabled={isLoadingFiles}
            className="p-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors cursor-pointer"
            title={isGoogleConnected ? t('drive_refresh') : t('drive_connect')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {driveApiInfo ? (
        <ApiActivationBanner info={driveApiInfo} onRetry={onRefreshFiles} isRetrying={isLoadingFiles} />
      ) : driveError ? (
        <div className="p-3 bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] rounded-xl flex items-center justify-between gap-3 text-xs text-[var(--status-warn-text)]">
          <span>{driveError}</span>
          {onConnectGoogle && (
            <button onClick={onConnectGoogle} className="px-2.5 py-1 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold cursor-pointer">
              {t('drive_connect')}
            </button>
          )}
        </div>
      ) : null}

      {/* TWO-PANE MASTER-DETAIL LAYOUT */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-xs flex flex-col md:flex-row h-[600px]">
        
        {/* LEFT MASTER PANE: Compact File List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-[var(--border-default)] flex flex-col bg-[var(--bg-subtle)] overflow-hidden">
          <div className="p-3 border-b border-[var(--border-default)] flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
            <span>{t('drive_items')}</span>
            <span>{filteredFiles.length} {t('drive_files')}</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-default)]">
            {isLoadingFiles ? (
              <div className="p-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[var(--accent-text)]" />
                <span className="text-xs">{t('drive_indexing')}</span>
              </div>
            ) : !isGoogleConnected ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs space-y-3 my-auto">
                <HardDrive className="w-8 h-8 mx-auto text-[var(--accent-text)] opacity-80" />
                <div className="space-y-1">
                  <p className="font-bold text-[var(--text-primary)]">{t('drive_connect_card_title')}</p>
                  <p>{t('drive_connect_card_desc')}</p>
                </div>
                {onConnectGoogle && (
                  <button
                    type="button"
                    onClick={onConnectGoogle}
                    className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('canvas_connect_drive_btn')}</span>
                  </button>
                )}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-muted)] text-xs">
                {t('drive_empty')}
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = activeFile?.id === file.id;
                const fileType = getFileTypeDetails(file.mimeType);
                const Icon = fileType.icon;

                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`p-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-left flex items-start gap-3 ${
                      isSelected ? 'bg-[var(--bg-surface)] font-semibold border-l-3 border-[var(--accent-fill)]' : ''
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${fileType.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-[var(--text-primary)] font-semibold truncate mb-0.5">
                        {file.name}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                        <span className={`px-1.5 py-0.2 rounded font-bold ${fileType.bg}`}>
                          {fileType.label}
                        </span>
                        {file.modifiedTime && (
                          <span>{formatDate(file.modifiedTime)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT DETAIL PANE: File Inspector & Sharing Studio */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-surface)] overflow-hidden">
          {activeFile ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Header */}
              <div className="p-6 border-b border-[var(--border-default)] flex items-start justify-between gap-4 bg-[var(--bg-subtle)]/40">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug">
                    {activeFile.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{t('drive_type')} <strong className="text-[var(--text-primary)]">{getFileTypeDetails(activeFile.mimeType).label}</strong></span>
                    {activeFile.modifiedTime && (
                      <>
                        <span>•</span>
                        <span>{t('drive_modified')} {formatDate(activeFile.modifiedTime)} {formatTime(activeFile.modifiedTime)}</span>
                      </>
                    )}
                  </div>
                </div>

                {activeFile.webViewLink && (
                  <a
                    href={activeFile.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <span>{t('drive_open')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Inspector Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                
                {/* 1-Click Peer Sharing Card */}
                <div className="p-5 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
                  <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                    <Share2 className="w-4 h-4 text-[var(--accent-text)]" />
                    <span>{t('drive_share_title')}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {t('drive_share_desc')}
                  </p>

                  <form onSubmit={handleShareFile} className="flex gap-2">
                    <input
                      type="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder={t('drive_share_ph')}
                      className="flex-1 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
                    />
                    <button
                      type="submit"
                      disabled={isSharing || !shareEmail.trim()}
                      className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-canvas)] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSharing ? t('drive_sharing') : t('drive_share')}
                    </button>
                  </form>

                  {shareSuccess && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold animate-in fade-in">
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('drive_shared_ok')}</span>
                    </div>
                  )}
                  {shareError && (
                    <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-2.5 flex items-center justify-between gap-2" role="alert">
                      <span>{shareError}</span>
                      {!googleToken && onConnectGoogle && (
                        <button
                          type="button"
                          onClick={onConnectGoogle}
                          className="px-2.5 py-1 bg-[var(--accent-fill)] text-white rounded-lg font-semibold shrink-0 cursor-pointer"
                        >
                          {t('drive_connect')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* File Summary */}
                <div className="p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] space-y-1.5">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] block">
                    {t('drive_privacy_title')}
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {getFileTypeDetails(activeFile.mimeType).label}
                    {activeFile.modifiedTime ? t('drive_updated_at', { date: formatDate(activeFile.modifiedTime) }) : ''}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {t('drive_privacy_desc')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-[var(--text-muted)] text-center space-y-2">
              <HardDrive className="w-10 h-10 opacity-30" />
              <p className="text-xs font-bold text-[var(--text-primary)]">{t('drive_select_title')}</p>
              <p className="text-[11px] max-w-xs">{t('drive_select_hint')}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
