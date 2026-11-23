import React from 'react';
import { EmptyState } from '../ui/PageState';

export const NotFound: React.FC = () => (
  <EmptyState
    title="Sahifa topilmadi"
    text="Havola eskirgan yoki notoʻgʻri boʻlishi mumkin."
    action={{ to: '/', label: 'Bosh sahifaga qaytish' }}
  />
);
