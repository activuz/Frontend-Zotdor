import React from 'react';
import { Heart, MapPin, ShieldCheck, Scale, Calendar } from 'lucide-react';
import { Listing } from '../../types';
import { useNavigate } from 'react-router-dom';

interface ListingCardProps {
  listing: Listing;
  onToggleLike?: (id: string, e: React.MouseEvent) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, onToggleLike }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/listing/${listing.id}`)}
      className="bg-white rounded-3xl overflow-hidden border border-[#c5d4a8] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group cursor-pointer"
    >
      {/* Image container */}
      <div className="relative aspect-[4/3] bg-[#dce8c8]/40 overflow-hidden">
        <img
          src={listing.images[0]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Direction Tag */}
        <span className="absolute top-2.5 left-2.5 bg-[#1e3a0f]/80 backdrop-blur-md text-[#eef2dc] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#3d6b2e]/50">
          {listing.attributes.directionLabel}
        </span>

        {/* Pedigree Verified Badge */}
        {listing.attributes.pedigree && (
          <span className="absolute top-2.5 right-10 bg-[#a8d45e] text-[#1e3a0f] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
            Zotdor
          </span>
        )}

        {/* Like Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleLike) onToggleLike(listing.id, e);
          }}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-colors cursor-pointer ${
            listing.isLiked ? 'bg-red-500 text-white' : 'bg-black/30 text-white hover:bg-black/50'
          }`}
          aria-label="Saralanganlarga qo'shish"
        >
          <Heart className={`w-4 h-4 ${listing.isLiked ? 'fill-current' : ''}`} />
        </button>

        {/* Price Badge over Image */}
        <div className="absolute bottom-2 left-2 right-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 rounded-b-2xl">
          <div className="text-white font-extrabold text-sm sm:text-base font-display">
            {listing.priceFormatted}
          </div>
        </div>
      </div>

      {/* Details Container */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          {/* Title */}
          <h4 className="text-xs sm:text-sm font-bold text-[#1e3a0f] line-clamp-2 leading-snug mb-2 font-display">
            {listing.title}
          </h4>

          {/* Attributes Row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[10px] font-semibold text-[#4a5e3a]">
            {listing.attributes.breed && (
              <span className="bg-[#f5f8eb] border border-[#c5d4a8] px-2 py-0.5 rounded-md">
                Zoti: {listing.attributes.breed}
              </span>
            )}
            {listing.attributes.weight && (
              <span className="bg-[#f5f8eb] border border-[#c5d4a8] px-2 py-0.5 rounded-md flex items-center gap-0.5">
                <Scale className="w-3 h-3" />
                {listing.attributes.weight}
              </span>
            )}
            {listing.attributes.age && (
              <span className="bg-[#f5f8eb] border border-[#c5d4a8] px-2 py-0.5 rounded-md flex items-center gap-0.5">
                <Calendar className="w-3 h-3" />
                {listing.attributes.age}
              </span>
            )}
          </div>
        </div>

        {/* Location & Time */}
        <div className="pt-2 border-t border-[#eef2dc] flex items-center justify-between text-[10px] text-[#6b8f4e]">
          <span className="flex items-center gap-1 font-medium truncate max-w-[70%]">
            <MapPin className="w-3 h-3 text-[#3d6b2e] shrink-0" />
            {listing.location.region}
          </span>
          <span>{listing.createdAt}</span>
        </div>
      </div>
    </div>
  );
};
