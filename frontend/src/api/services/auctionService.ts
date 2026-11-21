import { AuctionItem } from '../../types';
import { MOCK_AUCTIONS } from '../../mocks/auctions';

/**
 * DEMO DATA — no backend call. Bids change only this browser tab's memory.
 * Replaced by the real auctions/bids API in phase 4 (docs/IMPLEMENTATION_PLAN.md).
 */
export const auctionService = {
  async getAuctions(): Promise<AuctionItem[]> {
    return MOCK_AUCTIONS;
  },

  async placeBid(auctionId: string, amount: number): Promise<AuctionItem> {
    const auc = MOCK_AUCTIONS.find((a) => a.id === auctionId);
    if (!auc) throw new Error('Auksion topilmadi');
    auc.currentBid = amount;
    auc.bidsCount += 1;
    auc.bidsHistory.unshift({
      id: `bid-${Date.now()}`,
      bidderName: 'Siz',
      bidderPhone: '',
      amount,
      time: 'Hozir',
    });
    return { ...auc };
  },
};
