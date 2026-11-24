import { runLocalAsrClips } from './localMediaManager';
import { registerOfflineAsrRunner } from '../store/lectureStore';
import { t } from './i18n';
import { formatMmSs } from '../utils/audioChunking';

let registered = false;

export function ensureOfflineAsrRegistered(): void {
  if (registered) return;
  registered = true;

  registerOfflineAsrRunner(async ({ lectureId, mode, language, clips, signal, onClipDone, onProgress }) => {
    await runLocalAsrClips({
      modelTier: mode,
      language,
      clips,
      signal,
      onProgress: (p) => {
        if (p.stage === 'downloading') {
          const mbLoaded = p.loaded ? (p.loaded / (1024 * 1024)).toFixed(1) : '0.0';
          const mbTotal = p.total ? (p.total / (1024 * 1024)).toFixed(1) : null;
          onProgress({
            percent: p.percent,
            label: t('lecture_prog_asr_download'),
            detail: mbTotal ? `${mbLoaded} / ${mbTotal} MB` : `${mbLoaded} MB`,
          });
        } else {
          onProgress({
            percent: p.percent,
            label: t('lecture_prog_clip', {
              current: p.currentClip || 1,
              total: p.totalClips || clips.length,
            }),
            currentItem: p.currentClip,
            totalItems: p.totalClips || clips.length,
          });
        }
      },
      onClipDone: async (seg, completed, total) => {
        if (!seg.text) return;
        await onClipDone(
          {
            id: `${lectureId}-clip-${seg.chunkIndex}`,
            lectureId,
            chunkIndex: seg.chunkIndex,
            startSec: seg.startSec,
            endSec: seg.endSec,
            text: seg.text,
          },
          completed,
          total
        );
        onProgress({
          percent: Math.round(25 + (completed / Math.max(1, total)) * 73),
          label: t('lecture_prog_clip', { current: completed, total }),
          detail: `${formatMmSs(seg.startSec)} – ${formatMmSs(seg.endSec)}`,
          currentItem: completed,
          totalItems: total,
        });
      },
    });
  });
}

ensureOfflineAsrRegistered();
