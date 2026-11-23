import React from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-page text-ink flex flex-col">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2"
    >
      Asosiy qismga oʻtish
    </a>
    <Header />
    <main id="main" className="flex-1 w-full max-w-[1200px] mx-auto px-3 sm:px-6 pt-4 pb-24 md:pb-8">
      {children}
    </main>
    <Footer />
    <BottomNav />
  </div>
);
