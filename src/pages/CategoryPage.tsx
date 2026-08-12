import React from 'react';
import { useParams } from 'react-router-dom';
import { useCategories } from '../api/hooks/useCategories';
import { useListings, useToggleLike } from '../api/hooks/useListings';
import { ListingGrid } from '../components/ui/ListingGrid';
import { CategoryId } from '../types';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { CategoryIcon } from '../components/ui/CategoryIcon';

export const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: CategoryId }>();
  const { data: categories = [] } = useCategories();
  const currentCat = categories.find((c) => c.id === slug);

  const { data: listings = [], isLoading } = useListings({ categoryId: slug });
  const toggleLikeMutation = useToggleLike();

  const handleToggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLikeMutation.mutate(id);
  };

  const breadcrumbs = [
    { label: 'Bosh sahifa', path: '/' },
    { label: 'Yo\'nalishlar', path: '/' },
    { label: currentCat?.name || 'Kategoriya' },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb items={breadcrumbs} />

      {/* Category Info Header */}
      {currentCat && (
        <div className="bg-white p-5 mx-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#dce8c8]/50 rounded-2xl shrink-0">
              <CategoryIcon id={currentCat.id} className="w-9 h-9 text-[#3d6b2e]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-[#1e3a0f]">
                {currentCat.name}
              </h1>
              <p className="text-xs text-[#4a5e3a] font-medium">
                {currentCat.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-[#4a5e3a] text-xs">
          Yuklanmoqda...
        </div>
      ) : (
        <ListingGrid
          listings={listings}
          onToggleLike={handleToggleLike}
          title={`${currentCat?.shortName || 'Yo\'nalish'} bo'yicha e'lonlar`}
        />
      )}
    </div>
  );
};
