import React, { useEffect, useState } from 'react';
import { MessageSquarePlus, Trash2, X } from 'lucide-react';
import { listCoachChats, type CoachChatRecord } from '../services/coachHistory';
import { useCoachChatStore } from '../store/coachChatStore';
import { useT } from '../services/i18n';

interface CoachHistoryPanelProps {
  onClose: () => void;
  /** Called after a chat is opened or started, so narrow layouts can hide the list. */
  onPick: () => void;
}

export const CoachHistoryPanel: React.FC<CoachHistoryPanelProps> = ({ onClose, onPick }) => {
  const { t, formatDate } = useT();
  const { activeChatId, historyVersion, isSending, openChat, deleteChat, clearMessages } = useCoachChatStore();
  const [chats, setChats] = useState<CoachChatRecord[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCoachChats().then((list) => {
      if (!cancelled) setChats(list);
    });
    return () => {
      cancelled = true;
    };
  }, [historyVersion]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-hairline)] shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider">{t('coach_history_title')}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isSending}
            onClick={() => {
              clearMessages();
              onPick();
            }}
            title={t('coach_new_chat')}
            aria-label={t('coach_new_chat')}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] cursor-pointer disabled:opacity-40"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title={t('common_close')}
            aria-label={t('common_close')}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {chats === null ? (
          <li className="p-3 text-xs text-[var(--text-muted)]">{t('common_loading')}</li>
        ) : chats.length === 0 ? (
          <li className="p-3 text-xs text-[var(--text-muted)]">{t('coach_history_empty')}</li>
        ) : (
          chats.map((chat) => (
            <li
              key={chat.id}
              className={`rounded-xl border ${
                chat.id === activeChatId
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                  : 'border-transparent hover:bg-[var(--bg-hover)]'
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isSending}
                  aria-current={chat.id === activeChatId ? 'true' : undefined}
                  onClick={() => void openChat(chat.id).then(onPick)}
                  className="flex-1 min-w-0 text-left px-3 py-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="block text-xs font-semibold truncate">{chat.title || t('coach_history_untitled')}</span>
                  <span className="block text-[10px] text-[var(--text-muted)]">
                    {formatDate(chat.updatedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {t('coach_history_count', { count: chat.messages.filter((m) => !m.contentKey).length })}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setConfirmingId(chat.id)}
                  title={t('coach_history_delete')}
                  aria-label={`${t('coach_history_delete')}: ${chat.title}`}
                  className="p-1.5 mr-1 rounded-lg text-[var(--text-muted)] hover:text-rose-600 cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {confirmingId === chat.id && (
                <div className="flex items-center justify-between gap-2 px-3 pb-2 text-[11px]">
                  <span>{t('coach_history_confirm')}</span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(null);
                        void deleteChat(chat.id);
                      }}
                      className="font-bold text-[var(--status-err-text)] cursor-pointer"
                    >
                      {t('common_delete')}
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)} className="font-semibold cursor-pointer">
                      {t('common_cancel')}
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
      <p className="px-3 py-2 text-[10px] text-[var(--text-muted)] border-t border-[var(--border-hairline)] shrink-0">
        {t('coach_history_local_note')}
      </p>
    </div>
  );
};
