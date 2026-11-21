import { apiClient } from '../client';
import { Listing, FilterOptions } from '../../types';
import { MOCK_LISTINGS } from '../../mocks/listings';

export const listingService = {
  // Get all listings with optional filter options
  async getListings(filters?: FilterOptions): Promise<Listing[]> {
    try {
      // Attempt API call first
      const data = await apiClient.get<unknown, Listing[]>('/listings', { params: filters });
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('API returned empty or non-array, using mock');
    } catch {
      // Fallback to realistic mock filtering
      let result = [...MOCK_LISTINGS];

      if (filters?.categoryId && filters.categoryId !== 'all') {
        result = result.filter(item => item.attributes.direction === filters.categoryId);
      }

      if (filters?.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        result = result.filter(item =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.attributes.breed?.toLowerCase().includes(query) ||
          item.location.region.toLowerCase().includes(query)
        );
      }

      if (filters?.pedigreeOnly) {
        result = result.filter(item => item.attributes.pedigree === true);
      }

      if (filters?.minPrice) {
        result = result.filter(item => item.price >= (filters.minPrice || 0));
      }

      if (filters?.maxPrice) {
        result = result.filter(item => item.price <= (filters.maxPrice || Infinity));
      }

      if (filters?.sortBy === 'price_asc') {
        result.sort((a, b) => a.price - b.price);
      } else if (filters?.sortBy === 'price_desc') {
        result.sort((a, b) => b.price - a.price);
      }

      return result;
    }
  },

  // Get single listing details
  async getListingById(id: string): Promise<Listing | undefined> {
    try {
      const data = await apiClient.get<unknown, Listing>(`/listings/${id}`);
      return data;
    } catch {
      return MOCK_LISTINGS.find(item => item.id === id);
    }
  },

  // Post a new listing
  async createListing(listingData: Partial<Listing>): Promise<Listing> {
    try {
      const data = await apiClient.post<unknown, Listing>('/listings', listingData);
      return data;
    } catch {
      const newListing: Listing = {
        id: `zot-${Date.now()}`,
        title: listingData.title || 'Yangi e\'lon',
        price: listingData.price || 0,
        currency: 'UZS',
        priceFormatted: `${(listingData.price || 0).toLocaleString()} UZS`,
        isNegotiable: listingData.isNegotiable ?? true,
        images: listingData.images || ['/image0.webp'],
        attributes: listingData.attributes || { direction: 'gosht', directionLabel: "Go'sht yo'nalishi" },
        description: listingData.description || '',
        location: listingData.location || { region: 'Toshkent', city: 'Shahar' },
        createdAt: 'Hozirgina',
        viewsCount: 1,
        likesCount: 0,
        seller: {
          id: 'user-me',
          name: 'Foydalanuvchi',
          phone: '+998 90 000 00 00',
          isVerified: true,
          avatar: '/founder.webp',
          rating: 5.0,
          location: 'Toshkent',
          memberSince: '2026-yil',
        },
        status: 'active',
      };
      MOCK_LISTINGS.unshift(newListing);
      return newListing;
    }
  },

  // Toggle like/favorite status
  async toggleLike(id: string): Promise<boolean> {
    try {
      const res = await apiClient.post<{ isLiked: boolean }>(`/listings/${id}/like`);
      return res.data.isLiked;
    } catch {
      const item = MOCK_LISTINGS.find(l => l.id === id);
      if (item) {
        item.isLiked = !item.isLiked;
        item.likesCount += item.isLiked ? 1 : -1;
        return item.isLiked;
      }
      return false;
    }
  }
};
