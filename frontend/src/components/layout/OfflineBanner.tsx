import React, { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Phase 9: tells the user why nothing updates (countdowns and bids need the network). */
export const OfflineBanner: React.FC = () => {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="bg-warning-soft text-warning text-[15px] text-center px-3 py-2 border-b border-line">
      Internet aloqasi yoʻq. Takliflar va vaqt aloqa tiklanganda yangilanadi.
    </div>
  );
};
