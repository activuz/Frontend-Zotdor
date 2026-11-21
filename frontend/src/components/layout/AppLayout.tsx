import React from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { DemoNotice } from './DemoNotice';

interface AppLayoutProps {
  children: React.ReactNode;
}

/** Screens backed by the real API; every other screen still shows sample data. */
const REAL_DATA_PATHS = ['/login', '/me/setup', '/profile', '/wallet'];

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const showDemoNotice = !REAL_DATA_PATHS.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col antialiased selection:bg-brand selection:text-white">
      {/* Responsive Sticky Header with Desktop Categories Navigation */}
      <Header />
      {showDemoNotice && <DemoNotice />}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto pb-20 md:pb-8 pt-4 px-3 sm:px-6">
        {children}
      </main>

      {/* Full E-Commerce Footer */}
      <Footer />

      {/* Mobile-Only Fixed Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};
