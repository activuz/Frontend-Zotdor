import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { NotFound } from './components/layout/NotFound';
import { LoginPage } from './features/auth/LoginPage';
import { ProfileSetupPage } from './features/auth/ProfileSetupPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { FeedPage } from './features/auctions/FeedPage';
import { SearchPage } from './features/auctions/SearchPage';
import { AuctionPage } from './features/auctions/AuctionPage';
import { DecisionPage } from './features/auctions/DecisionPage';
import { SellStartPage, SellWizardPage } from './features/sell/SellPage';
import { DealPage } from './features/deals/DealPage';
import { MyAuctionsPage, MyBidsPage, MyDealsPage, SavedPage } from './features/me/MeLists';
import { PublicProfilePage } from './features/me/PublicProfilePage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { TestPaymentPage, WalletPage } from './features/wallet/WalletPage';
import { RouteSeo } from './lib/seo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const auth = (page: React.ReactNode) => <RequireAuth>{page}</RequireAuth>;

/** Routes from docs/USER_FLOWS.md. */
export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <RouteSeo />
      <AppLayout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<FeedPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/a/:id" element={<AuctionPage />} />
            <Route path="/a/:id/decision" element={auth(<DecisionPage />)} />
            <Route path="/sell" element={auth(<SellStartPage />)} />
            <Route path="/sell/:id" element={auth(<SellWizardPage />)} />
            <Route path="/deals/:id" element={auth(<DealPage />)} />
            <Route path="/me" element={auth(<ProfilePage />)} />
            <Route path="/me/auctions" element={auth(<MyAuctionsPage />)} />
            <Route path="/me/bids" element={auth(<MyBidsPage />)} />
            <Route path="/me/deals" element={auth(<MyDealsPage />)} />
            <Route path="/me/saved" element={auth(<SavedPage />)} />
            <Route path="/me/setup" element={<ProfileSetupPage />} />
            <Route path="/notifications" element={auth(<NotificationsPage />)} />
            <Route path="/wallet" element={auth(<WalletPage />)} />
            <Route path="/wallet/test-payment/:id" element={auth(<TestPaymentPage />)} />
            <Route path="/u/:id" element={<PublicProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* Old demo paths. */}
            <Route path="/profile" element={<Navigate to="/me" replace />} />
            <Route path="/add" element={<Navigate to="/sell" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </AppLayout>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
