import React from 'react';
import { Phone, ShieldCheck, Heart, List, Settings, HelpCircle, ChevronRight, Star } from 'lucide-react';
import { useListings } from '../api/hooks/useListings';
import { ListingGrid } from '../components/ui/ListingGrid';

export const ProfilePage: React.FC = () => {
  const { data: allListings = [] } = useListings();
  const likedListings = allListings.filter((l) => l.isLiked);

  return (
    <div className="space-y-4 px-4 py-2">
      {/* Profile Header Card */}
      <div className="bg-white p-5 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <img
              src="/founder.webp"
              alt="Profil rasmi"
              className="w-16 h-16 rounded-full object-cover border-2 border-[#1e3a0f]"
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-[#a8d45e] border-2 border-white rounded-full"></span>
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-1.5">
              <h2 className="text-lg font-bold text-[#1e3a0f] font-display">
                Sherzodbek Chorvador
              </h2>
              <ShieldCheck className="w-4 h-4 text-[#3d6b2e]" />
            </div>
            <p className="text-xs text-[#6b8f4e] flex items-center gap-1 font-semibold">
              <Phone className="w-3 h-3 text-[#3d6b2e]" />
              +998 90 123 45 67
            </p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="bg-[#dce8c8] text-[#1e3a0f] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-current text-amber-500" />
                4.9 Rating
              </span>
              <span className="text-[10px] text-[#4a5e3a]">2023-yildan a'zo</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#eef2dc] text-center">
          <div className="bg-[#f5f8eb] p-2.5 rounded-2xl border border-[#c5d4a8]">
            <span className="text-xs font-bold text-[#1e3a0f] block font-display">3</span>
            <span className="text-[10px] text-[#6b8f4e]">Mening e'lonlarim</span>
          </div>
          <div className="bg-[#f5f8eb] p-2.5 rounded-2xl border border-[#c5d4a8]">
            <span className="text-xs font-bold text-[#1e3a0f] block font-display">{likedListings.length}</span>
            <span className="text-[10px] text-[#6b8f4e]">Saralanganlar</span>
          </div>
          <div className="bg-[#f5f8eb] p-2.5 rounded-2xl border border-[#c5d4a8]">
            <span className="text-xs font-bold text-[#1e3a0f] block font-display">12</span>
            <span className="text-[10px] text-[#6b8f4e]">Bitimlar</span>
          </div>
        </div>
      </div>

      {/* Menu Options */}
      <div className="bg-white rounded-3xl border border-[#c5d4a8] shadow-sm divide-y divide-[#eef2dc] overflow-hidden">
        <button className="w-full p-4 flex items-center justify-between text-left hover:bg-[#f5f8eb] transition-colors cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#dce8c8] text-[#1e3a0f] flex items-center justify-center">
              <List className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#1e3a0f] block font-display">Mening e'lonlarim</span>
              <span className="text-[10px] text-[#6b8f4e]">Faol va arxivlangan e'lonlar</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6b8f4e]" />
        </button>

        <button className="w-full p-4 flex items-center justify-between text-left hover:bg-[#f5f8eb] transition-colors cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#dce8c8] text-[#1e3a0f] flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#1e3a0f] block font-display">Saralanganlar</span>
              <span className="text-[10px] text-[#6b8f4e]">Saqlab qo'yilgan chorva mollari</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6b8f4e]" />
        </button>

        <button className="w-full p-4 flex items-center justify-between text-left hover:bg-[#f5f8eb] transition-colors cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#dce8c8] text-[#1e3a0f] flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#1e3a0f] block font-display">Sozlamalar</span>
              <span className="text-[10px] text-[#6b8f4e]">Profil va bildirishnomalar</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6b8f4e]" />
        </button>

        <button className="w-full p-4 flex items-center justify-between text-left hover:bg-[#f5f8eb] transition-colors cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#dce8c8] text-[#1e3a0f] flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#1e3a0f] block font-display">Yordam va Qo'llab-quvvatlash</span>
              <span className="text-[10px] text-[#6b8f4e]">Biz bilan bog'lanish, Savol-javoblar</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6b8f4e]" />
        </button>
      </div>

      {/* Favorites preview */}
      {likedListings.length > 0 && (
        <div className="pt-2">
          <ListingGrid listings={likedListings} title="Saralangan e'lonlaringiz" />
        </div>
      )}
    </div>
  );
};
