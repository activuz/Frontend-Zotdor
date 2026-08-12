import React from 'react';
import { SearchX } from 'lucide-react';
import { Listing } from '../../types';
import { ListingCard } from './ListingCard';

interface ListingGridProps {
  listings: Listing[];
  onToggleLike?: (id: string, e: React.MouseEvent) => void;
  title?: string;
  emptyMessage?: string;
}

export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onToggleLike,
  title = "Barcha e'lonlar",
  emptyMessage = "E'lonlar topilmadi",
}) => {
  if (listings.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-white/60 rounded-3xl border border-[#c5d4a8] mx-4 my-6">
        <SearchX className="w-10 h-10 text-[#4a5e3a]/60 mx-auto mb-3" />
        <h4 className="text-base font-bold text-[#1e3a0f] font-display">{emptyMessage}</h4>
        <p className="text-xs text-[#4a5e3a] mt-1">Boshqa filtr yoki qidiruv so'zini sinab ko'ring</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#1e3a0f] font-display flex items-center gap-2">
            <span>{title}</span>
            <span className="text-xs bg-[#3d6b2e] text-[#eef2dc] px-2 py-0.5 rounded-full font-sans font-bold">
              {listings.length}
            </span>
          </h3>
        </div>
      )}

      {/* Responsive 2-column mobile, 3-column tablet, 4-column desktop grid matching wireframe */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {listings.map((item) => (
          <ListingCard key={item.id} listing={item} onToggleLike={onToggleLike} />
        ))}
      </div>
    </div>
  );
};
