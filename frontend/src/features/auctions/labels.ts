import type { AuctionStatus } from './api';

export const STATUS_LABEL: Record<AuctionStatus, string> = {
  draft: 'Qoralama',
  pending_review: 'Moderatsiyada',
  rejected: 'Rad etilgan',
  scheduled: 'Rejalashtirilgan',
  live: 'Jonli',
  ended: 'Tugagan',
  sold: 'Sotilgan',
  unsold: 'Sotilmagan',
  cancelled: 'Bekor qilingan',
  blocked: 'Bloklangan',
};

export const STATUS_TONE: Record<AuctionStatus, string> = {
  draft: 'bg-page text-ink-muted',
  pending_review: 'bg-warning-soft text-warning',
  rejected: 'bg-danger-soft text-danger',
  scheduled: 'bg-brand-soft text-ink',
  live: 'bg-success-soft text-success',
  ended: 'bg-warning-soft text-warning',
  sold: 'bg-brand-soft text-ink',
  unsold: 'bg-page text-ink-muted',
  cancelled: 'bg-page text-ink-muted',
  blocked: 'bg-danger-soft text-danger',
};

/** BR-25 tier colours. Rank number is always shown too, colour is never the only signal. */
export const TIER_TEXT: Record<string, string> = {
  green: 'text-bid-1',
  yellow: 'text-bid-2',
  red: 'text-bid-3',
};

export const TIER_BORDER: Record<string, string> = {
  green: 'border-l-bid-1',
  yellow: 'border-l-bid-2',
  red: 'border-l-bid-3',
};

export const REPORT_REASONS = [
  { value: 'fake', label: 'Soxta yoki boshqa joydan olingan' },
  { value: 'wrong_info', label: 'Notoʻgʻri maʼlumot' },
  { value: 'abuse', label: 'Haqorat yoki nojoʻya xatti-harakat' },
  { value: 'fraud', label: 'Firibgarlik' },
  { value: 'other', label: 'Boshqa' },
] as const;
