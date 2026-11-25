import React from 'react';
import { formatCountdown } from '../../lib/format';
import { useNow } from '../../lib/useNow';

/** "02:14:05"; red in the last 10 minutes (DESIGN.md §3). */
export const Countdown: React.FC<{ to: string; className?: string }> = ({ to, className = '' }) => {
  const now = useNow();
  const left = new Date(to).getTime() - now;
  const urgent = left > 0 && left <= 10 * 60_000;
  return (
    <span className={`tabular-nums ${urgent ? 'text-danger' : ''} ${className}`}>
      {left > 0 ? formatCountdown(left) : '00:00:00'}
    </span>
  );
};
