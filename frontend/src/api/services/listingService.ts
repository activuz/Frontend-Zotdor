import { Listing, FilterOptions } from '../../types';
import { MOCK_LISTINGS } from '../../mocks/listings';

/**
 * DEMO DATA — no backend call. Changes live only in this browser tab's memory.
 * Replaced by the real auctions API in phases 3–4 (docs/IMPLEMENTATION_PLAN.md).
 */
export const listingService = {
  async getListings(filters?: FilterOptions): Promise<Listing[]> {
    let result = [...MOCK_LISTINGS];

    if (filters?.categoryId && filters.categoryId !== 'all') {
      result = result.filter((item) => item.attributes.direction === filters.categoryId);
    }
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.attributes.breed?.toLowerCase().includes(query) ||
          item.location.region.toLowerCase().includes(query),
      );
    }
    if (filters?.pedigreeOnly) {
      result = result.filter((item) => item.attributes.pedigree === true);
    }
    if (filters?.minPrice) {
      result = result.filter((item) => item.price >= (filters.minPrice || 0));
    }
    if (filters?.maxPrice) {
      result = result.filter((item) => item.price <= (filters.maxPrice || Infinity));
    }
    if (filters?.sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (filters?.sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    }
    return result;
  },

  async getListingById(id: string): Promise<Listing | undefined> {
    return MOCK_LISTINGS.find((item) => item.id === id);
  },

  async createListing(listingData: Partial<Listing>): Promise<Listing> {
    const newListing: Listing = {
      id: `zot-${Date.now()}`,
      title: listingData.title || 'Yangi eʼlon',
      price: listingData.price || 0,
      currency: 'UZS',
      priceFormatted: `${(listingData.price || 0).toLocaleString()} soʻm`,
      isNegotiable: listingData.isNegotiable ?? true,
      images: listingData.images || ['/image0.webp'],
      attributes: listingData.attributes || { direction: 'gosht', directionLabel: 'Goʻsht yoʻnalishi' },
      description: listingData.description || '',
      location: listingData.location || { region: '', city: '' },
      createdAt: 'Hozirgina',
      viewsCount: 0,
      likesCount: 0,
      seller: {
        id: 'demo-me',
        name: 'Siz',
        phone: '',
        isVerified: false,
        avatar: '/favicon.webp',
        rating: 0,
        location: '',
        memberSince: '',
      },
      status: 'active',
    };
    MOCK_LISTINGS.unshift(newListing);
    return newListing;
  },

  async toggleLike(id: string): Promise<boolean> {
    const item = MOCK_LISTINGS.find((l) => l.id === id);
    if (!item) return false;
    item.isLiked = !item.isLiked;
    item.likesCount += item.isLiked ? 1 : -1;
    return item.isLiked;
  },
};
