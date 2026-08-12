import React, { useState } from 'react';
import { useCategories } from '../api/hooks/useCategories';
import { useListings, useToggleLike } from '../api/hooks/useListings';
import { ListingGrid } from '../components/ui/ListingGrid';
import { CategoryId } from '../types';
import { Search, Filter, ShieldCheck, RefreshCw } from 'lucide-react';
import { CategoryIcon } from '../components/ui/CategoryIcon';

export const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [pedigreeOnly, setPedigreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  const { data: categories = [] } = useCategories();
  const { data: listings = [], isLoading } = useListings({
    searchQuery,
    categoryId: selectedCategory,
    pedigreeOnly,
    sortBy,
  });

  const toggleLikeMutation = useToggleLike();

  const handleToggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLikeMutation.mutate(id);
  };

  const handleReset = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setPedigreeOnly(false);
    setSortBy('newest');
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="px-4 pt-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chorva nomi, zoti, viloyat bo'yicha qidiruv..."
            className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-[#c5d4a8] text-sm text-[#1e3a0f] placeholder-[#6b8f4e] focus:outline-none focus:ring-2 focus:ring-[#3d6b2e] shadow-sm font-medium"
          />
          <Search className="w-5 h-5 text-[#3d6b2e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6b8f4e]"
            >
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* Filter chips section */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#1e3a0f] flex items-center gap-1 font-display">
            <Filter className="w-3.5 h-3.5 text-[#3d6b2e]" />
            Filtrlar
          </span>
          <button
            onClick={handleReset}
            className="text-[11px] font-semibold text-[#3d6b2e] flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Qayta o'rnatish
          </button>
        </div>

        {/* Direction category chips */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#1e3a0f] text-[#eef2dc]'
                : 'bg-white text-[#1e3a0f] border border-[#c5d4a8]'
            }`}
          >
            Barcha yo'nalishlar
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1e3a0f] text-[#eef2dc]'
                  : 'bg-white text-[#1e3a0f] border border-[#c5d4a8]'
              }`}
            >
              <CategoryIcon id={cat.id} className="w-3.5 h-3.5" />
              <span>{cat.shortName}</span>
            </button>
          ))}
        </div>

        {/* Sub-filters & sorting */}
        <div className="flex items-center space-x-2 pt-1">
          {/* Pedigree checkbox toggle */}
          <button
            onClick={() => setPedigreeOnly(!pedigreeOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              pedigreeOnly
                ? 'bg-[#a8d45e] text-[#1e3a0f] border border-[#3d6b2e]'
                : 'bg-white text-[#4a5e3a] border border-[#c5d4a8]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Faqat Zotdor (Pedigree)
          </button>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'price_asc' | 'price_desc')}
            className="px-3 py-1.5 bg-white border border-[#c5d4a8] rounded-xl text-xs font-bold text-[#1e3a0f] focus:outline-none"
          >
            <option value="newest">Eng yangilar</option>
            <option value="price_asc">Arzonroq</option>
            <option value="price_desc">Qimmatroq</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12 text-[#4a5e3a] text-xs">
          Qidirilmoqda...
        </div>
      ) : (
        <ListingGrid
          listings={listings}
          onToggleLike={handleToggleLike}
          title="Qidiruv natijalari"
        />
      )}
    </div>
  );
};
