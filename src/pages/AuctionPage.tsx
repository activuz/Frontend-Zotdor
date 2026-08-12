import React, { useState } from 'react';
import { useAuctions, usePlaceBid } from '../api/hooks/useAuctions';
import { Gavel, Clock, Trophy, TrendingUp, ShieldCheck, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AuctionPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: auctions = [], isLoading } = useAuctions();
  const placeBidMutation = usePlaceBid();

  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [customBid, setCustomBid] = useState('');

  // Selected auction object
  const activeAuction = auctions.find((a) => a.id === selectedAuctionId);

  const handleQuickBid = (auctionId: string, currentBid: number, minStep: number) => {
    const nextAmount = currentBid + minStep;
    placeBidMutation.mutate({ auctionId, amount: nextAmount }, {
      onSuccess: () => {
        alert(`Stavka qabul qilindi: ${nextAmount.toLocaleString()} UZS`);
      }
    });
  };

  const handleCustomBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuctionId || !customBid) return;

    const amount = Number(customBid);
    if (activeAuction && amount <= activeAuction.currentBid) {
      alert("Stavka summasi amaldagi narxdan yuqori bo'lishi kerak!");
      return;
    }

    placeBidMutation.mutate({ auctionId: selectedAuctionId, amount }, {
      onSuccess: () => {
        alert(`Muvaffaqiyatli stavka qo'yildi: ${amount.toLocaleString()} UZS`);
        setCustomBid('');
        setSelectedAuctionId(null);
      }
    });
  };

  return (
    <div className="space-y-4 px-4 py-2">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1e3a0f] to-[#3d6b2e] text-[#eef2dc] p-5 rounded-3xl border border-[#3d6b2e] shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center space-x-1.5 bg-[#a8d45e] text-[#1e3a0f] px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase">
            <Gavel className="w-3.5 h-3.5" />
            <span>Jonli Auksion Platformasi</span>
          </div>
          <h1 className="text-xl font-bold font-display text-white">
            Kim Oshdi Savdosi (Auction)
          </h1>
          <p className="text-xs text-[#dce8c8] font-medium">
            Eng sara va zotdor chorvalarni o'zingiz belgilagan narxda yutib oling
          </p>
        </div>
      </div>

      {/* Auction items list */}
      {isLoading ? (
        <div className="text-center py-12 text-[#4a5e3a] text-xs">
          Auksionlar yuklanmoqda...
        </div>
      ) : (
        <div className="space-y-4">
          {auctions.map((auc) => (
            <div
              key={auc.id}
              className="bg-white rounded-3xl border border-[#c5d4a8] shadow-sm overflow-hidden space-y-3 p-4"
            >
              <div className="flex space-x-3 items-start">
                <img
                  src={auc.listing.images[0]}
                  alt={auc.listing.title}
                  className="w-24 h-24 rounded-2xl object-cover shrink-0 border border-[#c5d4a8]"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="bg-[#dce8c8] text-[#1e3a0f] text-[9px] font-bold px-2 py-0.5 rounded-full">
                      {auc.listing.attributes.directionLabel}
                    </span>
                    {auc.listing.attributes.pedigree && (
                      <span className="bg-[#a8d45e] text-[#1e3a0f] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        Zotdor
                      </span>
                    )}
                  </div>
                  <h3
                    onClick={() => navigate(`/listing/${auc.listing.id}`)}
                    className="text-sm font-bold text-[#1e3a0f] line-clamp-1 hover:underline cursor-pointer font-display"
                  >
                    {auc.listing.title}
                  </h3>
                  <div className="flex items-center text-[10px] text-[#6b8f4e] space-x-2">
                    <span className="flex items-center gap-1 font-semibold text-[#1e3a0f]">
                      <Clock className="w-3 h-3 text-[#3d6b2e]" />
                      Tugashiga: 24 soat
                    </span>
                    <span>• {auc.bidsCount} ta stavka</span>
                  </div>
                </div>
              </div>

              {/* Price comparison info */}
              <div className="bg-[#f5f8eb] p-3 rounded-2xl border border-[#c5d4a8] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#6b8f4e] block uppercase tracking-wider">
                    Joriy eng yuqori stavka:
                  </span>
                  <span className="text-xl font-black text-[#1e3a0f] font-display">
                    {auc.currentBid.toLocaleString()} UZS
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#6b8f4e] block">Boshlang'ich narx:</span>
                  <span className="text-xs font-bold text-[#4a5e3a]">
                    {auc.startingPrice.toLocaleString()} UZS
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => handleQuickBid(auc.id, auc.currentBid, auc.minStep)}
                  className="flex-1 bg-[#1e3a0f] hover:bg-[#2d5a20] text-[#eef2dc] font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#a8d45e]" />
                  <span>+{(auc.minStep / 1000).toFixed(0)}k UZS stavka</span>
                </button>

                <button
                  onClick={() => setSelectedAuctionId(auc.id)}
                  className="px-4 py-2.5 bg-[#dce8c8] hover:bg-[#c5d4a8] text-[#1e3a0f] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Tarix / Kiritish
                </button>
              </div>

              {/* Recent bid notification */}
              {auc.bidsHistory.length > 0 && (
                <div className="text-[10px] text-[#4a5e3a] bg-white pt-1 border-t border-[#eef2dc] flex items-center justify-between">
                  <span className="font-semibold">
                    Oxirgi stavka: {auc.bidsHistory[0].bidderName} ({auc.bidsHistory[0].amount.toLocaleString()} UZS)
                  </span>
                  <span className="text-[9px] text-[#6b8f4e]">{auc.bidsHistory[0].time}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for Custom Bid Input */}
      {selectedAuctionId && activeAuction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl border border-[#c5d4a8] animate-slideUp">
            <div className="flex items-center justify-between border-b border-[#eef2dc] pb-3">
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-[#3d6b2e]" />
                <h3 className="text-sm font-bold text-[#1e3a0f] font-display">
                  Stavka kiritish & Tarix
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuctionId(null)}
                className="text-xs font-bold text-[#6b8f4e] p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-[#1e3a0f] font-display">
                {activeAuction.listing.title}
              </span>
              <p className="text-xs text-[#3d6b2e] font-extrabold">
                Hozirgi narx: {activeAuction.currentBid.toLocaleString()} UZS
              </p>
            </div>

            <form onSubmit={handleCustomBidSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#1e3a0f] block mb-1">
                  Siz taklif qilayotgan summa (UZS)
                </label>
                <input
                  type="number"
                  required
                  min={activeAuction.currentBid + activeAuction.minStep}
                  value={customBid}
                  onChange={(e) => setCustomBid(e.target.value)}
                  placeholder={`${activeAuction.currentBid + activeAuction.minStep}`}
                  className="w-full p-3 bg-[#f5f8eb] rounded-xl border border-[#c5d4a8] text-sm font-bold focus:ring-2 focus:ring-[#3d6b2e] focus:outline-none"
                />
                <span className="text-[10px] text-[#6b8f4e] mt-1 block">
                  Kamlida {activeAuction.minStep.toLocaleString()} UZS yuqori stavka kiriting
                </span>
              </div>

              <button
                type="submit"
                disabled={placeBidMutation.isPending}
                className="w-full bg-[#1e3a0f] text-[#eef2dc] font-bold py-3 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-md"
              >
                <span>Stavkani tasdiqlash</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Bids History list */}
            <div className="pt-2 border-t border-[#eef2dc] space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6b8f4e] block">
                Stavkalar tarixi ({activeAuction.bidsHistory.length})
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {activeAuction.bidsHistory.map((b) => (
                  <div key={b.id} className="p-2 rounded-xl bg-[#f5f8eb] flex justify-between text-xs font-medium">
                    <div>
                      <span className="font-bold text-[#1e3a0f] block">{b.bidderName}</span>
                      <span className="text-[10px] text-[#6b8f4e]">{b.time}</span>
                    </div>
                    <span className="font-black text-[#3d6b2e] font-display">
                      {b.amount.toLocaleString()} UZS
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
