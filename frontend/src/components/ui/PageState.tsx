import React from 'react';

/** Shared loading / error states (AGENTS.md: every request has loading, empty, error, success). */
export const PageLoading: React.FC<{ label?: string }> = ({ label = 'Yuklanmoqda…' }) => (
  <div className="py-16 text-center text-[15px] text-ink-muted" role="status" aria-live="polite">
    {label}
  </div>
);

export const PageError: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="max-w-sm mx-auto px-4 py-12 text-center" role="alert">
    <p className="text-[15px] text-ink">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-touch px-5 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink"
      >
        Qayta urinish
      </button>
    )}
  </div>
);
