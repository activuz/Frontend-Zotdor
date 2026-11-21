import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, MapPin, Pencil, Phone } from 'lucide-react';
import { useLogout, useMe } from '../features/auth/api';
import { PageLoading } from '../components/ui/PageState';

/** Rendered inside RequireAuth, so `me` is a logged-in user with a complete profile. */
export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();

  if (!me) return <PageLoading />;

  const fullName = [me.first_name, me.last_name].filter(Boolean).join(' ');
  const memberSince = new Date(me.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' });

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <section className="bg-surface rounded-2xl border border-line p-5">
        <h1 className="font-display text-[28px] leading-tight text-ink">{fullName}</h1>
        <dl className="mt-4 space-y-2 text-[15px] text-ink">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-brand" aria-hidden="true" />
            <dt className="sr-only">Telefon</dt>
            <dd className="tabular-nums">{me.phone}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand" aria-hidden="true" />
            <dt className="sr-only">Joylashuv</dt>
            <dd>{[me.district?.name, me.region?.name].filter(Boolean).join(', ')}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[14px] text-ink-muted">Aʼzo: {memberSince}</p>
        <Link
          to="/me/setup?next=/profile"
          className="mt-4 inline-flex items-center gap-2 min-h-touch px-4 rounded-xl border border-line text-[15px] font-semibold text-ink"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
          Profilni tahrirlash
        </Link>
      </section>

      {logout.isError && (
        <p role="alert" className="text-[15px] text-danger">
          {logout.error.message}
        </p>
      )}
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}
        className="w-full min-h-touch rounded-xl border border-line bg-surface text-[15px] font-semibold text-danger flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        {logout.isPending ? 'Chiqilmoqda…' : 'Chiqish'}
      </button>
    </div>
  );
};
