import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import { ConfirmationModalState } from '../types';
import { useT } from '../services/i18n';

interface ConfirmationModalProps {
  modal: ConfirmationModalState;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ modal, onClose }) => {
  const { t } = useT();
  if (!modal.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      id="confirmation-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="confirmation-modal-content"
        className="bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-[var(--text-primary)]"
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              modal.isDestructive
                ? 'bg-[var(--status-err-bg)] text-[var(--status-err-text)] border border-[var(--status-err-border)]'
                : 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {modal.title}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              {modal.description}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-default)]">
          <button
            type="button"
            id="modal-cancel-button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors cursor-pointer"
          >
            {modal.cancelLabel || t('cancel')}
          </button>
          <button
            type="button"
            id="modal-confirm-button"
            onClick={async () => {
              await modal.onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              modal.isDestructive
                ? 'bg-[var(--status-err-border)] hover:bg-[var(--status-err-text)]'
                : 'bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            <Check className="w-4 h-4" />
            {modal.confirmLabel || t('modal_confirm_action')}
          </button>
        </div>
      </div>
    </div>
  );
};
