import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listingService } from '../services/listingService';
import { FilterOptions, Listing } from '../../types';

export function useListings(filters?: FilterOptions) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: () => listingService.getListings(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

export function useListingDetail(id?: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: () => (id ? listingService.getListingById(id) : undefined),
    enabled: !!id,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Listing>) => listingService.createListing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => listingService.toggleLike(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}
