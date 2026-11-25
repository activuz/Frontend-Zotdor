import React from 'react';
import { Link } from 'react-router-dom';
import { ReportProblemButton } from '../../features/feedback/ReportProblem';

/** Shared loading / empty / error states (AGENTS.md: every request has loading, empty, error, success). */
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
    <p className="mt-3 text-[13px] text-ink-muted">
      Muammo takrorlanaversa: <ReportProblemButton error={message} className="min-h-touch font-semibold text-brand" />
    </p>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  text?: string;
  action?: { to: string; label: string };
}> = ({ title, text, action }) => (
  <div className="py-12 px-4 text-center">
    <p className="text-[17px] font-semibold text-ink">{title}</p>
    {text && <p className="mt-1 text-[15px] text-ink-muted">{text}</p>}
    {action && (
      <Link
        to={action.to}
        className="mt-4 inline-flex items-center min-h-touch px-5 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink"
      >
        {action.label}
      </Link>
    )}
  </div>
);
