import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { AddListingPage } from './pages/AddListingPage';
import { AuctionPage } from './pages/AuctionPage';
import { ProfilePage } from './pages/ProfilePage';
import { CategoryPage } from './pages/CategoryPage';
import { LoginPage } from './features/auth/LoginPage';
import { ProfileSetupPage } from './features/auth/ProfileSetupPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { WalletPage } from './features/wallet/WalletPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/listing/:id" element={<ListingDetailPage />} />
            <Route
              path="/add"
              element={
                <RequireAuth>
                  <AddListingPage />
                </RequireAuth>
              }
            />
            <Route path="/auction" element={<AuctionPage />} />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/wallet"
              element={
                <RequireAuth>
                  <WalletPage />
                </RequireAuth>
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/me/setup" element={<ProfileSetupPage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
