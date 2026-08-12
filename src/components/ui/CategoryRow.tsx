import React from 'react';
import { Category, CategoryId } from '../../types';
import { CategoryIcon } from './CategoryIcon';

interface CategoryRowProps {
  categories: Category[];
  selectedCategoryId: CategoryId | 'all';
  onSelectCategory: (id: CategoryId | 'all') => void;
}

export const CategoryRow: React.FC<CategoryRowProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  return (
    <div className="py-3 px-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-bold text-[#1e3a0f] tracking-wide font-display">
          Yo'nalishlar bo'yicha
        </h3>
        <button 
          onClick={() => onSelectCategory('all')} 
          className="text-xs font-semibold text-[#3d6b2e] hover:underline cursor-pointer"
        >
          Barchasi
        </button>
      </div>

      {/* Horizontal Scrollable Category Pills / Cards (Wireframe: category row) */}
      <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4">
        {/* All button */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex flex-col items-center shrink-0 p-3.5 rounded-2xl border transition-all cursor-pointer min-w-[76px] ${
            selectedCategoryId === 'all'
              ? 'bg-[#1e3a0f] text-[#eef2dc] border-[#1e3a0f] shadow-md scale-105'
              : 'bg-white text-[#1e3a0f] border-[#c5d4a8] hover:border-[#3d6b2e]'
          }`}
        >
          <div className="mb-1.5 p-1 rounded-lg">
            <CategoryIcon id="all" className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">Barchasi</span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex flex-col items-center shrink-0 p-3.5 rounded-2xl border transition-all cursor-pointer min-w-[88px] ${
                isSelected
                  ? 'bg-[#1e3a0f] text-[#eef2dc] border-[#1e3a0f] shadow-md scale-105'
                  : 'bg-white text-[#1e3a0f] border-[#c5d4a8] hover:border-[#3d6b2e]'
              }`}
            >
              <div className="mb-1.5 p-1 rounded-lg">
                <CategoryIcon id={cat.id} className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-center leading-tight">
                {cat.shortName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
