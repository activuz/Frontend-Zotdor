import React from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#eef2dc] text-[#1e3a0f] flex flex-col antialiased selection:bg-[#3d6b2e] selection:text-white">
      {/* Responsive Sticky Header with Desktop Categories Navigation */}
      <Header />

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
