import React, { useState } from 'react';
import { useCategories } from '../api/hooks/useCategories';
import { useListings, useToggleLike } from '../api/hooks/useListings';
import { CategoryRow } from '../components/ui/CategoryRow';
import { AdBanner } from '../components/ui/AdBanner';
import { ListingGrid } from '../components/ui/ListingGrid';
import { CategoryId } from '../types';
import { Sparkles, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const navigate = useNavigate();

  const { data: categories = [] } = useCategories();
  const { data: listings = [], isLoading } = useListings({ categoryId: selectedCategory });
  const toggleLikeMutation = useToggleLike();

  const handleToggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLikeMutation.mutate(id);
  };

  const featuredListings = listings.filter((l) => l.isFeatured);

  return (
    <div className="space-y-4">
      {/* Top Advertisement Banner matching wireframe */}
      <AdBanner />

      {/* Categories Row matching wireframe & direction requirements */}
      <CategoryRow
        categories={categories}
        selectedCategoryId={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Filter and Sorting bar */}
      <div className="px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-[#1e3a0f] flex items-center gap-1 font-display">
            <TrendingUp className="w-4 h-4 text-[#3d6b2e]" />
            Saralangan e'lonlar
          </span>
        </div>
        <button
          onClick={() => navigate('/search')}
          className="text-xs font-semibold text-[#3d6b2e] bg-white border border-[#c5d4a8] px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-[#dce8c8]/40 transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtrlar
        </button>
      </div>

      {/* Featured Carousel / Section if showing all */}
      {selectedCategory === 'all' && featuredListings.length > 0 && (
        <div className="bg-[#1e3a0f]/5 py-3 rounded-3xl border border-[#c5d4a8]/50 mx-2">
          <div className="px-4 mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3d6b2e] flex items-center gap-1.5 font-display">
              <Sparkles className="w-3.5 h-3.5 text-[#a8d45e]" />
              TOP Zotdor e'lonlar
            </h3>
          </div>
          <div className="flex items-stretch space-x-3 overflow-x-auto no-scrollbar px-4 pb-2">
            {featuredListings.map((item) => (
              <div key={item.id} className="w-64 shrink-0">
                <div
                  onClick={() => navigate(`/listing/${item.id}`)}
                  className="bg-white rounded-2xl overflow-hidden border border-[#c5d4a8] shadow-sm hover:shadow-md transition-all p-2.5 cursor-pointer flex space-x-3 items-center"
                >
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="w-20 h-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-[#dce8c8] text-[#1e3a0f] px-1.5 py-0.5 rounded">
                      {item.attributes.breed || item.attributes.directionLabel}
                    </span>
                    <h4 className="text-xs font-bold text-[#1e3a0f] truncate mt-1 font-display">
                      {item.title}
                    </h4>
                    <p className="text-xs font-extrabold text-[#3d6b2e] mt-1 font-display">
                      {item.priceFormatted}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listing Feed matching wireframe grid */}
      {isLoading ? (
        <div className="text-center py-12 text-[#4a5e3a] font-medium text-xs">
          E'lonlar yuklanmoqda...
        </div>
      ) : (
        <ListingGrid
          listings={listings}
          onToggleLike={handleToggleLike}
          title={selectedCategory === 'all' ? "So'nggi e'lonlar" : "Yo'nalishdagi e'lonlar"}
        />
      )}
    </div>
  );
};
