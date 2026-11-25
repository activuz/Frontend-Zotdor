import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  ChevronRight,
  Gavel,
  Handshake,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  Tag,
  User,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useLogout, useMe } from '../auth/api';
import { PageLoading } from '../../components/ui/PageState';
import { formatDate } from '../../lib/format';
import { LocationPrompt } from '../location/LocationPrompt';
import { LocationPicker } from '../location/LocationPicker';
import { useDeviceLocation } from '../location/useDeviceLocation';
import { MapView } from '../location/MapView';
import { ReportProblemButton } from '../feedback/ReportProblem';

const MENU = [
  { to: '/me/auctions', label: 'Auksionlarim', icon: Tag },
  { to: '/me/bids', label: 'Takliflarim', icon: Gavel },
  { to: '/me/deals', label: 'Bitimlarim', icon: Handshake },
  { to: '/me/saved', label: 'Saqlanganlar', icon: Bookmark },
  { to: '/notifications', label: 'Bildirishnomalar', icon: Bell },
  { to: '/wallet', label: 'Hamyon', icon: WalletIcon },
];

/** Rendered inside RequireAuth, so `me` is a logged-in user with a complete profile. */
export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();

  if (!me) return <PageLoading />;
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(' ');

  return (
    <div className="max-w-xl mx-auto space-y-4">
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
        <p className="mt-3 text-[13px] text-ink-muted">{formatDate(me.created_at)} dan beri aʼzo</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/me/setup?next=/me"
            className="inline-flex items-center gap-2 min-h-touch px-4 rounded-xl border border-line text-[15px] font-semibold text-ink"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
            Profilni tahrirlash
          </Link>
          <Link
            to={`/u/${me.id}`}
            className="inline-flex items-center gap-2 min-h-touch px-4 rounded-xl border border-line text-[15px] font-semibold text-ink"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            Ommaviy profilim
          </Link>
        </div>
      </section>

      <MyLocation />

      <nav aria-label="Shaxsiy boʻlimlar">
        <ul className="bg-surface rounded-2xl border border-line divide-y divide-line">
          {MENU.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex items-center justify-between min-h-touch px-5 py-3 text-[15px] font-semibold text-ink"
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-brand" aria-hidden="true" />
                  {label}
                </span>
                <ChevronRight className="w-5 h-5 text-ink-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="bg-surface rounded-2xl border border-line">
        <ReportProblemButton variant="row" />
      </div>

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

/** The saved point (`/me/location`): used for "nearest" sorting and distances, seen by no one. */
const MyLocation: React.FC = () => {
  const { point, save, clear, status, message, hasLocation } = useDeviceLocation();
  const [picking, setPicking] = useState(false);
  const busy = status === 'locating';

  if (!hasLocation || !point) return <LocationPrompt />;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface" aria-labelledby="my-location">
      <h2 id="my-location" className="px-5 pt-4 font-display text-[20px] text-ink">
        Joylashuvim
      </h2>
      <p className="px-5 text-[13px] text-ink-muted">
        Yaqin auksionlarni saralash va masofa uchun. Bu nuqtani hech kim koʻrmaydi.
      </p>
      {/* key: a new point rebuilds the static preview. */}
      <MapView
        key={`${point.lat},${point.lng}`}
        mode="point"
        center={point}
        zoom={14}
        interactive={false}
        className="mt-3 h-44"
        label="Saqlangan joylashuvingiz xaritada"
      />
      <div className="flex flex-wrap gap-2 p-4">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-line px-4 text-[15px] font-semibold text-ink"
        >
          <MapPin className="w-4 h-4 text-brand" aria-hidden="true" />
          Xaritada oʻzgartirish
        </button>
        <button
          type="button"
          onClick={() => void clear()}
          disabled={busy}
          className="min-h-touch px-4 rounded-xl text-[15px] font-semibold text-ink-muted disabled:opacity-50"
        >
          Oʻchirish
        </button>
      </div>
      {message && !picking && (
        <p role="alert" className="px-5 pb-4 text-[13px] text-danger">
          {message}
        </p>
      )}
      <LocationPicker
        open={picking}
        title="Joylashuvni oʻzgartirish"
        note="Nuqta profilingizga saqlanadi. Uni hech kim koʻrmaydi."
        initial={point}
        busy={busy}
        error={picking ? message : ''}
        onConfirm={(p) => void save(p).then((ok) => ok && setPicking(false))}
        onClose={() => setPicking(false)}
      />
    </section>
  );
};
