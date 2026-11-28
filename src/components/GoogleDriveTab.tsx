import React, { useState, useMemo, useRef } from 'react';
import {
  HardDrive,
  FileText,
  ExternalLink,
  RefreshCw,
  Search,
  X,
  FileSpreadsheet,
  Presentation,
  File,
  Share2,
  Check,
  Sparkles,
  Upload,
  Link2,
  Plus,
  Trash2,
  Download,
  FolderKey,
} from 'lucide-react';
import { SchoolFile, ApiEnablementInfo } from '../types';
import { ApiActivationBanner } from './ApiActivationBanner';
import {
  shareGoogleDriveFile,
  uploadFileToGoogleDrive,
  parseGoogleDriveLink,
  fetchDriveFileMetadata,
  createBlankGoogleFile,
} from '../services/googleWorkspace';
import { db } from '../services/db';
import { useT } from '../services/i18n';
import { getDriveDateAdded } from '../utils/driveMeta';

const EXTERNAL_DRIVE_FILES_KEY = 'scc_external_drive_files_v1';
const LOCAL_BLOB_KEY_PREFIX = 'local_drive_blob_v1__';
const MAX_LOCAL_FILE_BYTES = 8 * 1024 * 1024; // 8 MB local storage cap

function loadExternalDriveFiles(): SchoolFile[] {
  try {
    const raw = localStorage.getItem(EXTERNAL_DRIVE_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExternalDriveFiles(files: SchoolFile[]) {
  try {
    localStorage.setItem(EXTERNAL_DRIVE_FILES_KEY, JSON.stringify(files));
  } catch {}
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

interface GoogleDriveTabProps {
  recentFiles: SchoolFile[];
  isLoadingFiles: boolean;
  onRefreshFiles: () => void;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  hasAllDriveAccess?: boolean;
  onRequestAllFilesAccess?: () => void;
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
  hasAllDriveAccess = false,
  onRequestAllFilesAccess,
  driveError,
  driveApiInfo,
  googleToken,
}) => {
  const { t, formatDate } = useT();
  const [searchQuery, setSearchQuery] = useState('');
  const [fileCategory, setFileCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('DEFAULT');
  const [sharingFileId, setSharingFileId] = useState<string | null>(null);

  // User-added external files (device uploads + Drive links)
  const [externalFiles, setExternalFiles] = useState<SchoolFile[]>(() => loadExternalDriveFiles());
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [addFeedback, setAddFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkNameInput, setLinkNameInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sharing state
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const persistExternal = (updater: (prev: SchoolFile[]) => SchoolFile[]) => {
    setExternalFiles((prev) => {
      const next = updater(prev);
      saveExternalDriveFiles(next);
      return next;
    });
  };

  const handleDeviceFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsAddingFile(true);
    setAddFeedback(null);
    let lastId: string | null = null;
    try {
      for (const file of Array.from(fileList)) {
        if (isGoogleConnected && googleToken) {
          try {
            const uploaded = { ...(await uploadFileToGoogleDrive(googleToken, file)), addedAt: new Date().toISOString() };
            persistExternal((prev) => [uploaded, ...prev.filter((f) => f.id !== uploaded.id)]);
            lastId = uploaded.id;
            setAddFeedback({ type: 'ok', text: t('drive_upload_done', { name: uploaded.name }) });
            onRefreshFiles();
            continue;
          } catch (uploadErr: any) {
            console.warn('Drive upload fallback to local:', uploadErr);
          }
        }

        if (file.size > MAX_LOCAL_FILE_BYTES) {
          setAddFeedback({ type: 'err', text: `${file.name}: max 8 MB in local browser storage.` });
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        try {
          await db.preferences.put({ key: `${LOCAL_BLOB_KEY_PREFIX}${id}`, value: dataUrl });
        } catch {}
        const localEntry: SchoolFile = {
          id,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          modifiedTime: new Date(file.lastModified || Date.now()).toISOString(),
          webViewLink: '',
          size: String(file.size),
          origin: 'local',
          localDataUrl: dataUrl.length < 300_000 ? dataUrl : undefined,
          addedAt: new Date().toISOString(),
        };
        persistExternal((prev) => [localEntry, ...prev]);
        lastId = id;
        setAddFeedback({
          type: 'ok',
          text: `${t('drive_upload_done', { name: file.name })} ${t('drive_upload_local_note')}`,
        });
      }
      if (lastId) {
        setSharingFileId(null);
      }
    } catch (err: any) {
      setAddFeedback({ type: 'err', text: err?.message || 'Could not add file.' });
    } finally {
      setIsAddingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddDriveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFeedback(null);
    const parsed = parseGoogleDriveLink(linkUrlInput);
    if (!parsed) {
      setAddFeedback({ type: 'err', text: t('drive_link_invalid') });
      return;
    }
    setIsAddingFile(true);
    try {
      let item: SchoolFile | null = null;
      if (isGoogleConnected && googleToken) {
        item = await fetchDriveFileMetadata(googleToken, parsed.fileId);
      }
      const entry: SchoolFile = item
        ? {
            ...item,
            name: linkNameInput.trim() || item.name,
            origin: 'drive_link',
          }
        : {
            id: parsed.fileId,
            name: linkNameInput.trim() || parsed.defaultName,
            mimeType: parsed.mimeType,
            modifiedTime: new Date().toISOString(),
            webViewLink: parsed.webViewLink,
            origin: 'drive_link',
          };
      persistExternal((prev) => [{ ...entry, addedAt: new Date().toISOString() }, ...prev.filter((f) => f.id !== entry.id)]);
      setShowLinkForm(false);
      setLinkUrlInput('');
      setLinkNameInput('');
      setAddFeedback({ type: 'ok', text: t('drive_upload_done', { name: entry.name }) });
    } finally {
      setIsAddingFile(false);
    }
  };

  const handleCreateNewDoc = async () => {
    if (!isGoogleConnected || !googleToken) {
      onConnectGoogle?.();
      return;
    }
    setIsAddingFile(true);
    setAddFeedback(null);
    try {
      const created = await createBlankGoogleFile(
        googleToken,
        'doc',
        `StudentOS Notes — ${new Date().toLocaleDateString()}`
      );
      persistExternal((prev) => [{ ...created, addedAt: new Date().toISOString() }, ...prev.filter((f) => f.id !== created.id)]);
      setAddFeedback({ type: 'ok', text: t('drive_upload_done', { name: created.name }) });
      onRefreshFiles();
    } catch (err: any) {
      setAddFeedback({ type: 'err', text: err?.message || 'Could not create Google Doc.' });
    } finally {
      setIsAddingFile(false);
    }
  };

  const handleRemoveExternalFile = async (fileId: string) => {
    persistExternal((prev) => prev.filter((f) => f.id !== fileId));
    try {
      await db.preferences.delete(`${LOCAL_BLOB_KEY_PREFIX}${fileId}`);
    } catch {}
    if (sharingFileId === fileId) {
      setSharingFileId(null);
    }
  };

  const handleOpenLocalFile = async (file: SchoolFile) => {
    let dataUrl = file.localDataUrl;
    if (!dataUrl) {
      try {
        const row: any = await db.preferences.get(`${LOCAL_BLOB_KEY_PREFIX}${file.id}`);
        if (row?.value) dataUrl = String(row.value);
      } catch {}
    }
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = file.name || 'file';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const allFiles = useMemo(() => {
    const map = new Map<string, SchoolFile>();
    for (const f of recentFiles) {
      if (f && f.id) map.set(f.id, { ...f, origin: f.origin || 'drive' });
    }
    for (const f of externalFiles) {
      if (f && f.id && !map.has(f.id)) {
        map.set(f.id, f);
      }
    }
    return Array.from(map.values());
  }, [recentFiles, externalFiles]);

  const getFileTypeDetails = (mimeType: string) => {
    if (mimeType.includes('document') || mimeType.includes('docx') || mimeType.includes('msword')) {
      return { label: t('drive_type_doc'), icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('csv')) {
      return { label: t('drive_type_sheet'), icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
    }
    if (mimeType.includes('presentation') || mimeType.includes('slide') || mimeType.includes('powerpoint')) {
      return { label: t('drive_type_slide'), icon: Presentation, color: 'text-[var(--status-warn-text)]', bg: 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border-[var(--status-warn-border)]' };
    }
    if (mimeType.includes('pdf')) {
      return { label: t('drive_type_pdf'), icon: File, color: 'text-rose-500', bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
    }
    return { label: t('drive_type_other'), icon: File, color: 'text-slate-500', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
  };

  const filteredFiles = useMemo(() => {
    const filtered = allFiles.filter((file) => {
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
  }, [allFiles, fileCategory, searchQuery, sortOrder]);

  const handleShareFile = async (e: React.FormEvent, targetFile: SchoolFile) => {
    e.preventDefault();
    if (!targetFile || !shareEmail.trim()) return;
    if (!isGoogleConnected || !googleToken) {
      setShareError(t('drive_connect_to_share'));
      if (onConnectGoogle) onConnectGoogle();
      return;
    }
    setIsSharing(true);
    setShareSuccess(false);
    setShareError(null);
    try {
      await shareGoogleDriveFile(googleToken, targetFile.id, shareEmail.trim());
      setShareSuccess(true);
      setShareEmail('');
      setTimeout(() => {
        setShareSuccess(false);
        setSharingFileId(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error sharing file:', err);
      setShareError(err?.message || t('drive_share_err'));
    } finally {
      setIsSharing(false);
    }
  };

  const isExternalAdded = (file: SchoolFile) => externalFiles.some((ef) => ef.id === file.id);

  const describeOwner = (file: SchoolFile): string => {
    if (file.origin === 'local') return t('drive_owner_device');
    if (file.ownerName) return file.ownedByMe ? t('drive_owner_you', { name: file.ownerName }) : file.ownerName;
    if (file.sharedDrive) return t('drive_owner_shared_drive');
    return t('drive_owner_unknown');
  };

  const describeDateAdded = (file: SchoolFile): string => {
    const added = getDriveDateAdded(file);
    return (added && formatDate(added)) || t('drive_date_unknown');
  };

  return (
    <div
      className={`h-full min-h-0 flex-1 flex flex-col gap-3 overflow-hidden ${isDragging ? 'ring-2 ring-[var(--accent-fill)] rounded-2xl' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleDeviceFiles(e.dataTransfer.files);
      }}
    >
      {/* Hidden multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleDeviceFiles(e.target.files)}
      />

      {/* Compact Action & Filter Bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-3 space-y-2.5 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isAddingFile}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isAddingFile ? t('drive_uploading') : t('drive_add_device_btn')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLinkForm((v) => !v)}
              className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('drive_add_link_btn')}</span>
            </button>

            <button
              type="button"
              disabled={isAddingFile}
              onClick={handleCreateNewDoc}
              className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('drive_new_doc_btn')}</span>
            </button>

            {onRequestAllFilesAccess && (
              hasAllDriveAccess ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]">
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('drive_all_granted_badge')}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRequestAllFilesAccess}
                  className="px-3 py-1.5 bg-[var(--accent-2-soft,var(--accent-soft))] hover:brightness-95 border border-[var(--accent-2-border,var(--accent-border))] text-[var(--accent-2-text,var(--accent-text))] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FolderKey className="w-3.5 h-3.5" />
                  <span>{t('drive_access_all_btn')}</span>
                </button>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
            <div className="relative w-44 sm:w-52">
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
              type="button"
              onClick={() => (!isGoogleConnected && onConnectGoogle ? onConnectGoogle() : onRefreshFiles())}
              disabled={isLoadingFiles}
              className="p-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors cursor-pointer"
              title={isGoogleConnected ? t('drive_refresh') : t('drive_connect')}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-[var(--border-hairline)]">
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
                type="button"
                onClick={() => setFileCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  fileCategory === cat.id
                    ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {filteredFiles.length} {t('drive_files')}
          </span>
        </div>
      </div>

      {/* Inline Link-from-Google-Drive Form */}
      {showLinkForm && (
        <form
          onSubmit={handleAddDriveLink}
          className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-3.5 space-y-2.5 shadow-xs shrink-0 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('drive_link_title')}</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowLinkForm(false)}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label={t('common_close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              value={linkUrlInput}
              onChange={(e) => setLinkUrlInput(e.target.value)}
              placeholder={t('drive_link_url_ph')}
              className="sm:col-span-7 px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
            />
            <input
              type="text"
              value={linkNameInput}
              onChange={(e) => setLinkNameInput(e.target.value)}
              placeholder={t('drive_link_name_ph')}
              className="sm:col-span-3 px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
            />
            <button
              type="submit"
              disabled={isAddingFile}
              className="sm:col-span-2 px-3 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {t('drive_link_add_confirm')}
            </button>
          </div>
        </form>
      )}

      {addFeedback && (
        <div
          role="status"
          className={`px-3.5 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 shrink-0 ${
            addFeedback.type === 'ok'
              ? 'bg-[var(--status-ok-bg)] border-[var(--status-ok-border)] text-[var(--status-ok-text)]'
              : 'bg-[var(--status-err-bg)] border-[var(--status-err-border)] text-[var(--status-err-text)]'
          }`}
        >
          <span>{addFeedback.text}</span>
          <button type="button" onClick={() => setAddFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {driveApiInfo ? (
        <div className="shrink-0">
          <ApiActivationBanner info={driveApiInfo} onRetry={onRefreshFiles} isRetrying={isLoadingFiles} />
        </div>
      ) : driveError ? (
        <div className="p-3 bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--status-warn-text)] shrink-0">
          <span>{driveError}</span>
          {onConnectGoogle && (
            <button onClick={onConnectGoogle} className="px-2.5 py-1 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold cursor-pointer">
              {t('drive_connect')}
            </button>
          )}
        </div>
      ) : null}

      {/* CLEAN FILENAME-ONLY LIST (No preview pane) */}
      <div className="flex-1 min-h-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-xs flex flex-col">
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]">
          {isLoadingFiles && filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-[var(--text-muted)] gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[var(--accent-text)]" />
              <span className="text-xs">{t('drive_indexing')}</span>
            </div>
          ) : !isGoogleConnected && filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)] text-xs space-y-3">
              <HardDrive className="w-8 h-8 text-[var(--accent-text)] opacity-80" />
              <div className="space-y-1 max-w-sm">
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
            <div className="h-full flex items-center justify-center p-8 text-[var(--text-muted)] text-xs">
              {t('drive_empty')}
            </div>
          ) : (
            filteredFiles.map((file) => {
              const fileType = getFileTypeDetails(file.mimeType);
              const Icon = fileType.icon;
              const isSharingThis = sharingFileId === file.id;
              return (
                <div key={file.id} className="px-4 py-2.5 hover:bg-[var(--bg-hover)]/60 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className={`w-4 h-4 shrink-0 ${fileType.color}`} />
                      <div className="min-w-0 flex flex-col items-start">
                      {file.origin === 'local' ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenLocalFile(file)}
                          className="max-w-full text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-text)] truncate text-left cursor-pointer"
                        >
                          {file.name}
                        </button>
                      ) : file.webViewLink ? (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="max-w-full text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-text)] truncate"
                        >
                          {file.name}
                        </a>
                      ) : (
                        <span className="max-w-full text-xs sm:text-sm font-medium text-[var(--text-primary)] truncate">
                          {file.name}
                        </span>
                      )}
                        <div className="max-w-full text-[11px] text-[var(--text-muted)] flex flex-wrap gap-x-3">
                          <span className="truncate">{t('drive_owner_label', { owner: describeOwner(file) })}</span>
                          <span>{t('drive_added_label', { date: describeDateAdded(file) })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {file.origin === 'local' ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenLocalFile(file)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-surface)] cursor-pointer"
                          title={t('drive_download_local')}
                          aria-label={t('drive_download_local')}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSharingFileId(isSharingThis ? null : file.id);
                              setShareError(null);
                              setShareSuccess(false);
                            }}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-surface)] cursor-pointer"
                            title={t('drive_share')}
                            aria-label={t('drive_share')}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-surface)]"
                              title={t('drive_open')}
                              aria-label={t('drive_open')}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </>
                      )}

                      {isExternalAdded(file) && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveExternalFile(file.id)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-[var(--bg-surface)] cursor-pointer"
                          title={t('drive_remove_added')}
                          aria-label={t('drive_remove_added')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isSharingThis && (
                    <form
                      onSubmit={(e) => handleShareFile(e, file)}
                      className="mt-2 pl-7 flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder={t('drive_share_ph')}
                        className="flex-1 min-w-[180px] px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)]"
                      />
                      <button
                        type="submit"
                        disabled={isSharing || !shareEmail.trim()}
                        className="px-3 py-1.5 bg-[var(--accent-fill)] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {isSharing ? t('drive_sharing') : t('drive_share')}
                      </button>
                      {shareSuccess && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {t('drive_shared_ok')}
                        </span>
                      )}
                      {shareError && (
                        <span className="text-xs text-rose-600 dark:text-rose-400">{shareError}</span>
                      )}
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
