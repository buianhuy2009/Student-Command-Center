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
import { ambientAudio, AMBIENT_TRACKS, TrackId } from '../../services/ambientAudio';
import { usePomodoroStore, recordStreakDate } from '../../stores/pomodoroStore';
import { t, useLang } from '../../services/i18n';

export interface PomodoroWorkspaceProps {
  initialMinutes?: number;
}

export const PomodoroWorkspace: React.FC<PomodoroWorkspaceProps> = ({ initialMinutes }) => {
  useLang();
  // Timer States
  const initialWorkMins = typeof initialMinutes === 'number' && initialMinutes > 0 ? initialMinutes : 25;
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
  const lastAnnouncedMinuteRef = useRef<number>(-1);
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
      document.title = `(${mmss}) ${label} • Student Command Center`;
    } else if (document.title !== originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  }, [isRunning, timeLeftSeconds, mode]);

  // Screen-reader announcement: update at most once per minute to avoid spam
  useEffect(() => {
    const minsLeft = Math.ceil(timeLeftSeconds / 60);
    if (minsLeft !== lastAnnouncedMinuteRef.current) {
      lastAnnouncedMinuteRef.current = minsLeft;
      const label = mode === 'work' ? t('focus') : t('pom_break');
      if (timeLeftSeconds <= 0) {
        setLiveAnnouncement(`${label} ${t('pom_finished_suffix')}`);
      } else {
        setLiveAnnouncement(
          `${t('pom_left_prefix')} ${minsLeft} ${minsLeft === 1 ? t('pom_min_one') : t('pom_mins_other')} ${label}${t('pom_left_suffix')}`
        );
      }
    }
  }, [timeLeftSeconds, mode]);
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
      <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 font-bold">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#141413] dark:text-[#FAF9F5]">
                {t('pom_title')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                {t('pom_badge')}
              </span>
            </div>
            <p className="text-xs text-[#8C897F] mt-0.5">
              {t('pom_sub')}
            </p>
          </div>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-2xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] flex items-center gap-2 text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{completedSessions} {t('pom_intervals')}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Dual Panel: Clock + Soundscapes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Pomodoro Clock (7 cols) */}
        <div
          className="lg:col-span-7 bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-8 shadow-xs flex flex-col items-center justify-center space-y-6 text-center"
          tabIndex={0}
          role="group"
          aria-label={t('pom_group_aria')}
          onKeyDown={handleTimerKeyDown}
        >
          
          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 bg-[#FAF9F5] dark:bg-[#1F1E1B] p-1.5 rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27]">
            <button
              onClick={() => setPreset('work', 25)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'work' && durationMinutes === 25
                  ? 'bg-[#D97757] text-white shadow-xs'
                  : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757]'
              }`}
            >
              {t('pom_preset_pomo')}
            </button>
            <button
              onClick={() => setPreset('work', 50)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'work' && durationMinutes === 50
                  ? 'bg-[#D97757] text-white shadow-xs'
                  : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757]'
              }`}
            >
              {t('pom_preset_deep')}
            </button>
            <button
              onClick={() => setPreset('short', 5)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'short'
                  ? 'bg-[#D97757] text-white shadow-xs'
                  : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757]'
              }`}
            >
              {t('pom_preset_short')}
            </button>
            <button
              onClick={() => setPreset('long', 15)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'long'
                  ? 'bg-[#D97757] text-white shadow-xs'
                  : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757]'
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
              className="text-7xl sm:text-8xl font-mono font-extrabold text-[#141413] dark:text-[#FAF9F5] tracking-tighter"
            >
              {formatTime(timeLeftSeconds)}
            </div>
            <span aria-live="polite" role="status" className="sr-only">
              {liveAnnouncement}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FAF9F5] dark:bg-[#252422] text-[#8C897F] border border-[#DFDACB] dark:border-[#2C2B27]">
              {mode === 'work' ? t('pom_mode_work') : t('pom_mode_break')}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md h-2 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-full overflow-hidden border border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
            <div
              className="h-full bg-[#D97757] transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleToggleTimer}
              className={`px-8 py-3.5 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 ${
                isRunning
                  ? 'bg-[#141413] dark:bg-[#FAF9F5] text-white dark:text-[#141413]'
                  : 'bg-[#D97757] hover:bg-[#C86646] text-white'
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
              className="p-3.5 rounded-2xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#8C897F] hover:text-[#141413] transition-colors cursor-pointer"
              title={t('pom_reset_title')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Ambient Sound Synthesizer & Scratchpad (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Ambient Soundscape Synthesizer */}
          <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#D97757]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#141413] dark:text-[#FAF9F5]">
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
                      ? 'bg-[#D97757] text-white border-[#D97757] shadow-xs'
                      : 'bg-[#FAF9F5] dark:bg-[#1F1E1B] border-[#DFDACB] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] hover:border-[#D97757]/60'
                  }`}
                >
                  {snd.shortLabel}
                </button>
              ))}
            </div>

            {/* Volume Slider */}
            {activeSound !== 'none' && (
              <div className="pt-2 flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-[#8C897F] shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                  className="w-full accent-[#D97757] cursor-pointer"
                />
                <span className="text-[11px] font-mono text-[#8C897F] w-10 text-right">
                  {Math.round(soundVolume * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Quick Focus Scratchpad */}
          <div className="bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
              <FileText className="w-4 h-4 text-[#D97757]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#141413] dark:text-[#FAF9F5]">
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
              className="w-full p-3 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5] resize-none leading-relaxed"
            />
          </div>

        </div>

      </div>

    </div>
  );
};
