import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './auth/LoginPage';
import { RequireStaff } from './auth/RequireStaff';
import { useMe } from './auth/api';
import { PanelLayout } from './layout/PanelLayout';
import { EmptyState } from './components/PageState';
import { Dashboard } from './pages/Dashboard';
import { AuctionQueue, AuctionReview } from './pages/Auctions';
import { Claims, Refunds, Reports } from './pages/Queues';
import { UserDetail, Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { Taxonomy } from './pages/Taxonomy';
import { Audit } from './pages/Audit';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } },
});

const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  useMe().data?.role === 'admin' ? <>{children}</> : <EmptyState title="Bu boʻlim faqat administrator uchun" />;

const Staff: React.FC = () => (
  <RequireStaff>
    <PanelLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auctions" element={<AuctionQueue />} />
        <Route path="/auctions/:id" element={<AuctionReview />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/taxonomy" element={<AdminOnly><Taxonomy /></AdminOnly>} />
        <Route path="/audit" element={<AdminOnly><Audit /></AdminOnly>} />
        <Route path="*" element={<EmptyState title="Sahifa topilmadi" action={{ to: '/', label: 'Bosh sahifaga' }} />} />
      </Routes>
    </PanelLayout>
  </RequireStaff>
);

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<Staff />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);
