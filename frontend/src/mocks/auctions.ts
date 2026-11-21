import { AuctionItem } from '../types';
import { MOCK_LISTINGS } from './listings';

export const MOCK_AUCTIONS: AuctionItem[] = [
  {
    id: 'auc-1',
    listing: MOCK_LISTINGS[0], // Semental buqa
    startingPrice: 25000000,
    currentBid: 29500000,
    minStep: 500000,
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(), // ~26 hours from now
    bidsCount: 9,
    bidsHistory: [
      { id: 'b9', bidderName: 'Dostonbek R.', bidderPhone: '+998 90 *** *4 21', amount: 29500000, time: '10 daqiqa oldin' },
      { id: 'b8', bidderName: 'Bahrom A.', bidderPhone: '+998 93 *** *1 09', amount: 29000000, time: '45 daqiqa oldin' },
      { id: 'b7', bidderName: 'Javohir K.', bidderPhone: '+998 97 *** *9 88', amount: 28000000, time: '2 soat oldin' },
    ],
  },
  {
    id: 'auc-2',
    listing: MOCK_LISTINGS[1], // Hisor qo'chqor
    startingPrice: 10000000,
    currentBid: 13000000,
    minStep: 300000,
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(), // ~8 hours from now
    bidsCount: 6,
    bidsHistory: [
      { id: 'b6', bidderName: 'Sardorbek T.', bidderPhone: '+998 94 *** *2 11', amount: 13000000, time: '15 daqiqa oldin' },
      { id: 'b5', bidderName: 'Erkin aka', bidderPhone: '+998 91 *** *8 33', amount: 12500000, time: '1 soat oldin' },
    ],
  },
  {
    id: 'auc-3',
    listing: MOCK_LISTINGS[3], // Qorabayir ot
    startingPrice: 35000000,
    currentBid: 41000000,
    minStep: 1000000,
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 44).toISOString(), // ~44 hours from now
    bidsCount: 12,
    bidsHistory: [
      { id: 'b12', bidderName: 'Chavandoz O.', bidderPhone: '+998 90 *** *0 00', amount: 41000000, time: '5 daqiqa oldin' },
      { id: 'b11', bidderName: 'Rustam N.', bidderPhone: '+998 99 *** *5 55', amount: 40000000, time: '30 daqiqa oldin' },
    ],
  },
];
