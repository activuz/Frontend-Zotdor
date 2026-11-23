import React from 'react';
import { NavLink } from 'react-router-dom';
import { Gavel, Home, Plus, Search, User } from 'lucide-react';

/** DESIGN.md §6: Bosh sahifa, Qidiruv, Sotish, Takliflarim, Profil. */
const ITEMS = [
  { to: '/', label: 'Bosh sahifa', icon: Home, end: true },
  { to: '/search', label: 'Qidiruv', icon: Search },
  { to: '/sell', label: 'Sotish', icon: Plus },
  { to: '/me/bids', label: 'Takliflarim', icon: Gavel },
  { to: '/me', label: 'Profil', icon: User, end: true },
];

export const BottomNav: React.FC = () => (
  <nav aria-label="Pastki menyu" className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-line bg-page md:hidden">
    <ul className="h-full grid grid-cols-5">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              `h-full flex flex-col items-center justify-center gap-0.5 text-[13px] ${isActive ? 'font-semibold text-ink' : 'text-ink-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`px-3 py-0.5 rounded-full ${isActive ? 'bg-brand-soft' : ''}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);
