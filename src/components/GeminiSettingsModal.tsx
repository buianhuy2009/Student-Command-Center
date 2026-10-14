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

  const quota = getGeminiQuotaStatus();
  useEffect(() => {
    if (isOpen) {
      const saved = getClientGeminiApiKey();
      const savedGroq = getClientGroqApiKey();
      setApiKey(saved);
      setGroqKey(savedGroq);
      setTestStatus(saved ? 'success' : 'idle');
      setStatusMessage(saved ? 'API Key configured. Plaintext warning: key visible to site scripts — use Vault PIN or sessionStorage for better security.' : '');
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
  }, [isOpen]);

  if (!isOpen) return null;

  const geminiExpiryStatus = getExpiryStatus(geminiExpiry);
  const groqExpiryStatus = getExpiryStatus(groqExpiry);

  const handleSave = () => {
    setClientGeminiApiKey(apiKey, { sessionOnly });
    if (apiKey.trim() && editingGemini) setEditingGemini(false);
    setTestStatus('idle');
    setStatusMessage(apiKey.trim() ? 'Key saved locally.' : 'API Key removed.');
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleSaveGroq = () => {
    setClientGroqApiKey(groqKey);
    if (groqKey.trim() && editingGroq) setEditingGroq(false);
    setGroqTestStatus('idle');
    setGroqStatusMessage(groqKey.trim() ? 'Groq key saved locally.' : 'Groq key removed.');
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestStatus('failed');
      setStatusMessage('Please enter an API key first.');
      return;
    }

    setIsTesting(true);
    setTestStatus('idle');
    setStatusMessage('Testing connection to Gemini 2.5 Flash (fallback 2.0 Flash)...');

    const result = await testGeminiApiKeyDetailed(apiKey);
    setIsTesting(false);
    if (result.ok) {
      setTestStatus('success');
      setStatusMessage(`Connection verified${result.model ? ` via ${result.model}` : ''}! Ready for deep multimodal & schema inference.`);
      setClientGeminiApiKey(apiKey, { sessionOnly });
    } else {
      setTestStatus('failed');
      // Surface the REAL provider error text — never silent fail.
      setStatusMessage(result.error || 'Connection failed. Please check your API key.');
    }
  };

  const handleTestGroq = async () => {
    if (!groqKey.trim()) {
      setGroqTestStatus('failed');
      setGroqStatusMessage('Please enter a Groq API key first.');
      return;
    }
    setIsTestingGroq(true);
    setGroqTestStatus('idle');
    setGroqStatusMessage('Testing Groq connection...');
    const result = await testGroqApiKeyDetailed(groqKey);
    setIsTestingGroq(false);
    if (result.ok) {
      setGroqTestStatus('success');
      setGroqStatusMessage('Groq connection verified!');
      setClientGroqApiKey(groqKey);
    } else {
      setGroqTestStatus('failed');
      setGroqStatusMessage(result.error || 'Groq connection failed.');
    }
  };

  const handleClear = () => {
    setApiKey('');
    setClientGeminiApiKey('');
    setEditingGemini(false);
    setTestStatus('idle');
    setStatusMessage('API Key removed.');
  };

  const handleClearGroq = () => {
    setGroqKey('');
    setClientGroqApiKey('');
    try { localStorage.removeItem('scc_groq_api_key'); } catch {}
    setEditingGroq(false);
    setGroqTestStatus('idle');
    setGroqStatusMessage('Groq key removed.');
  };

  const expiryBadge = (s: ReturnType<typeof getExpiryStatus>) => {
    if (s.state === 'none') return null;
    const cls =
      s.state === 'expired'
        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
        : s.state === 'expiring'
        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
        : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#141413]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A1917] rounded-3xl max-w-lg w-full border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between bg-[#FAF9F5] dark:bg-[#1F1E1B]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-[#D97757] to-rose-500 text-white flex items-center justify-center shadow-md shadow-[#D97757]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
                AI Engine &amp; API Key Settings
              </h3>
              <p className="text-xs text-[#8C897F]">
                Dual-Provider Engine: Google Gemini + Groq LLaMA 3.3 70B Fallback
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-[#8C897F] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] flex items-start gap-2.5 text-xs text-[#5C5A54] dark:text-[#B5B2A8]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-[#141413] dark:text-[#FAF9F5] block mb-0.5">
                Encrypted Vault • PBKDF2 + AES-GCM
              </span>
              {vaultLocked ? 'Vault locked: keys encrypted with your PIN. Enter PIN to decrypt.' : 'Set a PIN to encrypt your Gemini/Groq keys locally. Protects against XSS & extension reads.'}
              <div className="flex items-center gap-2 mt-2">
                <input type="password" value={vaultPin} onChange={e=>setVaultPin(e.target.value)} placeholder="Vault PIN (min 4 chars)" className="px-2 py-1 text-xs bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg w-40" />
                {!vaultLocked ? (
                  <button onClick={async()=>{
                    if(vaultPin.length<4){ setStatusMessage('PIN too short'); setTestStatus('failed'); return; }
                    await vaultSet(vaultPin, { gemini: apiKey, groq: localStorage.getItem('scc_groq_api_key')||'' });
                    setVaultLocked(true); setStatusMessage('Vault encrypted & locked. Raw keys removed from localStorage.'); setTestStatus('success');
                    localStorage.removeItem('scc_gemini_api_key'); localStorage.removeItem('scc_groq_api_key');
                  }} className="px-2 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg">Encrypt & Lock</button>
                ) : (
                  <>
                    <button onClick={async()=>{
                      const data = await vaultGet(vaultPin);
                      if(!data){ setStatusMessage('Wrong PIN or vault corrupt'); setTestStatus('failed'); return; }
                      if(data.gemini) { setApiKey(data.gemini); setClientGeminiApiKey(data.gemini); }
                      if(data.groq) try{ localStorage.setItem('scc_groq_api_key', data.groq); }catch{}
                      if(data.groq) setGroqKey(data.groq);
                      setVaultLocked(false); setStatusMessage('Vault unlocked & keys restored to session.'); setTestStatus('success');
                    }} className="px-2 py-1 text-xs font-bold bg-[#D97757] text-white rounded-lg">Unlock</button>
                    <button onClick={()=>{ vaultClear(); setVaultLocked(false); setStatusMessage('Vault cleared.'); setTestStatus('idle'); }} className="px-2 py-1 text-xs text-rose-600 border border-rose-200 rounded-lg">Clear Vault</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Key manager: masked list with per-key Edit / Delete + expiry */}
          <div className="p-3.5 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] space-y-3">
            <p className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">Configured keys</p>

            {/* Gemini row */}
            <div className="flex items-start justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">Gemini</span>
                  {apiKey.trim() ? (
                    <span className="font-mono text-[11px] text-[#6B6860]">{maskApiKey(apiKey)}</span>
                  ) : (
                    <span className="text-[11px] text-[#8C897F]">Not configured</span>
                  )}
                  {expiryBadge(geminiExpiryStatus)}
                </div>
                {geminiExpiryStatus.state === 'expired' && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    This key is past its expiration date. It will still be used (not blocked), but consider rotating it.
                  </p>
                )}
                {editingGemini ? (
                  <div className="flex items-center gap-1.5 mt-2">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={editGeminiValue}
                      onChange={(e) => setEditGeminiValue(e.target.value)}
                      placeholder="Paste updated Gemini key"
                      className="flex-1 px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                    />
                    <button
                      onClick={() => {
                        if (!editGeminiValue.trim()) { setStatusMessage('Paste the updated key first.'); setTestStatus('failed'); return; }
                        setApiKey(editGeminiValue.trim());
                        setClientGeminiApiKey(editGeminiValue.trim(), { sessionOnly });
                        setEditingGemini(false);
                        setTestStatus('idle');
                        setStatusMessage('Gemini key updated in place.');
                      }}
                      className="px-2 py-1.5 text-[11px] font-bold bg-[#D97757] text-white rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingGemini(false)}
                      className="px-2 py-1.5 text-[11px] text-[#5C5A54] dark:text-[#B5B2A8] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <label className="text-[11px] text-[#6B6860] flex items-center gap-1">
                      Expires:
                      <input
                        type="date"
                        value={geminiExpiry}
                        onChange={(e) => { setGeminiExpiry(e.target.value); setGeminiKeyExpiry(e.target.value || null); }}
                        className="px-1.5 py-1 text-[11px] bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg"
                      />
                    </label>
                    {geminiExpiry && (
                      <button
                        onClick={() => { setGeminiExpiry(''); setGeminiKeyExpiry(null); }}
                        className="text-[11px] text-[#8C897F] hover:underline"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                )}
              </div>
              {apiKey.trim() && !editingGemini && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Edit key in place"
                    onClick={() => { setEditGeminiValue(apiKey); setEditingGemini(true); }}
                    className="p-1.5 text-[#6B6860] hover:text-[#D97757] hover:bg-white dark:hover:bg-[#252422] rounded-lg border border-transparent hover:border-[#DFDACB] dark:hover:border-[#2C2B27]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Delete Gemini key"
                    onClick={handleClear}
                    className="p-1.5 text-[#6B6860] hover:text-rose-600 hover:bg-white dark:hover:bg-[#252422] rounded-lg border border-transparent hover:border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-[#DFDACB] dark:bg-[#2C2B27]" />

            {/* Groq row */}
            <div className="flex items-start justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">Groq</span>
                  {groqKey.trim() ? (
                    <span className="font-mono text-[11px] text-[#6B6860]">{maskApiKey(groqKey)}</span>
                  ) : (
                    <span className="text-[11px] text-[#8C897F]">Not configured</span>
                  )}
                  {expiryBadge(groqExpiryStatus)}
                </div>
                {groqExpiryStatus.state === 'expired' && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    This key is past its expiration date. It will still be used (not blocked), but consider rotating it.
                  </p>
                )}
                {editingGroq ? (
                  <div className="flex items-center gap-1.5 mt-2">
                    <input
                      type={showGroqKey ? 'text' : 'password'}
                      value={editGroqValue}
                      onChange={(e) => setEditGroqValue(e.target.value)}
                      placeholder="Paste updated Groq key"
                      className="flex-1 px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                    />
                    <button
                      onClick={() => {
                        if (!editGroqValue.trim()) { setGroqStatusMessage('Paste the updated key first.'); setGroqTestStatus('failed'); return; }
                        setGroqKey(editGroqValue.trim());
                        setClientGroqApiKey(editGroqValue.trim());
                        setEditingGroq(false);
                        setGroqTestStatus('idle');
                        setGroqStatusMessage('Groq key updated in place.');
                      }}
                      className="px-2 py-1.5 text-[11px] font-bold bg-[#D97757] text-white rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingGroq(false)}
                      className="px-2 py-1.5 text-[11px] text-[#5C5A54] dark:text-[#B5B2A8] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <label className="text-[11px] text-[#6B6860] flex items-center gap-1">
                      Expires:
                      <input
                        type="date"
                        value={groqExpiry}
                        onChange={(e) => { setGroqExpiry(e.target.value); setGroqKeyExpiry(e.target.value || null); }}
                        className="px-1.5 py-1 text-[11px] bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg"
                      />
                    </label>
                    {groqExpiry && (
                      <button
                        onClick={() => { setGroqExpiry(''); setGroqKeyExpiry(null); }}
                        className="text-[11px] text-[#8C897F] hover:underline"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                )}
              </div>
              {groqKey.trim() && !editingGroq && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Edit key in place"
                    onClick={() => { setEditGroqValue(groqKey); setEditingGroq(true); }}
                    className="p-1.5 text-[#6B6860] hover:text-[#D97757] hover:bg-white dark:hover:bg-[#252422] rounded-lg border border-transparent hover:border-[#DFDACB] dark:hover:border-[#2C2B27]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Delete Groq key"
                    onClick={handleClearGroq}
                    className="p-1.5 text-[#6B6860] hover:text-rose-600 hover:bg-white dark:hover:bg-[#252422] rounded-lg border border-transparent hover:border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#141413] dark:text-[#FAF9F5] mb-1">
              Google Gemini API Key
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-10 py-2.5 text-xs font-mono bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#141413] dark:text-[#FAF9F5] mb-1">
              Groq API Key <span className="font-normal text-[#8C897F]">(fallback provider)</span>
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showGroqKey ? 'text' : 'password'}
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full pl-9 pr-10 py-2.5 text-xs font-mono bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
              />
              <button
                type="button"
                onClick={() => setShowGroqKey(!showGroqKey)}
                className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleTestGroq}
                disabled={isTestingGroq || !groqKey.trim()}
                className="px-3 py-1.5 bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isTestingGroq ? 'animate-spin text-[#D97757]' : ''}`} />
                <span>{isTestingGroq ? 'Verifying...' : 'Test Groq'}</span>
              </button>
              <button
                onClick={handleSaveGroq}
                className="px-3 py-1.5 bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
              >
                Save Groq Key
              </button>
              {groqKey.trim() && (
                <button
                  type="button"
                  onClick={handleClearGroq}
                  className="text-rose-600 hover:underline font-medium cursor-pointer text-[11px]"
                >
                  Remove
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
          <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Daily Gemini quota</span>
              <span className="font-mono text-[11px] text-[#6B6860]">{quota.used} / {quota.limit} used • {quota.remaining} left</span>
            </div>
            <div className="h-2 bg-white dark:bg-[#252422] rounded-full overflow-hidden border border-[#DFDACB] dark:border-[#2C2B27]">
              <div className="h-full bg-[#D97757] transition-all" style={{ width: `${Math.min(100, (quota.used/quota.limit)*100)}%` }} />
            </div>
            <p className="text-[11px] text-[#6B6860]">Resets midnight UTC. Prevents burn from parallel email summarize.</p>
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
              {testStatus === 'idle' && <Sparkles className="w-4 h-4 shrink-0 text-amber-600" />}
              <span className="break-words">{statusMessage}</span>
            </div>
          )}
          {/* sessionStorage option */}
          <div className="flex items-center gap-2 text-[11px] text-[#6B6860]">
            <input type="checkbox" id="sessionOnly" checked={sessionOnly} onChange={(e)=>{
              setSessionOnly(e.target.checked);
              if (apiKey.trim()) setClientGeminiApiKey(apiKey, { sessionOnly: e.target.checked });
            }} />
            <label htmlFor="sessionOnly">Store key in sessionStorage only (cleared on tab close, more secure)</label>
          </div>

          <div className="pt-1 flex items-center justify-between text-xs">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[#D97757] hover:underline font-semibold flex items-center gap-1"
            >
              <span>Get a free API key at Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 hover:underline font-medium cursor-pointer"
              >
                Remove Key
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#1F1E1B] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleTest}
            disabled={isTesting || !apiKey.trim()}
            className="px-4 py-2 bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-[#D97757]' : ''}`} />
            <span>{isTesting ? 'Verifying...' : 'Test Connection'}</span>
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
};
