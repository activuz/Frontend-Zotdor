import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLogout, useMe } from '../auth/api';
import { useStats } from '../api/panel';

interface Item {
  to: string;
  label: string;
  count?: number;
  admin?: boolean;
}

export const PanelLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: me } = useMe();
  const stats = useStats();
  const logout = useLogout();
  const q = stats.data?.queues;
  const isAdmin = me?.role === 'admin';

  const items: Item[] = [
    { to: '/', label: 'Umumiy holat' },
    { to: '/auctions', label: 'Moderatsiya', count: q?.pending_review },
    { to: '/reports', label: 'Shikoyatlar', count: q?.reports },
    { to: '/claims', label: '“Bitim boʻlmadi”', count: q?.claims },
    { to: '/refunds', label: 'Pul qaytarish', count: q?.refunds },
    { to: '/leads', label: 'Sayt arizalari', count: q?.leads },
    { to: '/users', label: 'Foydalanuvchilar' },
    { to: '/settings', label: 'Sozlamalar' },
    { to: '/taxonomy', label: 'Toifalar va tumanlar', admin: true },
    { to: '/audit', label: 'Audit jurnali', admin: true },
  ];

  return (
    <div className="min-h-screen bg-page text-ink md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b md:border-b-0 md:border-r border-line bg-surface md:min-h-screen">
        <div className="px-4 py-4 flex items-center justify-between md:block">
          <p className="font-display text-[20px]">
            Zotdor<span className="text-brand">.uz</span> panel
          </p>
          {me && (
            <p className="text-[13px] text-ink-muted md:mt-1">
              {me.first_name} · {me.role === 'admin' ? 'Administrator' : 'Moderator'}
            </p>
          )}
        </div>
        <nav aria-label="Panel boʻlimlari" className="px-2 pb-3 overflow-x-auto">
          <ul className="flex md:block gap-1">
            {items
              .filter((i) => !i.admin || isAdmin)
              .map((i) => (
                <li key={i.to} className="shrink-0">
                  <NavLink
                    to={i.to}
                    end={i.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2 min-h-touch px-3 rounded-xl text-[15px] ${isActive ? 'bg-brand-soft font-semibold' : 'hover:bg-page'}`
                    }
                  >
                    {i.label}
                    {i.count ? (
                      <span className="rounded-full bg-danger px-2 text-[13px] text-white tabular-nums">{i.count}</span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            <li className="shrink-0 md:mt-4">
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="w-full text-left min-h-touch px-3 rounded-xl text-[15px] text-danger hover:bg-danger-soft"
              >
                Chiqish
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <main id="main" className="min-w-0 p-4 md:p-6 max-w-[1200px]">
        {children}
      </main>
    </div>
  );
};
