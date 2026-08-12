import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auctionService } from '../services/auctionService';

export function useAuctions() {
  return useQuery({
    queryKey: ['auctions'],
    queryFn: () => auctionService.getAuctions(),
    refetchInterval: 10000, // auto update live auctions every 10 sec
  });
}

export function usePlaceBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ auctionId, amount }: { auctionId: string; amount: number }) =>
      auctionService.placeBid(auctionId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
  });
}
