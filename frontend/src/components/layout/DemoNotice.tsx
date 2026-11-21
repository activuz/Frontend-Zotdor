import React from 'react';
import { Info } from 'lucide-react';

/**
 * Shown on screens that still use sample data (auctions/listings, phases 3–4).
 * Remove together with src/mocks once those screens read the real API.
 */
export const DemoNotice: React.FC = () => (
  <div role="note" className="bg-surface border-b border-line">
    <p className="max-w-7xl mx-auto px-4 py-2 flex items-start gap-2 text-[14px] text-ink">
      <Info className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
      <span>
        Bu sahifadagi eʼlon va auksionlar — namuna. Ularga qoʻyilgan taklif hech qayerga yuborilmaydi va sahifa
        yangilanganda yoʻqoladi.
      </span>
    </p>
  </div>
);
