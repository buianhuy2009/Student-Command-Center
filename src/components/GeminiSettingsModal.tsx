import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  getClientGeminiApiKey,
  setClientGeminiApiKey,
  testGeminiApiKeyDetailed,
  testGroqApiKeyDetailed,
  getClientGroqApiKey,
  setClientGroqApiKey,
  maskApiKey,
  getGeminiKeyMeta,
  setGeminiKeyExpiry,
  getGroqKeyMeta,
  setGroqKeyExpiry,
  getExpiryStatus,
  getGeminiQuotaStatus,
} from '../services/gemini';
import { vaultSet, vaultGet, vaultExists, vaultClear } from '../services/vault';
import { OfflineAiStorageCard } from './OfflineAiStorageCard';
import { useT } from '../services/i18n';

interface GeminiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiSettingsModal: React.FC<GeminiSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isTestingGroq, setIsTestingGroq] = useState(false);
  const [groqTestStatus, setGroqTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [groqStatusMessage, setGroqStatusMessage] = useState('');
  const [vaultPin, setVaultPin] = useState('');
  const [vaultLocked, setVaultLocked] = useState(vaultExists());
  const [sessionOnly, setSessionOnly] = useState(false);
  // Key-manager edit-in-place state (update without re-adding)
  const [editingGemini, setEditingGemini] = useState(false);
  const [editGeminiValue, setEditGeminiValue] = useState('');
  const [editingGroq, setEditingGroq] = useState(false);
  const [editGroqValue, setEditGroqValue] = useState('');
  // Optional expiration metadata (stored separately from key values)
  const [geminiExpiry, setGeminiExpiry] = useState('');
  const [groqExpiry, setGroqExpiry] = useState('');
  const { t } = useT();

  const quota = getGeminiQuotaStatus();
  useEffect(() => {
    if (isOpen) {
      const saved = getClientGeminiApiKey();
      const savedGroq = getClientGroqApiKey();
      setApiKey(saved);
      setGroqKey(savedGroq);
      setTestStatus(saved ? 'success' : 'idle');
      setStatusMessage(saved ? t('ai_key_plaintext_warn') : '');
      setGroqTestStatus('idle');
      setGroqStatusMessage('');
      setEditingGemini(false);
      setEditingGroq(false);
      setGeminiExpiry(getGeminiKeyMeta().expiresAt || '');
      setGroqExpiry(getGroqKeyMeta().expiresAt || '');
      try {
        setSessionOnly(!!sessionStorage.getItem('scc_gemini_api_key_session'));
      } catch { setSessionOnly(false); }
    }
  }, [isOpen, t]);

  if (!isOpen) return null;

  const geminiExpiryStatus = getExpiryStatus(geminiExpiry);
  const groqExpiryStatus = getExpiryStatus(groqExpiry);

  const handleSave = () => {
    setClientGeminiApiKey(apiKey, { sessionOnly });
    if (apiKey.trim() && editingGemini) setEditingGemini(false);
    setTestStatus('idle');
    setStatusMessage(apiKey.trim() ? t('ai_key_gemini_saved') : t('ai_key_gemini_cleared'));
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleSaveGroq = () => {
    setClientGroqApiKey(groqKey);
    if (groqKey.trim() && editingGroq) setEditingGroq(false);
    setGroqTestStatus('idle');
    setGroqStatusMessage(groqKey.trim() ? t('ai_key_groq_saved') : t('ai_key_groq_cleared'));
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestStatus('failed');
      setStatusMessage(t('ai_key_gemini_enter_first'));
      return;
    }

    setIsTesting(true);
    setTestStatus('idle');
    setStatusMessage(t('ai_key_gemini_testing'));

    const result = await testGeminiApiKeyDetailed(apiKey);
    setIsTesting(false);
    if (result.ok) {
      setTestStatus('success');
      setStatusMessage(
        result.model
          ? t('ai_key_gemini_verified_model', { model: result.model })
          : t('ai_key_gemini_verified')
      );
      setClientGeminiApiKey(apiKey, { sessionOnly });
    } else {
      setTestStatus('failed');
      // Surface the REAL provider error text — never silent fail.
      setStatusMessage(result.error || t('ai_key_gemini_failed'));
    }
  };

  const handleTestGroq = async () => {
    if (!groqKey.trim()) {
      setGroqTestStatus('failed');
      setGroqStatusMessage(t('ai_key_groq_enter_first'));
      return;
    }
    setIsTestingGroq(true);
    setGroqTestStatus('idle');
    setGroqStatusMessage(t('ai_key_groq_testing'));
    const result = await testGroqApiKeyDetailed(groqKey);
    setIsTestingGroq(false);
    if (result.ok) {
      setGroqTestStatus('success');
      setGroqStatusMessage(t('ai_key_groq_verified'));
      setClientGroqApiKey(groqKey);
    } else {
      setGroqTestStatus('failed');
      setGroqStatusMessage(result.error || t('ai_key_groq_failed'));
    }
  };

  const handleClear = () => {
    setApiKey('');
    setClientGeminiApiKey('');
    setEditingGemini(false);
    setTestStatus('idle');
    setStatusMessage(t('ai_key_gemini_cleared'));
  };

  const handleClearGroq = () => {
    setGroqKey('');
    setClientGroqApiKey('');
    try { localStorage.removeItem('scc_groq_api_key'); } catch {}
    setEditingGroq(false);
    setGroqTestStatus('idle');
    setGroqStatusMessage(t('ai_key_groq_cleared'));
  };

  const formatExpiryLabel = (s: ReturnType<typeof getExpiryStatus>) => {
    if (s.state === 'expired') return t('ai_key_expired');
    if (s.daysLeft === 0) return t('ai_key_expires_today');
    if (s.daysLeft === 1) return t('ai_key_expires_in_one', { days: 1 });
    return t('ai_key_expires_in_other', { days: s.daysLeft ?? 0 });
  };

  const expiryBadge = (s: ReturnType<typeof getExpiryStatus>) => {
    if (s.state === 'none') return null;
    const cls =
      s.state === 'expired'
        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
        : s.state === 'expiring'
        ? 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]'
        : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
        {formatExpiryLabel(s)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] rounded-3xl max-w-lg w-full border border-[var(--border-default)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-fill)] text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {t('ai_key_title')}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {t('ai_key_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-[var(--text-primary)] block mb-0.5">
                {t('ai_key_vault_title')}
              </span>
              {vaultLocked ? t('ai_key_vault_locked_desc') : t('ai_key_vault_unlocked_desc')}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="password"
                  value={vaultPin}
                  onChange={e=>setVaultPin(e.target.value)}
                  placeholder={t('ai_key_vault_pin_ph')}
                  aria-label={t('ai_key_vault_pin_ph')}
                  className="px-2 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg w-40"
                />
                {!vaultLocked ? (
                  <button onClick={async()=>{
                    if(vaultPin.length<4){ setStatusMessage(t('ai_key_pin_short')); setTestStatus('failed'); return; }
                    await vaultSet(vaultPin, { gemini: apiKey, groq: localStorage.getItem('scc_groq_api_key')||'' });
                    setVaultLocked(true); setStatusMessage(t('ai_key_vault_locked_msg')); setTestStatus('success');
                    localStorage.removeItem('scc_gemini_api_key'); localStorage.removeItem('scc_groq_api_key');
                  }} className="px-2 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg">{t('ai_key_vault_lock_btn')}</button>
                ) : (
                  <>
                    <button onClick={async()=>{
                      const data = await vaultGet(vaultPin);
                      if(!data){ setStatusMessage(t('ai_key_vault_wrong_pin')); setTestStatus('failed'); return; }
                      if(data.gemini) { setApiKey(data.gemini); setClientGeminiApiKey(data.gemini); }
                      if(data.groq) try{ localStorage.setItem('scc_groq_api_key', data.groq); }catch{}
                      if(data.groq) setGroqKey(data.groq);
                      setVaultLocked(false); setStatusMessage(t('ai_key_vault_unlocked_msg')); setTestStatus('success');
                    }} className="px-2 py-1 text-xs font-bold bg-[var(--accent-fill)] text-white rounded-lg">{t('ai_key_vault_unlock_btn')}</button>
                    <button onClick={()=>{ vaultClear(); setVaultLocked(false); setStatusMessage(t('ai_key_vault_cleared')); setTestStatus('idle'); }} className="px-2 py-1 text-xs text-rose-600 border border-rose-200 rounded-lg">{t('ai_key_vault_clear')}</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Key manager: masked list with per-key Edit / Delete + expiry */}
          <div className="p-3.5 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-3">
            <p className="text-xs font-bold text-[var(--text-primary)]">{t('ai_key_configured_keys')}</p>

            {/* Gemini row */}
            <div className="flex items-start justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{t('ai_key_gemini_name')}</span>
                  {apiKey.trim() ? (
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">{maskApiKey(apiKey)}</span>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">{t('ai_key_not_configured')}</span>
                  )}
                  {expiryBadge(geminiExpiryStatus)}
                </div>
                {geminiExpiryStatus.state === 'expired' && (
                  <p className="text-[11px] text-[var(--status-warn-text)] mt-1">
                    {t('ai_key_expired_warn')}
                  </p>
                )}
                {editingGemini ? (
                  <div className="flex items-center gap-1.5 mt-2">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={editGeminiValue}
                      onChange={(e) => setEditGeminiValue(e.target.value)}
                      placeholder={t('ai_key_gemini_edit_ph')}
                      className="flex-1 px-2 py-1.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent-fill)] focus:ring-2 focus:ring-[var(--accent-fill)]/20 text-[var(--text-primary)]"
                    />
                    <button
                      onClick={() => {
                        if (!editGeminiValue.trim()) { setStatusMessage(t('ai_key_need_update')); setTestStatus('failed'); return; }
                        setApiKey(editGeminiValue.trim());
                        setClientGeminiApiKey(editGeminiValue.trim(), { sessionOnly });
                        setEditingGemini(false);
                        setTestStatus('idle');
                        setStatusMessage(t('ai_key_gemini_updated'));
                      }}
                      className="px-2 py-1.5 text-[11px] font-bold bg-[var(--accent-fill)] text-white rounded-lg"
                    >
                      {t('common_save')}
                    </button>
                    <button
                      onClick={() => setEditingGemini(false)}
                      className="px-2 py-1.5 text-[11px] text-[var(--text-secondary)] border border-[var(--border-default)] rounded-lg"
                    >
                      {t('common_cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <label className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                      {t('ai_key_expires_label')}
                      <input
                        type="date"
                        value={geminiExpiry}
                        onChange={(e) => { setGeminiExpiry(e.target.value); setGeminiKeyExpiry(e.target.value || null); }}
                        className="px-1.5 py-1 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg"
                      />
                    </label>
                    {geminiExpiry && (
                      <button
                        onClick={() => { setGeminiExpiry(''); setGeminiKeyExpiry(null); }}
                        className="text-[11px] text-[var(--text-muted)] hover:underline"
                      >
                        {t('ai_key_clear_date')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {apiKey.trim() && !editingGemini && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title={t('ai_key_edit_title')}
                    aria-label={t('ai_key_edit_title')}
                    onClick={() => { setEditGeminiValue(apiKey); setEditingGemini(true); }}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] rounded-lg border border-transparent hover:border-[var(--border-default)]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title={t('ai_key_gemini_delete_title')}
                    aria-label={t('ai_key_gemini_delete_title')}
                    onClick={handleClear}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-rose-600 hover:bg-[var(--bg-hover)] rounded-lg border border-transparent hover:border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-[var(--border-default)]" />

            {/* Groq row */}
            <div className="flex items-start justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{t('ai_key_groq_name')}</span>
                  {groqKey.trim() ? (
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">{maskApiKey(groqKey)}</span>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">{t('ai_key_not_configured')}</span>
                  )}
                  {expiryBadge(groqExpiryStatus)}
                </div>
                {groqExpiryStatus.state === 'expired' && (
                  <p className="text-[11px] text-[var(--status-warn-text)] mt-1">
                    {t('ai_key_expired_warn')}
                  </p>
                )}
                {editingGroq ? (
                  <div className="flex items-center gap-1.5 mt-2">
                    <input
                      type={showGroqKey ? 'text' : 'password'}
                      value={editGroqValue}
                      onChange={(e) => setEditGroqValue(e.target.value)}
                      placeholder={t('ai_key_groq_edit_ph')}
                      className="flex-1 px-2 py-1.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent-fill)] focus:ring-2 focus:ring-[var(--accent-fill)]/20 text-[var(--text-primary)]"
                    />
                    <button
                      onClick={() => {
                        if (!editGroqValue.trim()) { setGroqStatusMessage(t('ai_key_need_update')); setGroqTestStatus('failed'); return; }
                        setGroqKey(editGroqValue.trim());
                        setClientGroqApiKey(editGroqValue.trim());
                        setEditingGroq(false);
                        setGroqTestStatus('idle');
                        setGroqStatusMessage(t('ai_key_groq_updated'));
                      }}
                      className="px-2 py-1.5 text-[11px] font-bold bg-[var(--accent-fill)] text-white rounded-lg"
                    >
                      {t('common_save')}
                    </button>
                    <button
                      onClick={() => setEditingGroq(false)}
                      className="px-2 py-1.5 text-[11px] text-[var(--text-secondary)] border border-[var(--border-default)] rounded-lg"
                    >
                      {t('common_cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <label className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                      {t('ai_key_expires_label')}
                      <input
                        type="date"
                        value={groqExpiry}
                        onChange={(e) => { setGroqExpiry(e.target.value); setGroqKeyExpiry(e.target.value || null); }}
                        className="px-1.5 py-1 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg"
                      />
                    </label>
                    {groqExpiry && (
                      <button
                        onClick={() => { setGroqExpiry(''); setGroqKeyExpiry(null); }}
                        className="text-[11px] text-[var(--text-muted)] hover:underline"
                      >
                        {t('ai_key_clear_date')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {groqKey.trim() && !editingGroq && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title={t('ai_key_edit_title')}
                    aria-label={t('ai_key_edit_title')}
                    onClick={() => { setEditGroqValue(groqKey); setEditingGroq(true); }}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] rounded-lg border border-transparent hover:border-[var(--border-default)]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title={t('ai_key_groq_delete_title')}
                    aria-label={t('ai_key_groq_delete_title')}
                    onClick={handleClearGroq}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-rose-600 hover:bg-[var(--bg-hover)] rounded-lg border border-transparent hover:border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              {t('ai_key_gemini_label')}
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-10 py-2.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] focus:ring-2 focus:ring-[var(--accent-fill)]/20 text-[var(--text-primary)]"
              />
              <button
                type="button"
                aria-label={showKey ? t('ai_key_hide') : t('ai_key_show')}
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              {t('ai_key_groq_label')} <span className="font-normal text-[var(--text-muted)]">{t('ai_key_groq_fallback_hint')}</span>
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showGroqKey ? 'text' : 'password'}
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full pl-9 pr-10 py-2.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] focus:ring-2 focus:ring-[var(--accent-fill)]/20 text-[var(--text-primary)]"
              />
              <button
                type="button"
                aria-label={showGroqKey ? t('ai_key_hide') : t('ai_key_show')}
                onClick={() => setShowGroqKey(!showGroqKey)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleTestGroq}
                disabled={isTestingGroq || !groqKey.trim()}
                className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isTestingGroq ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
                <span>{isTestingGroq ? t('ai_key_verifying') : t('ai_key_groq_test_btn')}</span>
              </button>
              <button
                onClick={handleSaveGroq}
                className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
              >
                {t('ai_key_save_groq_btn')}
              </button>
              {groqKey.trim() && (
                <button
                  type="button"
                  onClick={handleClearGroq}
                  className="text-rose-600 hover:underline font-medium cursor-pointer text-[11px]"
                >
                  {t('ai_key_remove')}
                </button>
              )}
            </div>
            {groqStatusMessage && (
              <div
                className={`mt-2 p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                  groqTestStatus === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : groqTestStatus === 'failed'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}
              >
                {groqTestStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />}
                {groqTestStatus === 'failed' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />}
                <span className="break-words">{groqStatusMessage}</span>
              </div>
            )}
          </div>

          {/* Daily quota progress bar — surfaced before error (50/day) */}
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>{t('ai_key_quota_title')}</span>
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">{t('ai_key_quota_stats', { used: quota.used, limit: quota.limit, remaining: quota.remaining })}</span>
            </div>
            <div className="h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border-default)]">
              <div className="h-full bg-[var(--accent-fill)] transition-all" style={{ width: `${Math.min(100, (quota.used/quota.limit)*100)}%` }} />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('ai_key_quota_note')}</p>
          </div>

          {/* Test Status Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testStatus === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : testStatus === 'failed'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              }`}
            >
              {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
              {testStatus === 'failed' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
              {testStatus === 'idle' && <Sparkles className="w-4 h-4 shrink-0 text-[var(--status-warn-text)]" />}
              <span className="break-words">{statusMessage}</span>
            </div>
          )}
          {/* sessionStorage option */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
            <input type="checkbox" id="sessionOnly" checked={sessionOnly} onChange={(e)=>{
              setSessionOnly(e.target.checked);
              if (apiKey.trim()) setClientGeminiApiKey(apiKey, { sessionOnly: e.target.checked });
            }} />
            <label htmlFor="sessionOnly">{t('ai_key_session_only')}</label>
          </div>

          <div className="pt-1 flex items-center justify-between text-xs">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent-text)] hover:underline font-semibold flex items-center gap-1"
            >
              <span>{t('ai_key_get_free')}</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 hover:underline font-medium cursor-pointer"
              >
                {t('ai_key_remove_key')}
              </button>
            )}
          </div>

          <OfflineAiStorageCard />
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            {t('common_cancel')}
          </button>

          <button
            onClick={handleTest}
            disabled={isTesting || !apiKey.trim()}
            className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
            <span>{isTesting ? t('ai_key_verifying') : t('ai_key_test_btn')}</span>
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            {t('ai_key_save_btn')}
          </button>
        </div>
      </div>
    </div>
  );
};
