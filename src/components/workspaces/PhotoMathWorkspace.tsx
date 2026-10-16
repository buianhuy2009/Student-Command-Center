import React, { useRef, useState } from 'react';
import { Zap, UploadCloud, Sparkles, Copy, Check, AlertTriangle, CheckCircle2, Loader2, Keyboard } from 'lucide-react';
import { MathMarkdown } from '../MathMarkdown';
import { MathDebugResult } from '../../types';
import { t, useLang } from '../../services/i18n';

// --- Photo Math fast-vision: client compress + single Gemini vision call ---------
const MAX_IMAGE_DIM = 1600;
const JPEG_QUALITY = 0.82;
const VISION_TIMEOUT_MS = 60000;

function getGeminiKey(): string {
  try {
    const local = localStorage.getItem('scc_gemini_api_key') || '';
    if (local.trim()) return local.trim();
  } catch { /* ignore */ }
  try {
    const sess = sessionStorage.getItem('scc_gemini_api_key_session') || '';
    if (sess.trim()) return sess.trim();
  } catch { /* ignore */ }
  try {
    const env = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || '';
    if (typeof env === 'string' && env.trim()) return env.trim();
  } catch { /* ignore */ }
  return '';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that photo. Try a different file.'));
    reader.readAsDataURL(file);
  });
}

interface CompressedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  sizeKB: number;
}

/** Downscale/compress client-side so we never upload a 12MP phone photo. */
function downscaleImage(sourceDataUrl: string): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_IMAGE_DIM / img.naturalWidth, MAX_IMAGE_DIM / img.naturalHeight);
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('This browser blocked photo compression. Try typing the expression below instead.'));
          return;
        }
        // Flatten transparency onto white so JPEG math stays legible.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const sizeKB = Math.round((base64.length * 3) / 4 / 1024);
        resolve({ dataUrl, base64, mimeType: 'image/jpeg', width, height, sizeKB });
      } catch (e: any) {
        reject(new Error(e?.message || 'Photo compression failed. Try a smaller photo or type the expression below.'));
      }
    };
    img.onerror = () => reject(new Error('That file is not a readable image. Try a JPG/PNG photo or type the expression below.'));
    img.src = sourceDataUrl;
  });
}

function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new Error('unparseable');
  }
}

interface VisionAnswer {
  latex?: string;
  explanation?: string;
  steps?: string[];
  hasError?: boolean;
  errorDescription?: string;
  socraticHint?: string;
}

async function callGeminiVision(base64: string, mimeType: string, key: string): Promise<VisionAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const prompt = `Read this photo of handwritten math. Return strict JSON only (no markdown fences):
{"latex":"clean LaTeX of the main equation(s)","explanation":"1 sentence on what it is","steps":["Step 1: ...","Step 2: ..."],"hasError":false,"errorDescription":"","socraticHint":""}` +
      ` Rules: steps = short 2-6 solution steps solving what is shown (not describing the photo). If you spot an algebraic/sign/arithmetic slip, set hasError true and fill errorDescription + socraticHint (hint only, never the final answer).`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini vision rejected the photo (HTTP ${res.status}). ${body.slice(0, 160)}`.trim());
    }
    const json = await res.json().catch(() => ({} as any));
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
    if (!text.trim()) throw new Error('Gemini returned an empty answer. Retake with better lighting or type the expression below.');
    try {
      return parseJsonLoose<VisionAnswer>(text);
    } catch {
      return { latex: text.slice(0, 500), explanation: 'Raw model answer (could not parse steps).', steps: [] };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiText(expression: string, key: string): Promise<VisionAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const prompt = `Solve this math expression step by step: ${expression}\nReturn strict JSON only: {"latex":"clean LaTeX","explanation":"1 sentence","steps":["Step 1: ...","Step 2: ..."],"hasError":false,"errorDescription":"","socraticHint":""}`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt.slice(0, 4000) }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini text solve failed (HTTP ${res.status}).`);
    const json = await res.json().catch(() => ({} as any));
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
    if (!text.trim()) throw new Error('Gemini returned an empty answer.');
    try {
      return parseJsonLoose<VisionAnswer>(text);
    } catch {
      return { latex: expression, explanation: 'Raw model answer.', steps: [text.slice(0, 500)] };
    }
  } finally {
    clearTimeout(timer);
  }
}

export const PhotoMathWorkspace: React.FC = () => {
  useLang();
  const [scribbleImage, setScribbleImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<string>('');
  const payloadRef = useRef<CompressedImage | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [extractedLatex, setExtractedLatex] = useState<{ latex: string; explanation: string } | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [mathDebugResult, setMathDebugResult] = useState<MathDebugResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualExpr, setManualExpr] = useState('');
  const [manualSolving, setManualSolving] = useState(false);
  const [manualResult, setManualResult] = useState<{ latex: string; steps: string[]; note: string } | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setExtractedLatex(null);
    setMathDebugResult(null);
    setSteps([]);
    payloadRef.current = null;
    try {
      const raw = await fileToDataUrl(file);
      // Show instant preview, then compress before any network call.
      setScribbleImage(raw);
      setProgress('Compressing photo…');
      setImageMeta('Compressing…');
      const compressed = await downscaleImage(raw);
      payloadRef.current = compressed;
      setScribbleImage(compressed.dataUrl);
      setImageMeta(`Compressed to ${compressed.width}×${compressed.height} (~${compressed.sizeKB} KB, max ${MAX_IMAGE_DIM}px) — fast upload.`);
    } catch (err: any) {
      setImageMeta('');
      setError(err?.message || 'Could not prepare that photo. Try a smaller JPG/PNG or type the expression below.');
    } finally {
      setProgress('');
    }
    // Allow re-selecting the same file.
    e.target.value = '';
  };

  const handleConvert = async () => {
    if (isConverting) return;
    const payload = payloadRef.current;
    if (!payload) {
      setError('Choose a photo first — or skip the camera and type the expression below.');
      return;
    }
    setIsConverting(true);
    setError(null);
    setExtractedLatex(null);
    setMathDebugResult(null);
    setSteps([]);
    const key = getGeminiKey();
    if (!key) {
      setIsConverting(false);
      setError('No Gemini API key found. Add one in Settings (AI / BYOK) or set VITE_GEMINI_API_KEY, then try again. You can still type the expression below for a preview.');
      return;
    }
    try {
      // Single vision call (was 2 parallel full-size calls) with a 60s cap.
      setProgress('Reading image…');
      const answer = await callGeminiVision(payload.base64, payload.mimeType, key);
      const latex = (answer.latex || '').trim();
      if (!latex) throw new Error('Gemini could not read any math in this photo. Retake closer with better lighting, or type the expression below.');
      setExtractedLatex({ latex, explanation: answer.explanation || 'Extracted from photo.' });
      const stepList = Array.isArray(answer.steps) ? answer.steps.filter(Boolean).slice(0, 12) : [];
      setProgress('Solving…');
      setSteps(stepList);
      setMathDebugResult({
        fullLatex: stepList.length ? stepList : [latex],
        hasError: Boolean(answer.hasError),
        errorDescription: answer.errorDescription || '',
        socraticHint: answer.socraticHint || '',
        solutionDerivationGuidance: stepList,
      });
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      setError(
        isTimeout
          ? 'Timed out after 60s reading the photo. Check your connection, retake closer/clearer, or type the expression below instead.'
          : (err?.message || 'Photo solve failed. Retake the photo or type the expression below.')
      );
    } finally {
      setIsConverting(false);
      setProgress('');
    }
  };

  const handleManualSolve = async () => {
    const expr = manualExpr.trim();
    if (!expr || manualSolving) return;
    setManualSolving(true);
    setManualResult(null);
    const key = getGeminiKey();
    if (!key) {
      // Offline-friendly fallback: render what they typed so the tool still works.
      setManualResult({ latex: expr, steps: [], note: 'No API key — preview only. Add a Gemini key in Settings for step-by-step solving.' });
      setManualSolving(false);
      return;
    }
    try {
      const answer = await callGeminiText(expr, key);
      setManualResult({
        latex: (answer.latex || expr).trim(),
        steps: Array.isArray(answer.steps) ? answer.steps.filter(Boolean).slice(0, 12) : [],
        note: answer.explanation || 'Solved from typed expression.',
      });
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      setManualResult({
        latex: expr,
        steps: [],
        note: isTimeout
          ? 'Timed out after 60s. Showing your expression as a preview — try again.'
          : (err?.message || 'Text solve failed. Showing your expression as a preview.'),
      });
    } finally {
      setManualSolving(false);
    }
  };

  const handleCopy = () => {
    if (!extractedLatex) return;
    navigator.clipboard.writeText(extractedLatex.latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-yellow-500 text-white flex items-center justify-center shadow-md shadow-yellow-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#141413] dark:text-[#FAF9F5]">
                {t('pmath_title')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800">
                {t('pmath_badge')}
              </span>
            </div>
            <p className="text-xs text-[#8C897F] mt-0.5">
              {t('pmath_sub')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Area */}
        <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
          {scribbleImage ? (
            <div className="space-y-4 w-full">
              <img
                src={scribbleImage}
                alt={t('pmath_img_alt')}
                className="max-h-64 mx-auto rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] object-contain shadow-xs"
              />
              {imageMeta && <p className="text-[10px] text-[#8C897F]">{imageMeta}</p>}
              {(isConverting || progress) && (
                <p className="text-xs font-bold text-[#D97757] flex items-center justify-center gap-1.5" role="status">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progress || 'Working…'}</span>
                </p>
              )}
              <div className="flex justify-center gap-2">
                <label className="px-4 py-2 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs font-bold cursor-pointer">
                  {t('pmath_change_photo')}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <button
                  onClick={handleConvert}
                  disabled={isConverting}
                  className="px-5 py-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isConverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isConverting ? (progress || t('pmath_reading')) : t('pmath_extract')}</span>
                </button>
              </div>
            </div>
          ) : (
            <label className="w-full border-2 border-dashed border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors space-y-3">
              <UploadCloud className="w-10 h-10 text-[#D97757]" />
              <div>
                <span className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] block">
                  {t('pmath_drop_title')}
                </span>
                <span className="text-[10px] text-[#8C897F] block mt-0.5">
                  {t('pmath_drop_sub')}
                </span>
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}

          {/* Manual-expression fallback: always available, even with no photo/key */}
          <div className="w-full p-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] text-left space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897F] flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              <span>No photo? Type it instead</span>
            </span>
            <div className="flex gap-2">
              <input
                value={manualExpr}
                onChange={(e) => setManualExpr(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualSolve(); }}
                placeholder="e.g. integrate x*e^x dx"
                className="flex-1 px-3 py-2 rounded-xl border border-[#DFDACB] dark:border-[#2C2B27] bg-white dark:bg-[#1A1917] text-xs text-[#141413] dark:text-[#FAF9F5] outline-none focus:border-[#D97757]"
              />
              <button
                onClick={handleManualSolve}
                disabled={manualSolving || !manualExpr.trim()}
                className="px-4 py-2 bg-[#141413] dark:bg-[#FAF9F5] text-[#FAF9F5] dark:text-[#141413] rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                {manualSolving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{manualSolving ? 'Solving…' : 'Solve'}</span>
              </button>
            </div>
            {manualResult && (
              <div className="p-3 bg-white dark:bg-[#1A1917] rounded-xl border border-[#DFDACB]/60 dark:border-[#2C2B27]/60 space-y-2">
                <MathMarkdown>{`$$${manualResult.latex}$$`}</MathMarkdown>
                {manualResult.steps.length > 0 && (
                  <ol className="list-decimal ml-4 space-y-1 text-xs text-[#141413] dark:text-[#FAF9F5]">
                    {manualResult.steps.map((s, i) => (
                      <li key={i}><MathMarkdown>{s}</MathMarkdown></li>
                    ))}
                  </ol>
                )}
                <p className="text-[10px] text-[#8C897F]">{manualResult.note}</p>
              </div>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C897F] block mb-3">
              {t('pmath_results')}
            </span>

            {error && (
              <div className="mb-4 p-4 rounded-2xl border text-xs space-y-1 bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300" role="alert">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Photo Math could not finish</span>
                </div>
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {isConverting && (
              <div className="mb-4 p-4 rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#1F1E1B] text-xs flex items-center gap-2" role="status">
                <Loader2 className="w-4 h-4 animate-spin text-[#D97757]" />
                <span className="font-bold">{progress || 'Working…'} (max 60s — use the type-in box on the left if this is slow)</span>
              </div>
            )}

            {extractedLatex ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#8C897F] uppercase">
                      {t('pmath_latex_formula')}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="text-xs text-[#D97757] font-bold hover:underline flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? t('copied') : t('copy')}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-[#D97757] overflow-x-auto whitespace-pre-wrap">
                    {extractedLatex.latex}
                  </pre>
                  <div className="p-3 bg-white dark:bg-[#1A1917] rounded-xl border border-[#DFDACB]/60 dark:border-[#2C2B27]/60 text-xs text-[#141413] dark:text-[#FAF9F5]">
                    <MathMarkdown>
                      {/\$/.test(extractedLatex.latex)
                        ? extractedLatex.latex
                        : `$$${extractedLatex.latex}$$`}
                    </MathMarkdown>
                  </div>
                  <p className="text-[10px] text-[#8C897F]">{extractedLatex.explanation}</p>
                </div>

                {steps.length > 0 && (
                  <div className="p-4 bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] space-y-2">
                    <span className="text-[10px] font-bold text-[#8C897F] uppercase">Step-by-step solution</span>
                    <ol className="list-decimal ml-4 space-y-1.5 text-xs text-[#141413] dark:text-[#FAF9F5]">
                      {steps.map((s, i) => (
                        <li key={i} className="leading-relaxed"><MathMarkdown>{s}</MathMarkdown></li>
                      ))}
                    </ol>
                  </div>
                )}

                {mathDebugResult && (
                  <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                    mathDebugResult.hasError
                      ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      {mathDebugResult.hasError ? <AlertTriangle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      <span>{mathDebugResult.hasError ? t('pmath_issue') : t('pmath_valid')}</span>
                    </div>
                    <div className="text-xs leading-relaxed">
                      <MathMarkdown>
                        {mathDebugResult.errorDescription || mathDebugResult.socraticHint || t('pmath_all_match')}
                      </MathMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !isConverting && (
                <div className="py-16 text-center text-xs text-[#8C897F]">
                  {t('pmath_empty')}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
