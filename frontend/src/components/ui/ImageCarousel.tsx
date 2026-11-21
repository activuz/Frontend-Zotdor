import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface ImageCarouselProps {
  images: string[];
  altTitle: string;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, altTitle }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-64 bg-[#dce8c8]/50 rounded-3xl flex flex-col items-center justify-center text-[#4a5e3a]">
        <ImageIcon className="w-12 h-12 mb-2" />
        <span className="text-xs font-semibold">Rasm mavjud emas</span>
      </div>
    );
  }

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-3 px-4">
      {/* Main Image frame with wireframe left/right arrows */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black/5 rounded-3xl overflow-hidden border-2 border-[#c5d4a8] shadow-md group">
        <img
          src={images[activeIndex]}
          alt={`${altTitle} - ${activeIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {/* Counter Badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-bold">
          {activeIndex + 1} / {images.length}
        </div>

        {/* Left Arrow Button (Wireframe <) */}
        {images.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#1e3a0f] shadow-md flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
            aria-label="Oldingi rasm"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right Arrow Button (Wireframe >) */}
        {images.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#1e3a0f] shadow-md flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
            aria-label="Keyingi rasm"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Media Ro'yxati (Thumbnail horizontal scroll matching wireframe `media ro'yxati`) */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6b8f4e]">
            Media ro'yxati ({images.length})
          </span>
        </div>

        <div className="flex items-center space-x-2.5 overflow-x-auto no-scrollbar py-1">
          {images.map((img, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`relative shrink-0 w-20 h-16 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#1e3a0f] ring-2 ring-[#3d6b2e] scale-105 shadow-sm'
                    : 'border-[#c5d4a8] opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
