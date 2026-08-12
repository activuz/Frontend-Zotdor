import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Plus, Gavel, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Homiy', icon: Home },
    { path: '/search', label: 'Qidiruv', icon: Search },
    // Center button is handled separately for elevated FAB styling
    { path: '/add', label: 'Add', isCenter: true },
    { path: '/auction', label: 'Auksion', icon: Gavel },
    { path: '/profile', label: 'Profil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#eef2dc]/95 backdrop-blur-md border-t border-[#c5d4a8] shadow-lg max-w-md mx-auto sm:max-w-full md:hidden">
      <div className="flex items-center justify-around h-16 px-2 relative max-w-lg mx-auto">
        {navItems.map((item) => {
          if (item.isCenter) {
            const isActive = location.pathname === '/add';
            return (
              <NavLink
                key="/add"
                to="/add"
                className="relative -top-5 flex flex-col items-center group cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full bg-[#1e3a0f] text-[#eef2dc] border-4 border-[#eef2dc] flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 active:scale-95 ${isActive ? 'ring-2 ring-[#3d6b2e]' : ''}`}>
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-bold text-[#1e3a0f] -mt-0.5">
                  E'lon qo'shish
                </span>
              </NavLink>
            );
          }

          const Icon = item.icon!;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all cursor-pointer ${
                isActive 
                  ? 'text-[#1e3a0f] font-bold scale-105' 
                  : 'text-[#4a5e3a] hover:text-[#1e3a0f]'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-[#dce8c8]' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[11px] font-medium leading-none mt-1">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
