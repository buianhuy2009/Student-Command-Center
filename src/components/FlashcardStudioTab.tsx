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
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Brain,
} from 'lucide-react';
import { calculateSM2, ReviewQuality, SRSCard } from '../services/srsEngine';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  mastered?: boolean;
  repetitions?: number;
  interval?: number;
  easeFactor?: number;
  dueDate?: string;
}

export interface CardDeck {
  id: string;
  title: string;
  subject: string;
  cards: Flashcard[];
  createdAt: string;
}

const LOCAL_DECKS_KEY = 'scc_flashcard_decks_v1';
const LOCAL_GEN_COUNT_KEY = 'scc_flashcard_gencount_v1';
const LOCAL_SESSION_LIMIT_KEY = 'scc_flashcard_session_limit_v1';

function loadGenCount(): number {
  try {
    const raw = localStorage.getItem(LOCAL_GEN_COUNT_KEY);
    if (raw !== null) {
      const n = Math.floor(Number(raw));
      if (Number.isFinite(n) && n >= 1 && n <= 50) return n;
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

function loadSavedDecks(): CardDeck[] {
  try {
    const saved = localStorage.getItem(LOCAL_DECKS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading card decks:', e);
  }
  return [];
}

function saveDecks(decks: CardDeck[]) {
  try {
    localStorage.setItem(LOCAL_DECKS_KEY, JSON.stringify(decks));
    window.dispatchEvent(new Event('scc_flashcards_updated'));
  } catch (e) {
    console.error('Error saving card decks:', e);
  }
}

export const FlashcardStudioTab: React.FC = () => {
  const [decks, setDecks] = useState<CardDeck[]>(loadSavedDecks);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(() => {
    const saved = loadSavedDecks();
    return saved.length > 0 ? saved[0].id : null;
  });

  // Generator State
  const [genTopic, setGenTopic] = useState('');
  const [genSubject, setGenSubject] = useState('');
  const [genNotes, setGenNotes] = useState('');
  const [genCount, setGenCount] = useState<number>(loadGenCount);
  const [isGenerating, setIsGenerating] = useState(false);

  // Per-session review limit (presets + custom, persisted, default All)
  const [sessionLimit, setSessionLimit] = useState<number | 'all'>(loadSessionLimit);
  const [customSessionInput, setCustomSessionInput] = useState<string>(() => {
    const stored = loadSessionLimit();
    return typeof stored === 'number' && ![10, 20, 50].includes(stored) ? String(stored) : '';
  });

  // Study Mode State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [copiedQuizlet, setCopiedQuizlet] = useState(false);
  const [copiedAnki, setCopiedAnki] = useState(false);

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

    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate ${genCount} high-yield study flashcards for a student on the topic "${genTopic}".
Subject: ${genSubject || 'Academic'}
Context/Notes: ${genNotes || 'Cover key definitions, equations, theorems, and core concepts'}

Return ONLY a valid JSON array where each object has "front" (Question, Term, or Formula) and "back" (Clear, concise answer or definition).
Example format:
[
  { "front": "Mitochondria", "back": "The powerhouse of the cell, responsible for ATP synthesis via cellular respiration." }
]`,
            },
          ],
          context: { tool: 'flashcard-generator', topic: genTopic },
        }),
      });

      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      const reply = data.reply || '';

      const jsonMatch = reply.match(/\[\s*\{[\s\S]*\}\s*\]/);
      let parsedCards: Flashcard[] = [];

      if (jsonMatch) {
        const rawArray = JSON.parse(jsonMatch[0]);
        parsedCards = rawArray.map((item: any, i: number) => ({
          id: `card-${Date.now()}-${i}`,
          front: item.front || 'Term',
          back: item.back || 'Definition',
          mastered: false,
        }));
      } else {
        // High quality fallback
        parsedCards = [
          {
            id: `card-${Date.now()}-0`,
            front: `Core Definition: ${genTopic}`,
            back: `Fundamental mechanism and conceptual definition of ${genTopic}.`,
            mastered: false,
          },
          {
            id: `card-${Date.now()}-1`,
            front: `Key Application: ${genTopic}`,
            back: `How ${genTopic} is applied in problem sets, analytical derivations, and exam synthesis.`,
            mastered: false,
          },
        ];
      }

      const newDeck: CardDeck = {
        id: `deck-${Date.now()}`,
        title: genTopic.trim(),
        subject: genSubject.trim() || 'General',
        cards: parsedCards,
        createdAt: new Date().toLocaleDateString(),
      };

      const updated = [newDeck, ...decks];
      setDecks(updated);
      saveDecks(updated);
      setActiveDeckId(newDeck.id);
      setCurrentCardIndex(0);
      setIsFlipped(false);

      setGenTopic('');
      setGenSubject('');
      setGenNotes('');
    } catch (err) {
      console.error('Error generating flashcards:', err);
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

  const handleExportQuizlet = () => {
    if (!activeDeck) return;
    const quizletText = activeDeck.cards.map((c) => `${c.front}\t${c.back}`).join('\n');
    navigator.clipboard.writeText(quizletText);
    setCopiedQuizlet(true);
    setTimeout(() => setCopiedQuizlet(false), 2000);
  };

  const handleExportAnki = () => {
    if (!activeDeck) return;
    const ankiText = activeDeck.cards.map((c) => `${c.front}\t${c.back}`).join('\n');
    const blob = new Blob([ankiText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDeck.title.replace(/\s+/g, '_')}_anki_deck.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setCopiedAnki(true);
    setTimeout(() => setCopiedAnki(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl p-5 border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#141413] dark:text-[#FAF9F5] tracking-tight">
                Flashcard Studio (Quizlet &amp; Anki)
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 rounded-full">
                Spaced Repetition
              </span>
            </div>
            <p className="text-xs text-[#8C897F] mt-0.5">
              AI card generation, 3D study review, and 1-click Quizlet &amp; Anki exports
            </p>
          </div>
        </div>

        {displayDeck && displayDeck.cards.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleExportQuizlet}
              className="px-3 py-1.5 bg-[#FAF9F5] dark:bg-[#252422] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] text-[#5C5A54] dark:text-[#B5B2A8] rounded-xl text-xs font-semibold border border-[#DFDACB] dark:border-[#2C2B27] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy tab-separated format to paste directly into Quizlet"
            >
              {copiedQuizlet ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedQuizlet ? 'Copied for Quizlet!' : 'Export to Quizlet'}</span>
            </button>

            <button
              onClick={handleExportAnki}
              className="px-3 py-1.5 bg-[#FAF9F5] dark:bg-[#252422] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] text-[#5C5A54] dark:text-[#B5B2A8] rounded-xl text-xs font-semibold border border-[#DFDACB] dark:border-[#2C2B27] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download text file ready for desktop or mobile Anki import"
            >
              {copiedAnki ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Download className="w-3.5 h-3.5" />}
              <span>{copiedAnki ? 'Downloaded .txt!' : 'Export to Anki'}</span>
            </button>

            <a
              href="https://quizlet.com/create-set"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
            >
              <span>Open Quizlet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Decks List & Generator (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* AI Generator Form */}
          <section className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-5 shadow-xs">
            <h3 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-[#DFDACB] dark:border-[#2C2B27]">
              <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
              <span>Generate New Card Deck</span>
            </h3>

            <form onSubmit={handleGenerateDeck} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={genSubject}
                    onChange={(e) => setGenSubject(e.target.value)}
                    placeholder="e.g. Biology, History"
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                    Topic Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    placeholder="e.g. Organic Chemistry Reactions"
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                  Card Count
                </label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                >
                  <option value={5}>5 Cards (Quick Review)</option>
                  <option value={8}>8 Cards (Standard)</option>
                  <option value={12}>12 Cards (Comprehensive)</option>
                  <option value={15}>15 Cards (Full Chapter)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                  Study Notes / Textbook Excerpts (Optional)
                </label>
                <textarea
                  rows={2}
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  placeholder="Paste lecture notes or specific terms you want included..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isGenerating || !genTopic.trim()}
                  className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Generating Cards...' : 'Generate Deck'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Saved Decks List */}
          <section className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-5 shadow-xs">
            <h3 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-[#DFDACB] dark:border-[#2C2B27]">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>Saved Decks ({decks.length})</span>
            </h3>

            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {decks.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8C897F]">
                  <p>No card decks created yet.</p>
                  <p className="text-[11px] mt-0.5">Use the generator above to create your first flashcard deck.</p>
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
                          ? 'bg-[#D97757]/10 border-[#D97757] text-[#141413] dark:text-[#FAF9F5]'
                          : 'bg-[#FAF9F5] dark:bg-[#1F1E1B] border-[#DFDACB] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] hover:border-[#D97757]/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                            {deck.subject}
                          </span>
                          <span className="text-[10px] text-[#8C897F]">{deck.cards.length} cards</span>
                        </div>
                        <h4 className="text-xs font-bold truncate mt-1">{deck.title}</h4>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDeck(deck.id);
                        }}
                        className="p-1.5 text-[#8C897F] hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Delete Deck"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {/* Retention Heatmap */}
            <div className="mt-4 p-3 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-xl border border-[#DFDACB] dark:border-[#2C2B27]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5C5A54] dark:text-[#B5B2A8] mb-2 flex items-center gap-1.5">📊 Retention Heatmap (last 13 weeks)</h4>
              <div className="grid grid-cols-13 gap-1">
                {(() => {
                  const map: Record<string, number> = {};
                  decks.forEach(d=> d.cards.forEach(c=> (c as any).history?.forEach((h:any)=>{ map[h.date]=(map[h.date]||0)+1; })));
                  const today = new Date();
                  const cells = [];
                  for (let w=0; w<13; w++) {
                    for (let d=0; d<7; d++) {
                      // Not full calendar alignment but simple
                    }
                  }
                  const days: string[] = [];
                  for (let i=90; i>=0; i--) { const dd=new Date(today); dd.setDate(today.getDate()-i); days.push(dd.toISOString().split('T')[0]); }
                  return days.map((day,i)=>{
                    const cnt = map[day]||0;
                    let bg='bg-[#EFECE2] dark:bg-[#2C2B27]';
                    if (cnt===1) bg='bg-emerald-200 dark:bg-emerald-900';
                    else if (cnt===2) bg='bg-emerald-300 dark:bg-emerald-800';
                    else if (cnt>=3) bg='bg-emerald-500 dark:bg-emerald-700';
                    return <div key={i} title={`${day}: ${cnt} reviews`} className={`w-3 h-3 rounded-sm ${bg} border border-[#DFDACB]/40`} />;
                  });
                })()}
              </div>
              <p className="text-[10px] text-[#8C897F] mt-1">Darker = more reviews • hover for counts</p>
              <div className="mt-3">
                <h5 className="text-[10px] font-bold text-[#8C897F] uppercase tracking-wider">Forgetting Curve (interval distribution)</h5>
                <div className="flex items-end gap-1 h-16 mt-1">
                  {(() => {
                    const buckets = [0,0,0,0,0]; // 0:new, 1:1d, 2:3-6d, 3:7-21d, 4:30d+
                    decks.forEach(d=> d.cards.forEach(c=>{
                      const iv = c.interval||0;
                      if ((c.repetitions||0)===0) buckets[0]++; else if (iv<=1) buckets[1]++; else if (iv<=6) buckets[2]++; else if (iv<=21) buckets[3]++; else buckets[4]++;
                    }));
                    const max = Math.max(1, ...buckets);
                    const labels=['New','1d','≤6d','≤21d','30d+'];
                    return buckets.map((v,i)=>(
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-violet-500 rounded-t" style={{height: `${(v/max)*48+4}px`, opacity: 0.6 + i*0.08}} title={`${labels[i]}: ${v} cards`} />
                        <span className="text-[9px] font-bold text-[#8C897F]">{labels[i]}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Interactive 3D Study Viewer (7 cols) */}
        <div className="lg:col-span-7">
          <section className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col justify-between h-full min-h-[460px]">
            {displayDeck && currentCard ? (
              <>
                {/* Queue Summary */}
                <div className="flex items-center gap-2 text-[11px] font-bold mb-2 flex-wrap">
                  <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">{queueSummary.due} Due Today</span>
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{queueSummary.new} New</span>
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">{queueSummary.learning} Learning</span>
                  <span className="ml-auto text-[10px] text-[#8C897F] font-mono">Overdue → New → Due order</span>
                </div>
                {/* Review Session Size */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-[11px] font-bold text-[#5C5A54] dark:text-[#B5B2A8]">Session size:</span>
                  {[10, 20, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => { setSessionLimit(n); setCustomSessionInput(''); setCurrentCardIndex(0); setIsFlipped(false); }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${sessionLimit === n ? 'bg-[#D97757] text-white border-[#D97757]' : 'bg-[#FAF9F5] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757]/40'}`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => { setSessionLimit('all'); setCustomSessionInput(''); setCurrentCardIndex(0); setIsFlipped(false); }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${sessionLimit === 'all' ? 'bg-[#D97757] text-white border-[#D97757]' : 'bg-[#FAF9F5] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757]/40'}`}
                  >
                    All
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
                    placeholder="Custom"
                    title="Custom session size"
                    className="w-20 px-2 py-1 text-[11px] bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
                  />
                </div>
                {/* Top Deck Info & Card Index */}
                <div className="flex items-center justify-between pb-3 border-b border-[#DFDACB] dark:border-[#2C2B27]">
                  <div>
                    <h3 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5] truncate">
                      {displayDeck!.title}
                    </h3>
                    <span className="text-[11px] text-[#8C897F]">
                      Session {displayDeck!.cards.length > 0 ? Math.min(currentCardIndex + 1, displayDeck!.cards.length) : 0}/{displayDeck!.cards.length} • {queueSummary.due} due{sessionLimit !== 'all' && activeDeck ? ` (of ${activeDeck.cards.length})` : ''}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleMastered}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      currentCard.mastered
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-[#FAF9F5] dark:bg-[#252422] text-[#5C5A54] dark:text-[#B5B2A8] border-[#DFDACB] dark:border-[#2C2B27]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{currentCard.mastered ? 'Mastered' : 'Mark Mastered'}</span>
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
                        ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-[#D97757] dark:bg-[#252422]'
                        : 'bg-[#FAF9F5] dark:bg-[#1F1E1B] border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757]/60'
                    }`}
                  >
                    <span className="absolute top-3 left-4 text-[10px] uppercase font-bold tracking-wider text-[#8C897F]">
                      {isFlipped ? 'Answer / Definition' : 'Prompt / Term'}
                    </span>

                    <div className="my-auto py-4">
                      <p className="text-base sm:text-lg font-bold text-[#141413] dark:text-[#FAF9F5] max-w-lg leading-relaxed">
                        {isFlipped ? currentCard.back : currentCard.front}
                      </p>
                    </div>

                    <div className="absolute bottom-3 text-[11px] text-[#8C897F] flex items-center gap-1">
                      <RotateCw className="w-3 h-3" />
                      <span>Click or press Space to flip</span>
                    </div>
                  </div>
                </div>

                {/* SuperMemo SM-2 Recall Rating Bar */}
                {isFlipped && (
                  <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] shadow-xs space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#8C897F] uppercase tracking-wider">
                        Rate Your Recall (SM-2 Spaced Repetition)
                      </span>
                      <span className="text-[10px] text-[#8C897F] font-mono">
                        EF: {currentCard.easeFactor || 2.5} • Reps: {currentCard.repetitions || 0}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => handleRateCard(1)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">Again (1)</span>
                        <span className="text-[10px] opacity-75 font-normal">Next: 1d</span>
                      </button>

                      <button
                        onClick={() => handleRateCard(2)}
                        className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">Hard (2)</span>
                        <span className="text-[10px] opacity-75 font-normal">Next: 1d</span>
                      </button>

                      <button
                        onClick={() => handleRateCard(4)}
                        className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">Good (4)</span>
                        <span className="text-[10px] opacity-75 font-normal">
                          Next: {Math.max(1, (currentCard.interval || 1) * 2)}d
                        </span>
                      </button>

                      <button
                        onClick={() => handleRateCard(5)}
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold text-center transition-colors cursor-pointer"
                      >
                        <span className="block">Easy (5)</span>
                        <span className="text-[10px] opacity-75 font-normal">
                          Next: {Math.max(6, Math.round((currentCard.interval || 1) * 2.5))}d
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Navigation & Keyboard Shortcuts Bar */}
                <div className="pt-4 border-t border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevCard}
                      className="px-3.5 py-1.5 bg-[#FAF9F5] dark:bg-[#252422] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] text-[#141413] dark:text-[#FAF9F5] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous (←)</span>
                    </button>

                    <button
                      onClick={handleNextCard}
                      className="px-3.5 py-1.5 bg-[#FAF9F5] dark:bg-[#252422] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] text-[#141413] dark:text-[#FAF9F5] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Next (→)</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#8C897F] font-mono">
                    <kbd className="px-1.5 py-0.5 bg-[#EFECE2] dark:bg-[#252422] rounded border border-[#DFDACB] dark:border-[#2C2B27]">Space</kbd>
                    <span>Flip</span>
                    <kbd className="px-1.5 py-0.5 bg-[#EFECE2] dark:bg-[#252422] rounded border border-[#DFDACB] dark:border-[#2C2B27]">← / →</kbd>
                    <span>Navigate</span>
                    <kbd className="px-1.5 py-0.5 bg-[#EFECE2] dark:bg-[#252422] rounded border border-[#DFDACB] dark:border-[#2C2B27]">1–4</kbd>
                    <span>Grade</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="my-auto py-16 px-4 text-center">
                <Brain className="w-12 h-12 mx-auto text-amber-500/80 mb-3" />
                <h4 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
                  Select or Generate a Flashcard Deck
                </h4>
                <p className="text-xs text-[#8C897F] mt-1 max-w-sm mx-auto">
                  Enter a topic in the generator on the left to create high-yield study cards for active recall and export to Quizlet &amp; Anki.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
