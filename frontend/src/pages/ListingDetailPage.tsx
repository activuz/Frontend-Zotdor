import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useListingDetail, useToggleLike } from '../api/hooks/useListings';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { ImageCarousel } from '../components/ui/ImageCarousel';
import { AttributeBadgeCard } from '../components/ui/AttributeBadge';
import {
  Heart,
  Share2,
  Phone,
  MessageCircle,
  MapPin,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Eye,
  Calendar,
  Scale,
  Sparkles,
  Tag,
  ArrowRightLeft,
  CircleCheck,
  Star,
} from 'lucide-react';

export const ListingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: listing, isLoading } = useListingDetail(id);
  const toggleLikeMutation = useToggleLike();
  const [isExpanded, setIsExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-[#4a5e3a] font-medium text-sm">
        E'lon yuklanmoqda...
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="py-20 text-center space-y-3 px-4">
        <span className="text-4xl block">🔍</span>
        <h3 className="text-lg font-bold font-display text-[#1e3a0f]">E'lon topilmadi</h3>
        <p className="text-xs text-[#4a5e3a]">Ehtimol ushbu e'lon o'chirilgan yoki muddati tugagan</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-[#1e3a0f] text-[#eef2dc] rounded-full text-xs font-bold"
        >
          Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  const breadcrumbs = [
    { label: 'Bosh sahifa', path: '/' },
    { label: 'E\'lonlar', path: '/search' },
    { label: listing.title.slice(0, 20) + '...' },
  ];

  const handleToggleLike = () => {
    toggleLikeMutation.mutate(listing.id);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: listing.title,
        text: `${listing.title} - Zotdor.uz chorva bozori`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => setLinkCopied(true)).catch(() => {});
    }
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Wireframe 2: Breadcrumbs (Bosh sahifa > E'lonlar > e'lon) */}
      <Breadcrumb items={breadcrumbs} />

      {/* Main Image Slider with media ro'yxati thumbnails */}
      <ImageCarousel images={listing.images} altTitle={listing.title} />

      {/* Title & Price Section */}
      <div className="bg-white p-4 mx-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="bg-[#3d6b2e] text-[#eef2dc] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                {listing.attributes.directionLabel}
              </span>
              {listing.attributes.pedigree && (
                <span className="bg-[#a8d45e] text-[#1e3a0f] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                  Pedigree Zotdor
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#1e3a0f] leading-snug font-display">
              {listing.title}
            </h1>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={handleShare}
              className="p-2 rounded-full bg-[#f5f8eb] text-[#1e3a0f] hover:bg-[#dce8c8] transition-colors"
              title={linkCopied ? 'Havola nusxalandi' : 'Ulashish'}
            >
              {linkCopied ? <CircleCheck className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleToggleLike}
              className={`p-2 rounded-full transition-colors ${
                listing.isLiked ? 'bg-red-500 text-white' : 'bg-[#f5f8eb] text-[#1e3a0f]'
              }`}
              title="Saralangan"
            >
              <Heart className={`w-4 h-4 ${listing.isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#eef2dc] flex items-baseline justify-between">
          <div>
            <span className="text-xs text-[#6b8f4e] font-semibold block">Narxi:</span>
            <span className="text-2xl font-black text-[#1e3a0f] font-display">
              {listing.priceFormatted}
            </span>
          </div>
          {listing.isNegotiable && (
            <span className="bg-[#dce8c8] text-[#1e3a0f] text-xs font-bold px-3 py-1 rounded-full">
              Kelishiladi
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#6b8f4e] pt-1">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {listing.viewsCount} ko'rildi
          </span>
          <span>{listing.createdAt}</span>
        </div>
      </div>

      {/* Wireframe 2: Attribute Badge Grid (Jinsi, Yoshi, Vazni, Zoti, Yo'nalishi, Ko'proq) */}
      <div className="px-4">
        <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#6b8f4e] mb-2 font-display">
          Chorva xususiyatlari
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <AttributeBadgeCard
            icon={<Sparkles className="w-5 h-5" />}
            label="Jinsi"
            value={listing.attributes.gender || 'Buqa'}
          />
          <AttributeBadgeCard
            icon={<Calendar className="w-5 h-5" />}
            label="Yoshi"
            value={listing.attributes.age || 'Biriktirilmagan'}
          />
          <AttributeBadgeCard
            icon={<Scale className="w-5 h-5" />}
            label="Vazni"
            value={listing.attributes.weight || 'Biriktirilmagan'}
          />
          <AttributeBadgeCard
            icon={<Tag className="w-5 h-5" />}
            label="Zoti"
            value={listing.attributes.breed || 'Sof zot'}
          />
          <AttributeBadgeCard
            icon={<ArrowRightLeft className="w-5 h-5" />}
            label="Yo'nalishi"
            value={listing.attributes.directionLabel}
          />

          {/* Wireframe 2 `ko'proq` button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-[#1e3a0f] text-[#eef2dc] p-3 rounded-2xl border border-[#1e3a0f] shadow-sm flex items-center justify-center space-x-1.5 hover:bg-[#2d5a20] transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold">
              {isExpanded ? 'Yopish' : 'ko\'proq'}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expandable details matching wireframe `ko'proq` section */}
        {isExpanded && (
          <div className="mt-3 bg-white p-4 rounded-2xl border border-[#c5d4a8] space-y-2 text-xs text-[#1e3a0f] animate-fadeIn">
            <div className="flex justify-between border-b border-[#eef2dc] pb-1.5">
              <span className="text-[#6b8f4e]">Mahsuldorlik:</span>
              <span className="font-bold">{listing.attributes.yieldPerDay || 'Korsatilmagan'}</span>
            </div>
            <div className="flex justify-between border-b border-[#eef2dc] pb-1.5">
              <span className="text-[#6b8f4e]">Zotdorlik sertifikati:</span>
              <span className="font-bold text-[#3d6b2e] flex items-center gap-1">
                <CircleCheck className="w-3.5 h-3.5" />
                Mavjud (Emlangan)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b8f4e]">Holati:</span>
              <span className="font-bold">Sog'lom, faol</span>
            </div>
          </div>
        )}
      </div>

      {/* Wireframe 2: Tavsif section */}
      <div className="px-4">
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-2">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#6b8f4e] font-display">
            tavsif
          </h3>
          <p className="text-xs sm:text-sm text-[#1e3a0f] leading-relaxed font-medium whitespace-pre-line">
            {listing.description}
          </p>
        </div>
      </div>

      {/* Wireframe 2: Joylashuv section (Location Map card) */}
      <div className="px-4">
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#6b8f4e] font-display">
              joylashuv
            </h3>
            <span className="text-xs font-bold text-[#1e3a0f] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#3d6b2e]" />
              {listing.location.region}, {listing.location.city}
            </span>
          </div>

          {/* Interactive Map Visual Placeholder */}
          <div className="relative h-36 bg-[#dce8c8]/50 rounded-2xl overflow-hidden border border-[#c5d4a8] flex items-center justify-center">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#3d6b2e_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 text-center p-3">
              <div className="w-10 h-10 rounded-full bg-[#1e3a0f] text-[#eef2dc] mx-auto flex items-center justify-center shadow-lg mb-1.5 animate-bounce">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-[#1e3a0f] block font-display">
                {listing.location.city}
              </span>
              <span className="text-[10px] text-[#4a5e3a]">Xaritada joylashuvni ko'rish</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seller Profile Card */}
      <div className="px-4">
        <div className="bg-white p-4 rounded-3xl border border-[#c5d4a8] shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={listing.seller.avatar}
              alt={listing.seller.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#1e3a0f]"
            />
            <div>
              <div className="flex items-center space-x-1">
                <h4 className="text-sm font-bold text-[#1e3a0f] font-display">
                  {listing.seller.name}
                </h4>
                {listing.seller.isVerified && (
                  <UserCheck className="w-4 h-4 text-[#3d6b2e]" />
                )}
              </div>
              <span className="text-[10px] text-[#6b8f4e] flex items-center gap-1 mt-0.5">
                <span>A'zo: {listing.seller.memberSince}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  Reyting: <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" /> {listing.seller.rating}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Contact Action Bar (Inline on Desktop, Sticky on Mobile) */}
      <div className="fixed md:static bottom-16 md:bottom-auto left-0 right-0 z-30 bg-white/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-t md:border-none border-[#c5d4a8] p-3 md:p-0 shadow-xl md:shadow-none max-w-lg md:max-w-full mx-auto">
        <div className="max-w-md md:max-w-xl mx-auto flex items-center space-x-3">
          <a
            href={`tel:${listing.seller.phone}`}
            className="flex-1 bg-[#1e3a0f] hover:bg-[#2d5a20] text-[#eef2dc] font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center space-x-2 shadow-md transition-all active:scale-95 text-xs sm:text-sm"
          >
            <Phone className="w-4 h-4" />
            <span>Qo'ng'iroq qilish ({listing.seller.phone})</span>
          </a>

          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#3d6b2e] hover:bg-[#2d5a20] text-white font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center space-x-2 shadow-md transition-all active:scale-95 text-xs sm:text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Telegram'da yozish</span>
          </a>
        </div>
      </div>
    </div>
  );
};
