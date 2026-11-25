import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Native <dialog>: the browser traps focus, closes on Escape and returns focus to the opener
 * (DESIGN.md §4).
 */
export const Modal: React.FC<ModalProps> = ({ open, title, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink"
    >
      {open && (
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="font-display text-[20px] leading-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="-mt-2 -mr-2 min-h-touch min-w-touch flex items-center justify-center rounded-xl text-ink-muted"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  );
};
