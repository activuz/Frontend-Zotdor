import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Bug, LogOut, Plus, Search, User } from 'lucide-react';
import { useLogout, useMe } from '../../features/auth/api';
import { useUnreadCount } from '../../features/notifications/api';
import { enablePush } from '../../features/notifications/push';
import { inNativeApp, onNativeEvent, syncNativeDevice } from '../../features/notifications/native';
import { ReportProblemModal } from '../../features/feedback/ReportProblem';
import { useTaxonomy } from '../../features/reference/api';

const itemClass =
  'flex w-full items-center gap-3 min-h-touch px-4 text-left text-[15px] font-semibold hover:bg-brand-soft disabled:opacity-50';

/** Profile button: a small menu instead of going straight to /me. Closes on outside tap, Escape or navigation. */
const ProfileMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // A new page closes the menu (adjusted during render, not in an effect).
  const [path, setPath] = useState(location.pathname);
  if (path !== location.pathname) {
    setPath(location.pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Profil menyusi"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={`min-h-touch min-w-touch flex items-center justify-center rounded-xl text-ink hover:bg-brand-soft ${open ? 'bg-brand-soft' : ''}`}
      >
        <User className="w-6 h-6" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-lg"
        >
          <Link to="/me" className={`${itemClass} text-ink`}>
            <User className="w-5 h-5 text-brand" aria-hidden="true" />
            Profil
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setReporting(true);
            }}
            className={`${itemClass} text-ink`}
          >
            <Bug className="w-5 h-5 text-brand" aria-hidden="true" />
            Xatolik haqida xabar berish
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => {
                  setOpen(false);
                  navigate('/', { replace: true });
                },
              })
            }
            className={`${itemClass} text-danger`}
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            {logout.isPending ? 'Chiqilmoqda…' : 'Chiqish'}
          </button>
          {logout.isError && (
            <p role="alert" className="px-4 pb-2 text-[13px] text-danger">
              {logout.error.message}
            </p>
          )}
        </div>
      )}
      <ReportProblemModal open={reporting} onClose={() => setReporting(false)} />
    </div>
  );
};

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center min-h-touch px-3 rounded-xl text-[15px] font-semibold ${isActive ? 'bg-brand-soft text-ink' : 'text-ink hover:bg-brand-soft'}`;

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data: me } = useMe();
  const unread = useUnreadCount(Boolean(me));
  // A browser that already allowed notifications is (re)attached to whoever logs in on it.
  // Never shows a permission dialog: that only happens from the "Yoqish" button (FR-20).
  const meId = me?.id;
  useEffect(() => {
    if (!meId) return;
    if (!inNativeApp()) {
      void enablePush({ prompt: false }).catch(() => undefined);
      return;
    }
    // Android app (FR-21): send its Firebase token now and whenever the app gets a new one.
    void syncNativeDevice().catch(() => undefined);
    return onNativeEvent((e) => {
      if (e.type === 'push-token') void syncNativeDevice().catch(() => undefined);
    });
  }, [meId]);
  const taxonomy = useTaxonomy();
  const count = unread.data?.count ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-6 h-16 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Zotdor.uz — bosh sahifa">
          <img src="/favicon.webp" alt="" className="w-9 h-9 rounded-full border border-ink object-cover" />
          <span className="font-display text-[24px] leading-none text-ink">
            Zotdor<span className="text-brand">.uz</span>
          </span>
        </Link>

        <form
          role="search"
          className="hidden md:flex flex-1 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
          }}
        >
          <label htmlFor="header-q" className="sr-only">
            Auksion qidirish
          </label>
          <input
            id="header-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buqa, qoʻy, ot…"
            className="w-full min-h-touch rounded-l-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-brand focus:outline-none"
          />
          <button type="submit" aria-label="Qidirish" className="min-h-touch min-w-touch rounded-r-xl bg-ink text-white flex items-center justify-center">
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
        </form>

        <nav aria-label="Asosiy" className="hidden lg:flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            Bosh sahifa
          </NavLink>
          <NavLink to="/search" className={navClass}>
            Qidiruv
          </NavLink>
          {me && (
            <NavLink to="/me/bids" className={navClass}>
              Takliflarim
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/sell"
            className="hidden sm:inline-flex items-center gap-1 min-h-touch px-4 rounded-xl border border-ink text-[15px] font-semibold text-ink hover:bg-brand-soft"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Sotish
          </Link>
          {me ? (
            <>
              <Link
                to="/notifications"
                aria-label={count > 0 ? `Bildirishnomalar, ${count} ta yangi` : 'Bildirishnomalar'}
                className="relative min-h-touch min-w-touch flex items-center justify-center rounded-xl text-ink hover:bg-brand-soft"
              >
                <Bell className="w-6 h-6" aria-hidden="true" />
                {count > 0 && (
                  <span className="absolute top-1 right-1 min-w-[20px] h-5 px-1 rounded-full bg-danger text-white text-[13px] leading-5 text-center tabular-nums">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
              <ProfileMenu />
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center min-h-touch px-4 rounded-xl text-[15px] font-semibold text-brand hover:bg-brand-soft"
            >
              Kirish
            </Link>
          )}
        </div>
      </div>

      {taxonomy.isSuccess && taxonomy.data.directions.length > 0 && (
        <nav aria-label="Yoʻnalishlar" className="hidden md:block border-t border-line">
          <ul className="max-w-[1200px] mx-auto px-6 flex gap-1 overflow-x-auto no-scrollbar">
            {taxonomy.data.directions.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/search?direction=${d.id}`}
                  className="inline-flex items-center min-h-touch px-3 text-[15px] text-ink hover:text-brand"
                >
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
};
