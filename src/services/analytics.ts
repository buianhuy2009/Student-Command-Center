// Simple analytics stub — Plausible/gtag/PostHog hook + web-vitals
export type AnalyticsEvent = 'canvas_connected' | 'assignment_created' | 'pomodoro_complete' | 'syllabus_parsed' | 'command_executed' | 'focus_session' | 'grade_predicted' | 'page_view' | 'web_vital' | 'pwa_install_accepted' | 'syllabus_deployed' | 'focus_week_scheduled' | 'exam_plan_created' | 'teacher_followup_drafted' | 'voice_dictation_used' | 'offline_queue_flushed' | 'trash_restored' | 'sample_data_enabled';
export function trackEvent(event: AnalyticsEvent, props?: Record<string, any>) {
  try {
    // Plausible
    (window as any).plausible?.(event, { props });
    // gtag
    (window as any).gtag?.('event', event, props);
    // PostHog
    (window as any).posthog?.capture(event, props);
    // Vercel Speed Insights
    (window as any).va?.track?.(event, props);
    console.debug('[analytics]', event, props);
    const raw = localStorage.getItem('scc_analytics_queue_v1');
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ event, props, ts: Date.now() });
    if (arr.length > 200) arr.shift();
    localStorage.setItem('scc_analytics_queue_v1', JSON.stringify(arr));
  } catch {}
}
export function trackPageView(path: string) { trackEvent('page_view', { path }); }

// Web vitals reporter — call from main.tsx
export function reportWebVitals() {
  try {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (lastEntry) {
          const value = lastEntry.renderTime || lastEntry.loadTime || lastEntry.startTime;
          trackEvent('web_vital', { name: 'LCP', value });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true } as any);
    } catch {}

    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            trackEvent('web_vital', { name: 'CLS', value: clsValue });
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true } as any);
    } catch {}

    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          trackEvent('web_vital', { name: 'INP', value: entry.duration });
        }
      });
      inpObserver.observe({ type: 'first-input', buffered: true } as any);
    } catch {}
  } catch {}
}
