import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdBanner: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-2">
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#1e3a0f] via-[#2d5a20] to-[#1e3a0f] text-[#eef2dc] p-6 shadow-md border border-[#3d6b2e]">
        {/* Subtle background image overlay */}
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: "url('/image2.webp')" }}
        />

        {/* Decorative star animations matching landing page */}
        <div className="absolute top-3 right-4 text-[#a8d45e] star-spin select-none opacity-60" aria-hidden="true">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="absolute bottom-4 left-8 text-[#a8d45e] star-spin select-none opacity-50" aria-hidden="true" style={{ animationDelay: '2s' }}>
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center space-x-1.5 bg-[#3d6b2e]/90 text-[#a8d45e] px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Zotdor Auksion 2026</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-display leading-tight mb-2 text-white">
            Eng sifatli zotdor bo'rdoqilar va uloq otlari auksioni
          </h2>

          <p className="text-xs sm:text-sm text-[#dce8c8] font-medium leading-relaxed mb-4 max-w-md">
            Do'stlar, endi narxlarni o'zingiz belgilang! Auksionda ishtirok eting va toza zotli jonivorlarni qulay narxda xarid qiling.
          </p>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/auction')}
              className="px-5 py-2.5 bg-[#3d6b2e] hover:bg-[#2d5a20] text-white font-bold text-xs sm:text-sm rounded-full transition-all active:scale-95 shadow-md inline-flex items-center space-x-2 cursor-pointer"
            >
              <span>Auksionga o'tish</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-semibold text-[#a8d45e] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#a8d45e] animate-pulse"></span>
              Jonli savdo ketmoqda
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
