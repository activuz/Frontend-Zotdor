import { apiClient } from '../client';
import { AuctionItem } from '../../types';
import { MOCK_AUCTIONS } from '../../mocks/auctions';

export const auctionService = {
  async getAuctions(): Promise<AuctionItem[]> {
    try {
      const data = await apiClient.get<unknown, AuctionItem[]>('/auctions');
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('API offline');
    } catch {
      return MOCK_AUCTIONS;
    }
  },

  async placeBid(auctionId: string, amount: number): Promise<AuctionItem> {
    try {
      const data = await apiClient.post<unknown, AuctionItem>(`/auctions/${auctionId}/bids`, { amount });
      return data;
    } catch {
      const auc = MOCK_AUCTIONS.find(a => a.id === auctionId);
      if (auc) {
        auc.currentBid = amount;
        auc.bidsCount += 1;
        auc.bidsHistory.unshift({
          id: `bid-${Date.now()}`,
          bidderName: 'Siz (Sotib oluvchi)',
          bidderPhone: '+998 90 *** ** **',
          amount,
          time: 'Hozir'
        });
        return { ...auc };
      }
      throw new Error('Auksion topilmadi');
    }
  }
};
