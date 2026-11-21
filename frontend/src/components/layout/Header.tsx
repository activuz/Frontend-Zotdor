import React, { useState } from 'react';
import { Search, Plus, User, Globe, MapPin, ChevronDown, Sparkles, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCategories } from '../../api/hooks/useCategories';
import { CategoryIcon } from '../ui/CategoryIcon';

export const Header: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [currentLang, setCurrentLang] = useState<'uz' | 'cyrl'>('uz');
  const navigate = useNavigate();
  const location = useLocation();
  const { data: categories = [] } = useCategories();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() || selectedRegion) {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedRegion) params.set('region', selectedRegion);
      navigate(`/search?${params.toString()}`);
    } else {
      navigate('/search');
    }
  };

  const regions = [
    'Barcha viloyatlar',
    'Toshkent',
    'Samarqand',
    'Farg\'ona',
    'Buxoro',
    'Andijon',
    'Namangan',
    'Qashqadaryo',
    'Surxondaryo',
    'Xorazm',
    'Jizzax',
    'Sirdaryo',
    'Navoiy',
    'Qoraqalpog\'iston'
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#eef2dc]/95 backdrop-blur-md border-b border-[#c5d4a8] shadow-sm">
      
      {/* TOP MAIN HEADER */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Tagline */}
        <Link to="/" className="flex items-center space-x-2.5 shrink-0 group">
          <div className="relative">
            <img 
              src="/favicon.webp" 
              alt="Zotdor logo" 
              className="w-10 h-10 md:w-11 md:h-11 rounded-full border-2 border-[#1e3a0f] object-cover group-hover:scale-105 transition-transform" 
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#a8d45e] border-2 border-[#eef2dc] rounded-full animate-pulse"></span>
          </div>
          <div>
            <span className="text-xl md:text-2xl font-black tracking-tight text-[#1e3a0f] block leading-none font-display">
              Zotdor<span className="text-[#3d6b2e]">.uz</span>
            </span>
            <span className="text-[9px] md:text-[10px] uppercase font-extrabold tracking-wider text-[#4a5e3a] block mt-0.5">
              CHORVA BOZORI
            </span>
          </div>
        </Link>

        {/* Center: Desktop Integrated Search Bar */}
        <form 
          onSubmit={handleSearchSubmit} 
          className="hidden md:flex items-center flex-1 max-w-2xl bg-white border-2 border-[#c5d4a8] focus-within:border-[#3d6b2e] rounded-full p-1 transition-all shadow-inner"
        >
          {/* Region Select */}
          <div className="relative flex items-center pl-3 border-r border-[#c5d4a8]/70 pr-2">
            <MapPin className="w-4 h-4 text-[#3d6b2e] shrink-0 mr-1" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#1e3a0f] focus:outline-none cursor-pointer pr-4 appearance-none"
            >
              <option value="">Barcha hududlar</option>
              {regions.slice(1).map((reg) => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#4a5e3a] absolute right-1 pointer-events-none" />
          </div>

          {/* Search Text Input */}
          <div className="flex-1 flex items-center px-3">
            <Search className="w-4 h-4 text-[#4a5e3a] shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Qoraqalpog'iston buqasi, Hisori qo'y, zotdor ot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-medium text-[#1e3a0f] placeholder-[#4a5e3a]/60 bg-transparent focus:outline-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="bg-[#3d6b2e] hover:bg-[#1e3a0f] text-white text-xs font-bold px-5 py-2 rounded-full transition-all active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>Qidirish</span>
          </button>
        </form>

        {/* Right: Desktop Navigation Links & Action Buttons */}
        <div className="flex items-center space-x-2.5">
          
          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-1 mr-2 text-xs font-bold text-[#1e3a0f]">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                location.pathname === '/' ? 'bg-[#3d6b2e]/10 text-[#3d6b2e]' : 'hover:bg-[#dce8c8]/40'
              }`}
            >
              Bosh sahifa
            </Link>
            <Link
              to="/search"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                location.pathname === '/search' ? 'bg-[#3d6b2e]/10 text-[#3d6b2e]' : 'hover:bg-[#dce8c8]/40'
              }`}
            >
              Katalog
            </Link>
            <Link
              to="/auction"
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                location.pathname === '/auction' ? 'bg-[#3d6b2e]/10 text-[#3d6b2e]' : 'hover:bg-[#dce8c8]/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#a8d45e]" />
              Auksion
            </Link>
          </nav>

          {/* Language Switcher Button (Desktop & Mobile) */}
          <button
            onClick={() => setCurrentLang(currentLang === 'uz' ? 'cyrl' : 'uz')}
            className="hidden sm:flex items-center space-x-1 text-xs font-bold bg-[#dce8c8]/70 hover:bg-[#dce8c8] text-[#1e3a0f] px-3 py-2 rounded-full border border-[#c5d4a8] transition-colors cursor-pointer"
            title="Tilni almashtirish"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{currentLang === 'uz' ? 'Latin' : 'Кирилл'}</span>
          </button>

          {/* Add Listing CTA Button (Desktop Primary CTA) */}
          <Link
            to="/add"
            className="hidden sm:flex items-center space-x-1.5 bg-[#3d6b2e] hover:bg-[#1e3a0f] text-[#eef2dc] px-4 py-2 rounded-full text-xs font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer border border-[#a8d45e]/30"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ E'lon qo'shish</span>
          </Link>

          {/* Profile User Icon Link */}
          <Link
            to="/profile"
            className="p-2 rounded-full bg-[#dce8c8]/60 hover:bg-[#dce8c8] text-[#1e3a0f] transition-colors flex items-center justify-center"
            title="Profil"
          >
            <User className="w-5 h-5" />
          </Link>
        </div>

      </div>

      {/* DESKTOP CATEGORIES NAVIGATION BAR */}
      <div className="hidden md:block border-t border-[#c5d4a8]/60 bg-[#e6eccf]/80">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto no-scrollbar py-2 text-xs font-bold text-[#1e3a0f]">
          <div className="flex items-center space-x-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.id}`}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full transition-all hover:bg-white/80 border ${
                  location.pathname === `/category/${cat.id}`
                    ? 'bg-white text-[#1e3a0f] border-[#3d6b2e] shadow-sm'
                    : 'border-transparent hover:border-[#c5d4a8]'
                }`}
              >
                <CategoryIcon id={cat.id} className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>

          {/* Pedigree Verified Quick Filter Link */}
          <Link
            to="/search?pedigreeOnly=true"
            className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-[#a8d45e]/40 hover:bg-[#a8d45e]/70 text-[#1e3a0f] border border-[#3d6b2e]/30 shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#3d6b2e]" />
            <span>Zotdor Sertifikatli</span>
          </Link>
        </div>
      </div>

    </header>
  );
};
