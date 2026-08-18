import React, { useState, useEffect } from 'react';
import { syncPendingData } from '../utils/offlineSync';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      syncPendingData();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-banner">
      📡 You're offline — invoices will be saved locally and synced automatically when connection is restored.
    </div>
  );
}
