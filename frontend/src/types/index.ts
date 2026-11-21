// ============================================================================
// DATABASE SCHEMA TYPES (Zotdor Database Architecture)
// ============================================================================

export type UserRole = 'user' | 'seller' | 'admin';
export type CategoryId = 'gosht' | 'sut-tuxum' | 'korkam' | 'sport-transport' | 'pet';
export type AnimalType = 'qoramol' | 'qoy' | 'echki' | 'ot' | 'tuya' | 'parranda' | 'pet';
export type AnimalGender = 'Buqa' | 'Sigir' | "Qo'chqor" | 'Taka' | 'Baytal' | 'Axtalash' | 'Erkak' | "Urg'och";
export type AnimalStatus = 'active' | 'sold' | 'archived';
export type RiskLevel = 'info' | 'warning' | 'critical';

// 1. users Table
export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: UserRole;
  region: string;
  district: string;
  avatar_url: string;
  language: 'uz' | 'ru' | 'en';
  pinfl?: string;
  last_verify?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  balance: number;
  created_at: string;
  last_active?: string;
}

// 2. animals Table
export interface Animal {
  id: string;
  owner_id: string;
  animal_type: AnimalType;
  breed: string;
  direction: CategoryId;
  gender: AnimalGender;
  age_months: number;
  weight: number;
  is_estimated_weight: boolean;
  region: string;
  district: string;
  latitude?: number;
  longitude?: number;
  health_status: string; // e.g. "Sog'lom, emlangan"
  health_description?: string;
  status: AnimalStatus;
  vet_passport?: boolean | string;
  media_urls: string[];
  created_at: string;
  updated_at?: string;
}

// 3. announcements Table
export interface Announcement {
  id: string;
  animal_id: string;
  user_id: string;
  price: number;
  is_negotiable: boolean;
  reason_for_sale?: string;
  description: string;
  created_at: string;
  animal?: Animal;
  user?: User;
}

// 4. auctions Table
export interface Auction {
  id: string;
  animal_id: string;
  user_id: string;
  title: string;
  description: string;
  start_price: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  animal?: Animal;
  user?: User;
  bids?: AuctionBid[];
}

// 5. auction_bids Table
export interface AuctionBid {
  id: string;
  auction_id: string;
  user_id: string;
  bid_price: number;
  message?: string;
  created_at: string;
  bidderName?: string;
  bidderPhone?: string;
}

// 6. blocked_objects Table
export interface BlockedObject {
  id: string;
  object_type: 'user' | 'transaction' | 'animal';
  object_id: string;
  description: string;
  created_at: string;
  expire_date?: string;
}

// 7. advertisements Table
export interface Advertisement {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url: string;
  category_type: string;
  status: 'active' | 'inactive';
  created_at: string;
}

// 8. notifications Table
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  text: string;
  risk_level: RiskLevel;
  created_at: string;
}

// 9. user_settings Table
export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'light' | 'dark';
  push_notifications: boolean;
  sms_notifications: boolean;
  created_at: string;
}

// ============================================================================
// UI & VIEW MODEL COMPATIBILITY TYPES
// ============================================================================

export interface Category {
  id: CategoryId;
  name: string;
  shortName: string;
  icon: string;
  badgeColor: string;
  description: string;
  itemCount: number;
}

export interface ListingAttributes {
  gender?: AnimalGender;
  age?: string; // e.g. "3 yosh", "18 oylik"
  weight?: string; // e.g. "850 kg"
  breed?: string;
  direction: CategoryId;
  directionLabel: string;
  yieldPerDay?: string;
  pedigree?: boolean; // Zotdor sertifikati
  health_status?: string;
  health_description?: string;
}

export interface Seller {
  id: string;
  name: string;
  phone: string;
  isVerified: boolean;
  avatar: string;
  rating: number;
  location: string;
  memberSince: string;
}

export interface Listing {
  id: string;
  title: string;
  price: number;
  currency: 'UZS' | 'USD';
  priceFormatted: string;
  isNegotiable: boolean;
  images: string[];
  attributes: ListingAttributes;
  description: string;
  location: {
    region: string;
    city: string;
    coordinates?: { lat: number; lng: number };
  };
  createdAt: string;
  viewsCount: number;
  likesCount: number;
  isLiked?: boolean;
  seller: Seller;
  isFeatured?: boolean;
  status: 'active' | 'sold' | 'auction';
  animal_id?: string;
  reason_for_sale?: string;
}

export interface Bid {
  id: string;
  bidderName: string;
  bidderPhone: string;
  amount: number;
  time: string;
}

export interface AuctionItem {
  id: string;
  listing: Listing;
  startingPrice: number;
  currentBid: number;
  minStep: number;
  endTime: string;
  bidsCount: number;
  bidsHistory: Bid[];
}

export interface FilterOptions {
  searchQuery?: string;
  categoryId?: CategoryId | 'all';
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  pedigreeOnly?: boolean;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}
