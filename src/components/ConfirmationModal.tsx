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
        className="bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              modal.isDestructive
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                : 'bg-[#D97757]/15 text-[#D97757]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h3 className="text-base font-semibold text-[#141413] dark:text-[#FAF9F5]">
              {modal.title}
            </h3>
            <p className="text-sm text-[#5C5A54] dark:text-[#B5B2A8] mt-1.5 leading-relaxed">
              {modal.description}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] p-1 rounded-lg hover:bg-[#FAF9F5] dark:hover:bg-[#252422] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#DFDACB] dark:border-[#2C2B27]">
          <button
            type="button"
            id="modal-cancel-button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#252422] rounded-xl transition-colors"
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
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-sm flex items-center gap-1.5 transition-all ${
              modal.isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                : 'bg-[#D97757] hover:bg-[#C86646] shadow-[#D97757]/20'
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
