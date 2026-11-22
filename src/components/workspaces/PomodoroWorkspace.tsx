import React, { useState, useEffect, useRef } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Sparkles,
  Zap,
  Sliders,
  Flame,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ambientAudio, AMBIENT_TRACKS, getAmbientTrackShortLabel, TrackId } from '../../services/ambientAudio';
import { usePomodoroStore, recordStreakDate } from '../../stores/pomodoroStore';
import { useT } from '../../services/i18n';

export interface PomodoroWorkspaceProps {
  initialMinutes?: number;
}

export const PomodoroWorkspace: React.FC<PomodoroWorkspaceProps> = ({ initialMinutes }) => {
  const { lang, t } = useT();
  // Timer States
  const initialWorkMins = (() => {
    try {
      const requested = localStorage.getItem('scc_pomo_requested_duration');
      if (requested) {
        localStorage.removeItem('scc_pomo_requested_duration');
        const parsed = parseInt(requested, 10);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 120) return parsed;
      }
    } catch {}
    return typeof initialMinutes === 'number' && initialMinutes > 0 ? initialMinutes : 25;
  })();
  const [mode, setMode] = useState<'work' | 'short' | 'long'>('work');
  const [durationMinutes, setDurationMinutes] = useState<number>(initialWorkMins);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(initialWorkMins * 60);

  useEffect(() => {
    if (typeof initialMinutes === 'number' && initialMinutes > 0) {
      setMode('work');
      setDurationMinutes(initialMinutes);
      setTimeLeftSeconds(initialMinutes * 60);
      setIsRunning(false);
    }
  }, [initialMinutes]);

  useEffect(() => {
    const handlePomoStart = (e: Event) => {
      const detail = (e as CustomEvent<{ minutes?: number; autoStart?: boolean }>).detail;
      const mins = Number(detail?.minutes);
      if (!Number.isFinite(mins) || mins < 1 || mins > 120) return;
      try { localStorage.removeItem('scc_pomo_requested_duration'); } catch {}
      setMode('work');
      setDurationMinutes(mins);
      setTimeLeftSeconds(mins * 60);
      setIsRunning(detail?.autoStart !== false);
    };
    window.addEventListener('scc-pomo-start', handlePomoStart);
    return () => window.removeEventListener('scc-pomo-start', handlePomoStart);
  }, []);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('scc_pomo_completed_v1');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Screen-reader live announcement (throttled to minute changes) + title countdown refs
  const originalTitleRef = useRef<string>('');
  const lastAnnouncedKeyRef = useRef<string>('');
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  // Ambient Sound Engine (shared singleton service)
  const [activeSound, setActiveSound] = useState<TrackId>(ambientAudio.getTrack());
  const [soundVolume, setSoundVolume] = useState<number>(0.5);

  useEffect(() => {
    const unsub = ambientAudio.subscribe((tr) => setActiveSound(tr));
    return () => unsub();
  }, []);

  // Scratchpad State
  const [scratchpadText, setScratchpadText] = useState<string>(() => {
    try {
      return localStorage.getItem('scc_pomo_scratchpad_v1') || '';
    } catch {
      return '';
    }
  });

  // Switch timer presets
  const setPreset = (type: 'work' | 'short' | 'long', mins: number) => {
    setMode(type);
    setDurationMinutes(mins);
    setTimeLeftSeconds(mins * 60);
    setIsRunning(false);
  };

  // Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeftSeconds > 0) {
      interval = setInterval(() => {
        setTimeLeftSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timeLeftSeconds === 0 && isRunning) {
      setIsRunning(false);
      if (mode === 'work') {
        const nextCount = completedSessions + 1;
        setCompletedSessions(nextCount);
        try {
          localStorage.setItem('scc_pomo_completed_v1', nextCount.toString());
          const todayStr = new Date().toISOString().slice(0, 10);
          const rawLog = localStorage.getItem('scc_focus_sessions_log');
          const parsedLog = rawLog ? JSON.parse(rawLog) : [];
          const log: { date: string; minutes: number }[] = Array.isArray(parsedLog) ? parsedLog : [];
          log.push({ date: todayStr, minutes: durationMinutes });
          localStorage.setItem('scc_focus_sessions_log', JSON.stringify(log));

          // Maintain scc_streak_history as Record<string, number> (shared with pomodoroStore + App.tsx; migrates legacy string[])
          recordStreakDate(todayStr, { increment: true });
        } catch {}
        try {
          usePomodoroStore.setState({ completedSessions: nextCount });
          new BroadcastChannel('scc-pomo').postMessage({ type: 'increment', value: nextCount });
        } catch {}
        if (document.visibilityState === 'visible' && !document.hidden) {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        }
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeftSeconds, mode, completedSessions, durationMinutes]);

  // Sync document.title with the timer countdown while running, restore previous title on unmount
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }
    const original = originalTitleRef.current;
    return () => {
      document.title = original;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }
    if (isRunning && timeLeftSeconds > 0) {
      const m = Math.floor(timeLeftSeconds / 60);
      const s = timeLeftSeconds % 60;
      const mmss = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      const label = mode === 'work' ? t('focus') : t('pom_break');
      document.title = `(${mmss}) ${label} • ${t('pom_doc_brand')}`;
    } else if (document.title !== originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  }, [isRunning, timeLeftSeconds, mode, lang, t]);

  // Screen-reader announcement: update at most once per minute (or on mode/language change)
  useEffect(() => {
    const minsLeft = Math.ceil(timeLeftSeconds / 60);
    const key = `${minsLeft}:${timeLeftSeconds <= 0 ? 'done' : 'run'}:${mode}:${lang}`;
    if (key !== lastAnnouncedKeyRef.current) {
      lastAnnouncedKeyRef.current = key;
      const label = mode === 'work' ? t('focus') : t('pom_break');
      if (timeLeftSeconds <= 0) {
        setLiveAnnouncement(`${label} ${t('pom_finished_suffix')}`);
      } else {
        setLiveAnnouncement(
          t('pom_time_left_announce', {
            mins: minsLeft,
            unit: minsLeft === 1 ? t('pom_unit_min_one') : t('pom_unit_min_other'),
            mode: label,
          })
        );
      }
    }
  }, [timeLeftSeconds, mode, lang, t]);
  // Onboarding ("Start Pomodoro") reads localStorage `scc_pomo_completed_v1`
  // (see OnboardingChecklist + pomodoroStore). This workspace does not use the
  // store, so mirror its format (integer string) with a minimal try/catch write.
  // Start must not inflate stats: only ensure the key exists, completion still increments.
  const markPomoOnboardingTouched = () => {
    try {
      if (!localStorage.getItem('scc_pomo_completed_v1')) {
        localStorage.setItem('scc_pomo_completed_v1', '1');
      }
    } catch {}
  };

  const handleToggleTimer = () => {
    if (!isRunning) {
      // 1. Auto-fullscreen if permitted
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch (e) {}

      // 2. Auto-turn on Brown Noise by default if silent (through shared ambientAudio)
      if (activeSound === 'none') {
        ambientAudio.setVolume(soundVolume);
        ambientAudio.playTrack('brown');
      }

      // 3. Persist onboarding key when a focus (work-mode) session starts.
      // Completion path (timer tick above) persists via increment; start only
      // ensures the key exists so "Start Pomodoro" marks done without waiting
      // 25 minutes. Break presets never touch the key.
      if (mode === 'work') {
        markPomoOnboardingTouched();
      }

      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  };

  // Update volume live via shared ambientAudio engine
  useEffect(() => {
    ambientAudio.setVolume(soundVolume);
  }, [soundVolume]);

  // Keyboard shortcuts: Space, P, or K toggle the timer. Ignore edits in form fields.
  const handleTimerKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName ?? '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (target?.isContentEditable) return;
    const key = e.key.toLowerCase();
    const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
    const isToggleKey = isSpace || key === 'p' || key === 'k';
    if (!isToggleKey) return;
    // Let focused buttons use native Space activation (click) to avoid double-toggling.
    if (tag === 'BUTTON' && isSpace) return;
    e.preventDefault();
    handleToggleTimer();
  };

  // Clean up ambient audio on unmount
  useEffect(() => {
    return () => {
      ambientAudio.stop();
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = ((durationMinutes * 60 - timeLeftSeconds) / (durationMinutes * 60)) * 100;

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150 max-w-5xl mx-auto">
      
      {/* 1. Top Header Bar */}
      <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 font-bold">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {t('pom_title')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--status-err-bg)] text-[var(--status-err-text)] border border-[var(--status-err-border)]">
                {t('pom_badge')}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('pom_sub')}
            </p>
          </div>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{completedSessions} {t('pom_intervals')}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Dual Panel: Clock + Soundscapes */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0">
        
        {/* Left: Pomodoro Clock (7 cols) */}
        <div
          className="xl:col-span-7 min-w-0 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-5 sm:p-8 shadow-xs flex flex-col items-center justify-center space-y-6 text-center"
          tabIndex={0}
          role="group"
          aria-label={t('pom_group_aria')}
          onKeyDown={handleTimerKeyDown}
        >
          
          {/* Preset Selector */}
          <div className="flex flex-wrap justify-center items-center gap-1.5 bg-[var(--bg-subtle)] p-1.5 rounded-2xl border border-[var(--border-default)] max-w-full">
            <button
              onClick={() => setPreset('work', 25)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'work' && durationMinutes === 25
                  ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent-text)]'
              }`}
            >
              {t('pom_preset_pomo')}
            </button>
            <button
              onClick={() => setPreset('work', 50)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'work' && durationMinutes === 50
                  ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent-text)]'
              }`}
            >
              {t('pom_preset_deep')}
            </button>
            <button
              onClick={() => setPreset('short', 5)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'short'
                  ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent-text)]'
              }`}
            >
              {t('pom_preset_short')}
            </button>
            <button
              onClick={() => setPreset('long', 15)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'long'
                  ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent-text)]'
              }`}
            >
              {t('pom_preset_long')}
            </button>
          </div>

          {/* Huge Timer Digits */}
          <div className="space-y-2 py-4">
            <div
              role="timer"
              aria-live="polite"
              aria-label={`${formatTime(timeLeftSeconds)} ${t('pom_aria_remaining')} ${mode === 'work' ? t('focus') : t('pom_break')} ${t('pom_aria_timer')}`}
              className="text-6xl sm:text-7xl md:text-8xl font-mono font-extrabold text-[var(--text-primary)] tracking-tighter"
            >
              {formatTime(timeLeftSeconds)}
            </div>
            <span aria-live="polite" role="status" className="sr-only">
              {liveAnnouncement}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
              {mode === 'work' ? t('pom_mode_work') : t('pom_mode_break')}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-default)]">
            <div
              className="h-full bg-[var(--accent-fill)] transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleToggleTimer}
              className={`px-8 py-3.5 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 ${
                isRunning
                  ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                  : 'bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isRunning ? t('pom_pause_btn') : t('pom_start')}</span>
            </button>

            <button
              onClick={() => {
                setIsRunning(false);
                setTimeLeftSeconds(durationMinutes * 60);
              }}
              className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title={t('pom_reset_title')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Ambient Sound Synthesizer & Scratchpad (5 cols) */}
        <div className="xl:col-span-5 min-w-0 space-y-6">
          
          {/* Ambient Soundscape Synthesizer */}
          <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[var(--accent-text)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {t('pom_sound_title')}
                </span>
              </div>
              {activeSound !== 'none' && (
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                  {t('pom_synth')}
                </span>
              )}
            </div>

            {/* Sound Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AMBIENT_TRACKS.map((snd) => (
                <button
                  key={snd.id}
                  onClick={() => ambientAudio.playTrack(snd.id)}
                  className={`p-2.5 rounded-xl border text-[11px] font-bold text-left transition-all cursor-pointer ${
                    activeSound === snd.id
                      ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)] shadow-xs'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-fill)]/60'
                  }`}
                >
                  {getAmbientTrackShortLabel(snd.id)}
                </button>
              ))}
            </div>

            {/* Volume Slider */}
            {activeSound !== 'none' && (
              <div className="pt-2 flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                  aria-label={t('pom_volume_aria')}
                  className="w-full accent-[var(--accent-fill)] cursor-pointer"
                />
                <span className="text-[11px] font-mono text-[var(--text-muted)] w-10 text-right">
                  {Math.round(soundVolume * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Quick Focus Scratchpad */}
          <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-default)]">
              <FileText className="w-4 h-4 text-[var(--accent-text)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {t('pom_scratch_title')}
              </span>
            </div>

            <textarea
              value={scratchpadText}
              onChange={(e) => {
                setScratchpadText(e.target.value);
                try {
                  localStorage.setItem('scc_pomo_scratchpad_v1', e.target.value);
                } catch {}
              }}
              placeholder={t('pom_scratch_ph')}
              rows={4}
              className="w-full p-3 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-2xl focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-primary)] resize-none leading-relaxed"
            />
          </div>

        </div>

      </div>

    </div>
  );
};
