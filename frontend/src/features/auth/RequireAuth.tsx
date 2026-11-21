import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from './api';
import { PageError, PageLoading } from '../../components/ui/PageState';

/** Only lets logged-in users with a complete profile through (FR-01, FR-02). */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { data: me, isPending, isError, error, refetch } = useMe();
  const next = encodeURIComponent(location.pathname + location.search);

  if (isPending) return <PageLoading />;
  if (isError) return <PageError message={error.message} onRetry={() => void refetch()} />;
  if (!me) return <Navigate to={`/login?next=${next}`} replace />;
  if (me.needs_profile) return <Navigate to={`/me/setup?next=${next}`} replace />;
  return <>{children}</>;
};
