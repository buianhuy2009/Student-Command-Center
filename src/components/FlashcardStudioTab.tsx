import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Brain,
  AlertTriangle,
} from 'lucide-react';
import { calculateSM2, ReviewQuality, SRSCard } from '../services/srsEngine';
import { useT } from '../services/i18n';
import {
  FLASHCARD_DECKS_EVENT,
  clearFocusedDeckId,
  loadFlashcardDecks,
  peekFocusedDeckId,
  saveFlashcardDecks as saveDecks,
  type CardDeck,
  type Flashcard,
} from '../services/flashcardDecks';
import { FlashcardCountField, MAX_GENERATED_CARDS, parseCardCount } from './FlashcardCountField';

export type { Flashcard, CardDeck };

const LOCAL_GEN_COUNT_KEY = 'scc_flashcard_gencount_v1';
const LOCAL_SESSION_LIMIT_KEY = 'scc_flashcard_session_limit_v1';

function loadGenCount(): number {
  try {
    const raw = localStorage.getItem(LOCAL_GEN_COUNT_KEY);
    if (raw !== null) {
      const n = parseCardCount(raw);
      if (n !== null) return n;
    }
  } catch (e) {
    console.error('Error loading flashcard gen count:', e);
  }
  return 8;
}

function loadSessionLimit(): number | 'all' {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_LIMIT_KEY);
    if (raw === null || raw === 'all') return 'all';
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n) && n >= 1 && n <= 500) return n;
  } catch (e) {
    console.error('Error loading flashcard session limit:', e);
  }
  return 'all';
}

export const FlashcardStudioTab: React.FC = () => {
  const { t, formatDate } = useT();
  const [decks, setDecks] = useState<CardDeck[]>(loadFlashcardDecks);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(() => {
    const saved = loadFlashcardDecks();
    const focused = peekFocusedDeckId();
    if (focused && saved.some((deck) => deck.id === focused)) return focused;
    return saved.length > 0 ? saved[0].id : null;
  });

  // Pick up decks created elsewhere (lectures, AI Coach) while this tab is open.
  useEffect(() => {
    clearFocusedDeckId();
    const reload = () => {
      const next = loadFlashcardDecks();
      setDecks(next);
      const focused = peekFocusedDeckId();
      if (focused && next.some((deck) => deck.id === focused)) {
        setActiveDeckId(focused);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        clearFocusedDeckId();
      }
    };
    window.addEventListener(FLASHCARD_DECKS_EVENT, reload);
    return () => window.removeEventListener(FLASHCARD_DECKS_EVENT, reload);
  }, []);

  // Generator State
  const [genTopic, setGenTopic] = useState('');
  const [genSubject, setGenSubject] = useState('');
  const [genNotes, setGenNotes] = useState('');
  const [genCount, setGenCount] = useState<number>(loadGenCount);
  const [genCountInput, setGenCountInput] = useState<string>(() => String(loadGenCount()));
  const [genNotice, setGenNotice] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Per-session review limit (presets + custom, persisted, default All)
  const [sessionLimit, setSessionLimit] = useState<number | 'all'>(loadSessionLimit);
  const [customSessionInput, setCustomSessionInput] = useState<string>(() => {
    const stored = loadSessionLimit();
    return typeof stored === 'number' && ![10, 20, 50].includes(stored) ? String(stored) : '';
  });

  // Study Mode & TSV Import/Export State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [copiedTsv, setCopiedTsv] = useState(false);
  const [downloadedTsv, setDownloadedTsv] = useState(false);
  const [showTsvImport, setShowTsvImport] = useState(false);
  const [tsvTitle, setTsvTitle] = useState('');
  const [tsvText, setTsvText] = useState('');
  const [tsvImportError, setTsvImportError] = useState<string | null>(null);

  const sortedCards = React.useMemo(() => {
    if (!decks.find(d => d.id === activeDeckId)) return [];
    const deck = decks.find(d => d.id === activeDeckId);
    if (!deck) return [];
    const today = new Date().toISOString().split('T')[0];
    return [...deck.cards].sort((a, b) => {
      const aOverdue = a.dueDate && a.dueDate < today ? 0 : 1;
      const bOverdue = b.dueDate && b.dueDate < today ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const aDue = a.dueDate || '9999-12-31';
      const bDue = b.dueDate || '9999-12-31';
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return (a.repetitions || 0) - (b.repetitions || 0);
    });
  }, [decks, activeDeckId]);

  const activeDeck = decks.find((d) => d.id === activeDeckId) || null;
  // genCount already flows into the AI prompt (Generate ${genCount} ...) — persist it so it survives reload.
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_GEN_COUNT_KEY, String(genCount));
    } catch (e) {
      console.error('Error saving flashcard gen count:', e);
    }
  }, [genCount]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_SESSION_LIMIT_KEY, sessionLimit === 'all' ? 'all' : String(sessionLimit));
    } catch (e) {
      console.error('Error saving flashcard session limit:', e);
    }
  }, [sessionLimit]);

  const sessionCards = React.useMemo(() => {
    if (sessionLimit === 'all') return sortedCards;
    return sortedCards.slice(0, sessionLimit);
  }, [sortedCards, sessionLimit]);

  // Keep the review index inside the capped session window.
  useEffect(() => {
    if (currentCardIndex >= sessionCards.length && sessionCards.length > 0) {
      setCurrentCardIndex(0);
      setIsFlipped(false);
    }
  }, [sessionCards.length, currentCardIndex]);

  const displayDeck = activeDeck ? { ...activeDeck, cards: sessionCards } as CardDeck : null;
  const currentCard = displayDeck && displayDeck.cards.length > 0 ? displayDeck.cards[Math.min(currentCardIndex, displayDeck.cards.length - 1)] : null;

  const queueSummary = React.useMemo(() => {
    if (!activeDeck) return { due: 0, new: 0, learning: 0 };
    const today = new Date().toISOString().split('T')[0];
    let due = 0, isNew = 0, learning = 0;
    activeDeck.cards.forEach(c => {
      if (!c.dueDate || c.dueDate <= today) due++;
      if ((c.repetitions || 0) === 0) isNew++;
      else if (!c.mastered) learning++;
    });
    return { due, new: isNew, learning };
  }, [activeDeck]);

  // Keyboard navigation for flashcard review
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }
      if (!displayDeck || displayDeck.cards.length === 0) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayDeck, currentCardIndex]);

  const handleNextCard = () => {
    if (!displayDeck) return;
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1 < displayDeck.cards.length ? prev + 1 : 0));
  };

  const handlePrevCard = () => {
    if (!displayDeck) return;
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 >= 0 ? prev - 1 : displayDeck.cards.length - 1));
  };

  const handleToggleMastered = () => {
    if (!activeDeck || !currentCard) return;
    const updatedCards = activeDeck.cards.map((c) =>
      c.id === currentCard.id ? { ...c, mastered: !c.mastered } : c
    );
    const updatedDeck = { ...activeDeck, cards: updatedCards };
    const updatedDecks = decks.map((d) => (d.id === activeDeck.id ? updatedDeck : d));
    setDecks(updatedDecks);
    saveDecks(updatedDecks);
  };

  const handleGenerateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim()) return;

    const requested = parseCardCount(genCountInput);
    if (requested === null) {
      setGenError(t('flashcards_count_invalid', { max: MAX_GENERATED_CARDS }));
      return;
    }

    setIsGenerating(true);
    setGenError(null);
    setGenNotice(null);
    try {
      const res = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate exactly ${requested} high-yield study flashcards for a student on the topic "${genTopic}".
Subject: ${genSubject || 'Academic'}
Context/Notes: ${genNotes || 'Cover key definitions, equations, theorems, and core concepts'}

Return ONLY a valid JSON array where each object has "front" (Question, Term, or Formula) and "back" (Clear, concise answer or definition).
Example format:
[
  { "front": "Mitochondria", "back": "The powerhouse of the cell, responsible for ATP synthesis via cellular respiration." }
]`,
            },
          ],
          context: { tool: 'flashcards', topic: genTopic },
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as any));
        throw new Error(errBody?.error || `Generation failed (HTTP ${res.status}).`);
      }
      const data = await res.json();
      const reply = data.reply || '';

      const jsonMatch = reply.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) {
        throw new Error(t('flashcards_gen_bad_format'));
      }

      const rawArray = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(rawArray) || rawArray.length === 0) {
        throw new Error(t('flashcards_gen_empty'));
      }

      const parsedCards: Flashcard[] = rawArray
        .filter((item: any) => item && (item.front || item.back))
        .slice(0, requested)
        .map((item: any, i: number) => ({
          id: `card-${Date.now()}-${i}`,
          front: String(item.front || 'Term'),
          back: String(item.back || 'Definition'),
          mastered: false,
        }));

      if (parsedCards.length === 0) {
        throw new Error(t('flashcards_gen_empty_parsed'));
      }

      const newDeck: CardDeck = {
        id: `deck-${Date.now()}`,
        title: genTopic.trim(),
        subject: genSubject.trim() || 'General',
        cards: parsedCards,
        createdAt: formatDate(new Date()),
      };

      const updated = [newDeck, ...decks];
      setDecks(updated);
      saveDecks(updated);
      setActiveDeckId(newDeck.id);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      if (parsedCards.length < requested) {
        setGenNotice(t('flashcards_gen_fewer', { got: parsedCards.length, want: requested }));
      }

      setGenTopic('');
      setGenSubject('');
      setGenNotes('');
    } catch (err: any) {
      console.error('Error generating flashcards:', err);
      setGenError(err?.message || t('flashcards_gen_err'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteDeck = (id: string) => {
    const updated = decks.filter((d) => d.id !== id);
    setDecks(updated);
    saveDecks(updated);
    if (activeDeckId === id) {
      setActiveDeckId(updated.length > 0 ? updated[0].id : null);
      setCurrentCardIndex(0);
    }
  };

  const handleRateCard = (quality: ReviewQuality) => {
    if (!activeDeck || !currentCard) return;

    const srsCard: SRSCard = {
      id: currentCard.id,
      front: currentCard.front,
      back: currentCard.back,
      repetitions: currentCard.repetitions || 0,
      interval: currentCard.interval || 0,
      easeFactor: currentCard.easeFactor || 2.5,
      dueDate: currentCard.dueDate || new Date().toISOString().split('T')[0],
      history: currentCard.history || [],
    };

    const updatedSrs = calculateSM2(srsCard, quality);

    const updatedCards = activeDeck.cards.map((c) =>
      c.id === currentCard.id
        ? {
            ...c,
            repetitions: updatedSrs.repetitions,
            interval: updatedSrs.interval,
            easeFactor: updatedSrs.easeFactor,
            dueDate: updatedSrs.dueDate,
            history: updatedSrs.history,
            mastered: quality >= 4,
          }
        : c
    );

    const updatedDeck = { ...activeDeck, cards: updatedCards };
    const updatedDecks = decks.map((d) => (d.id === activeDeck.id ? updatedDeck : d));
    setDecks(updatedDecks);
    saveDecks(updatedDecks);
    handleNextCard();
  };

  // Number keys 1-4 trigger the existing SM-2 grade handlers during review
  useEffect(() => {
    const handleGradeKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }
      if (!displayDeck || displayDeck.cards.length === 0) return;

      if (e.key === '1') {
        e.preventDefault();
        handleRateCard(1);
      } else if (e.key === '2') {
        e.preventDefault();
        handleRateCard(2);
      } else if (e.key === '3') {
        e.preventDefault();
        handleRateCard(4);
      } else if (e.key === '4') {
        e.preventDefault();
        handleRateCard(5);
      }
    };

    window.addEventListener('keydown', handleGradeKeyDown);
    return () => window.removeEventListener('keydown', handleGradeKeyDown);
  }, [displayDeck, currentCardIndex]);

  const handleCopyTsv = () => {
    if (!activeDeck) return;
    const tsvOutput = activeDeck.cards.map((c) => `${c.front}\t${c.back}`).join('\n');
    navigator.clipboard.writeText(tsvOutput);
    setCopiedTsv(true);
    setTimeout(() => setCopiedTsv(false), 2000);
  };

  const handleDownloadTsv = () => {
    if (!activeDeck) return;
    const tsvOutput = activeDeck.cards.map((c) => `${c.front}\t${c.back}`).join('\n');
    const blob = new Blob([tsvOutput], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDeck.title.replace(/\s+/g, '_')}_sm2.tsv`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadedTsv(true);
    setTimeout(() => setDownloadedTsv(false), 2000);
  };

  const handleImportTsv = (e: React.FormEvent) => {
    e.preventDefault();
    setTsvImportError(null);
    const lines = tsvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    const parsed: Flashcard[] = [];
    lines.forEach((line, idx) => {
      const tabIdx = line.indexOf('\t');
      if (tabIdx <= 0) return;
      const front = line.slice(0, tabIdx).trim();
      const back = line.slice(tabIdx + 1).trim();
      if (front && back) {
        parsed.push({
          id: `card-${Date.now()}-${idx}`,
          front,
          back,
          mastered: false,
        });
      }
    });

    if (parsed.length === 0) {
      setTsvImportError(t('flashcards_import_err'));
      return;
    }

    const newDeck: CardDeck = {
      id: `deck-${Date.now()}`,
      title: tsvTitle.trim() || t('flashcards_import_default_title'),
      subject: t('flashcards_import_default_subj'),
      cards: parsed,
      createdAt: formatDate(new Date()),
    };

    const updated = [newDeck, ...decks];
    setDecks(updated);
    saveDecks(updated);
    setActiveDeckId(newDeck.id);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setTsvTitle('');
    setTsvText('');
    setShowTsvImport(false);
  };

  const handleTsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!tsvTitle.trim()) {
      setTsvTitle(file.name.replace(/\.(tsv|txt)$/i, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setTsvText(reader.result);
        setTsvImportError(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-fill)] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                {t('flashcards_title')}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] rounded-full">
                {t('flashcards_badge')}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('flashcards_sub')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {displayDeck && displayDeck.cards.length > 0 && (
            <>
              <button
                onClick={handleCopyTsv}
                className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-xl text-xs font-semibold border border-[var(--border-default)] flex items-center gap-1.5 transition-colors cursor-pointer"
                title={t('flashcards_copy_tsv_title')}
              >
                {copiedTsv ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTsv ? t('flashcards_copied_tsv') : t('flashcards_copy_tsv')}</span>
              </button>

              <button
                onClick={handleDownloadTsv}
                className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-xl text-xs font-semibold border border-[var(--border-default)] flex items-center gap-1.5 transition-colors cursor-pointer"
                title={t('flashcards_download_tsv_title')}
              >
                {downloadedTsv ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Download className="w-3.5 h-3.5" />}
                <span>{downloadedTsv ? t('flashcards_downloaded_tsv') : t('flashcards_export_tsv')}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowTsvImport((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
              showTsvImport
                ? 'bg-[var(--accent-fill)] text-white'
                : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('flashcards_import_tsv')}</span>
          </button>
        </div>
      </div>

      {showTsvImport && (
        <form
          onSubmit={handleImportTsv}
          className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {t('flashcards_import_title')}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {t('flashcards_import_desc')}
              </p>
            </div>
            <label className="px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs font-semibold cursor-pointer hover:border-[var(--accent-border)] inline-flex items-center gap-1.5 w-fit">
              <Upload className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('flashcards_choose_file')}</span>
              <input type="file" accept=".tsv,.txt,text/tab-separated-values,text/plain" onChange={handleTsvFileChange} className="hidden" />
            </label>
          </div>
          <input
            type="text"
            value={tsvTitle}
            onChange={(e) => setTsvTitle(e.target.value)}
            placeholder={t('flashcards_import_title_ph')}
            className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
          />
          <textarea
            rows={4}
            value={tsvText}
            onChange={(e) => setTsvText(e.target.value)}
            placeholder={t('flashcards_import_text_ph')}
            className="w-full px-3 py-2 text-xs font-mono bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
          />
          {tsvImportError && (
            <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
              {tsvImportError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTsvImport(false)}
              className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
            >
              {t('common_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {t('flashcards_import_submit')}
            </button>
          </div>
        </form>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0">
        {/* Left: Decks List & Generator (5 cols) */}
        <div className="xl:col-span-5 min-w-0 space-y-5">
          {/* AI Generator Form */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-[var(--border-default)]">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('flashcards_gen_title')}</span>
            </h3>

            <form onSubmit={handleGenerateDeck} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    {t('subject')}
                  </label>
                  <input
                    type="text"
                    value={genSubject}
                    onChange={(e) => setGenSubject(e.target.value)}
                    placeholder={t('flashcards_subj_ph')}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    {t('flashcards_topic_label')}
                  </label>
                  <input
                    type="text"
                    required
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    placeholder={t('flashcards_topic_ph')}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <FlashcardCountField
                count={genCount}
                input={genCountInput}
                onChange={(count, input) => {
                  setGenCount(count);
                  setGenCountInput(input);
                }}
              />

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  {t('flashcards_notes_label')}
                </label>
                <textarea
                  rows={2}
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  placeholder={t('flashcards_notes_ph')}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                />
              </div>

              {genError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{genError}</span>
                </div>
              )}

              {genNotice && (
                <p className="text-[11px] text-[var(--status-warn-text)]" role="status">{genNotice}</p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isGenerating || !genTopic.trim()}
                  className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? t('flashcards_generating') : t('flashcards_generate_btn')}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Saved Decks List */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-[var(--border-default)]">
              <Layers className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('flashcards_saved_decks', { count: decks.length })}</span>
            </h3>

            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {decks.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  <p>{t('flashcards_no_decks')}</p>
                  <p className="text-[11px] mt-0.5">{t('flashcards_no_decks_hint')}</p>
                </div>
              ) : (
                decks.map((deck) => {
                  const isSelected = deck.id === activeDeckId;
                  return (
                    <div
                      key={deck.id}
                      onClick={() => {
                        setActiveDeckId(deck.id);
                        setCurrentCardIndex(0);
                        setIsFlipped(false);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-fill)]/10 border-[var(--accent-fill)] text-[var(--text-primary)]'
                          : 'bg-[var(--bg-subtle)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-border)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]">
                            {deck.subject}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">{t('flashcards_cards_count', { count: deck.cards.length })}</span>
                        </div>
                        <h4 className="text-xs font-bold truncate mt-1">{deck.title}</h4>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDeck(deck.id);
                        }}
                        className="p-1.5 text-[var(--text-muted)] hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title={t('flashcards_delete_deck')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {/* Retention Heatmap */}
            <div className="mt-4 p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">{t('flashcards_heatmap_title')}</h4>
              <div className="grid grid-cols-13 gap-1">
                {(() => {
                  const map: Record<string, number> = {};
                  decks.forEach((d) =>
                    d.cards.forEach((c) =>
                      c.history?.forEach((h) => {
                        map[h.date] = (map[h.date] || 0) + 1;
                      })
                    )
                  );
                  const today = new Date();
                  const days: string[] = [];
                  for (let i=90; i>=0; i--) { const dd=new Date(today); dd.setDate(today.getDate()-i); days.push(dd.toISOString().split('T')[0]); }
                  return days.map((day,i)=>{
                    const cnt = map[day]||0;
                    let bg='bg-[var(--bg-subtle)]';
                    if (cnt===1) bg='bg-emerald-200 dark:bg-emerald-900';
                    else if (cnt===2) bg='bg-emerald-300 dark:bg-emerald-800';
                    else if (cnt>=3) bg='bg-emerald-500 dark:bg-emerald-700';
                    return <div key={i} title={t('flashcards_heatmap_tip', { day, count: cnt })} className={`w-3 h-3 rounded-sm ${bg} border border-[var(--border-default)]`} />;
                  });
                })()}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{t('flashcards_heatmap_legend')}</p>
              <div className="mt-3">
                <h5 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('flashcards_curve_title')}</h5>
                <div className="flex items-end gap-1 h-16 mt-1">
                  {(() => {
                    const buckets = [0,0,0,0,0]; // 0:new, 1:1d, 2:3-6d, 3:7-21d, 4:30d+
                    decks.forEach(d=> d.cards.forEach(c=>{
                      const iv = c.interval||0;
                      if ((c.repetitions||0)===0) buckets[0]++; else if (iv<=1) buckets[1]++; else if (iv<=6) buckets[2]++; else if (iv<=21) buckets[3]++; else buckets[4]++;
                    }));
                    const max = Math.max(1, ...buckets);
                    const labels=[t('flashcards_bucket_new'), t('flashcards_bucket_1d'), t('flashcards_bucket_6d'), t('flashcards_bucket_21d'), t('flashcards_bucket_30d')];
                    return buckets.map((v,i)=>(
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-violet-500 rounded-t" style={{height: `${(v/max)*48+4}px`, opacity: 0.6 + i*0.08}} title={t('flashcards_bucket_tip', { label: labels[i], count: v })} />
                        <span className="text-[9px] font-bold text-[var(--text-muted)]">{labels[i]}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Interactive 3D Study Viewer (7 cols) */}
        <div className="xl:col-span-7 min-w-0">
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 shadow-xs flex flex-col justify-between h-full min-h-[460px]">
            {displayDeck && currentCard ? (
              <>
                {/* Queue Summary */}
                <div className="flex items-center gap-2 text-[11px] font-bold mb-2 flex-wrap">
                  <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">{t('flashcards_due_today_count', { count: queueSummary.due })}</span>
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{t('flashcards_new_count', { count: queueSummary.new })}</span>
                  <span className="px-2 py-1 rounded-full bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]">{t('flashcards_learning_count', { count: queueSummary.learning })}</span>
                  <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono">{t('flashcards_queue_order')}</span>
                </div>
                {/* Review Session Size */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">{t('flashcards_session_size')}</span>
                  {[10, 20, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => { setSessionLimit(n); setCustomSessionInput(''); setCurrentCardIndex(0); setIsFlipped(false); }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${sessionLimit === n ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--accent-border)]'}`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => { setSessionLimit('all'); setCustomSessionInput(''); setCurrentCardIndex(0); setIsFlipped(false); }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${sessionLimit === 'all' ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--accent-border)]'}`}
                  >
                    {t('all')}
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={customSessionInput}
                    onChange={(e) => {
                      setCustomSessionInput(e.target.value);
                      const n = Math.floor(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 1 && n <= 500) {
                        setSessionLimit(n);
                        setCurrentCardIndex(0);
                        setIsFlipped(false);
                      }
                    }}
                    placeholder={t('flashcards_custom_ph')}
                    title={t('flashcards_custom_title')}
                    className="w-20 px-2 py-1 text-[11px] bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                  />
                </div>
                {/* Top Deck Info & Card Index */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {displayDeck!.title}
                    </h3>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {t('flashcards_session_progress', {
                        current: displayDeck!.cards.length > 0 ? Math.min(currentCardIndex + 1, displayDeck!.cards.length) : 0,
                        total: displayDeck!.cards.length,
                        due: queueSummary.due,
                      })}
                      {sessionLimit !== 'all' && activeDeck ? t('flashcards_session_of', { total: activeDeck.cards.length }) : ''}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleMastered}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      currentCard.mastered
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{currentCard.mastered ? t('flashcards_mastered') : t('flashcards_mark_mastered')}</span>
                  </button>
                </div>

                {/* Interactive Flashcard with Flip Animation */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="my-8 cursor-pointer select-none perspective-1000 min-h-[220px] flex items-center justify-center"
                >
                  <div
                    className={`w-full p-8 rounded-2xl border-2 transition-all duration-300 shadow-sm flex flex-col items-center justify-center text-center relative ${
                      isFlipped
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-fill)]'
                        : 'bg-[var(--bg-subtle)] border-[var(--border-default)] hover:border-[var(--accent-border)]'
                    }`}
                  >
                    <span className="absolute top-3 left-4 text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                      {isFlipped ? t('flashcards_side_back') : t('flashcards_side_front')}
                    </span>

                    <div className="my-auto py-4">
                      <p className="text-base sm:text-lg font-bold text-[var(--text-primary)] max-w-lg leading-relaxed">
                        {isFlipped ? currentCard.back : currentCard.front}
                      </p>
                    </div>

                    <div className="absolute bottom-3 text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                      <RotateCw className="w-3 h-3" />
                      <span>{t('flashcards_flip_hint')}</span>
                    </div>
                  </div>
                </div>

                {/* Recall Rating Bar */}
                {isFlipped && (
                  <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-xs space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {t('flashcards_rate_title')}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {t('flashcards_reviewed_count', { count: currentCard.repetitions || 0 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => handleRateCard(1)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">{t('flashcards_rate_again')}</span>
                        <span className="text-[10px] opacity-75 font-normal">{t('flashcards_next_days', { days: 1 })}</span>
                      </button>

                      <button
                        onClick={() => handleRateCard(2)}
                        className="p-2 rounded-xl bg-[var(--status-warn-bg)] hover:bg-[var(--bg-hover)] border border-[var(--status-warn-border)] text-[var(--status-warn-text)] text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">{t('flashcards_rate_hard')}</span>
                        <span className="text-[10px] opacity-75 font-normal">{t('flashcards_next_days', { days: 1 })}</span>
                      </button>

                      <button
                        onClick={() => handleRateCard(4)}
                        className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">{t('flashcards_rate_good')}</span>
                        <span className="text-[10px] opacity-75 font-normal">
                          {t('flashcards_next_days', { days: Math.max(1, (currentCard.interval || 1) * 2) })}
                        </span>
                      </button>

                      <button
                        onClick={() => handleRateCard(5)}
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">{t('flashcards_rate_easy')}</span>
                        <span className="text-[10px] opacity-75 font-normal">
                          {t('flashcards_next_days', { days: Math.max(6, Math.round((currentCard.interval || 1) * 2.5)) })}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Navigation & Keyboard Shortcuts Bar */}
                <div className="pt-4 border-t border-[var(--border-default)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevCard}
                      className="px-3.5 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t('flashcards_prev')}</span>
                    </button>

                    <button
                      onClick={handleNextCard}
                      className="px-3.5 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>{t('flashcards_next')}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-default)]">Space</kbd>
                    <span>{t('flashcards_kbd_flip')}</span>
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-default)]">← / →</kbd>
                    <span>{t('flashcards_kbd_nav')}</span>
                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-default)]">1–4</kbd>
                    <span>{t('flashcards_kbd_grade')}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="my-auto py-16 px-4 text-center">
                <Brain className="w-12 h-12 mx-auto text-[var(--accent-fill)]/80 mb-3" />
                <h4 className="text-base font-bold text-[var(--text-primary)]">
                  {t('flashcards_empty_title')}
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                  {t('flashcards_empty_desc')}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
