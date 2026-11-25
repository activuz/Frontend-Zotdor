import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useLogout, useMe } from './api';
import { PageError, PageLoading } from '../components/PageState';

/** Only moderators and admins get in (FR-16). The API enforces this too; this only shapes the UI. */
export const RequireStaff: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { data: me, isPending, isError, error, refetch } = useMe();
  const logout = useLogout();

  if (isPending) return <PageLoading />;
  if (isError) return <PageError message={error.message} onRetry={() => void refetch()} />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (me.role !== 'moderator' && me.role !== 'admin')
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center" role="alert">
        <p className="text-[17px] font-semibold text-ink">Bu boʻlim faqat moderator va administratorlar uchun.</p>
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="mt-4 min-h-touch px-5 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink"
        >
          Boshqa raqam bilan kirish
        </button>
      </div>
    );
  return <>{children}</>;
};
