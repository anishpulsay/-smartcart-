const PENDING_KEY = 'smartcart_pending_invoices';
const PENDING_ANOMALIES_KEY = 'smartcart_pending_anomalies';

export function savePendingInvoice(invoice) {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    pending.push(invoice);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    return true;
  } catch (e) {
    console.error('Failed to cache invoice:', e);
    return false;
  }
}

export function getPendingInvoices() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearPendingInvoices() {
  localStorage.removeItem(PENDING_KEY);
}

export function savePendingAnomaly(anomaly) {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_ANOMALIES_KEY) || '[]');
    pending.push(anomaly);
    localStorage.setItem(PENDING_ANOMALIES_KEY, JSON.stringify(pending));
  } catch (e) {
    console.error('Failed to cache anomaly:', e);
  }
}

export function getPendingAnomalies() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_ANOMALIES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearPendingAnomalies() {
  localStorage.removeItem(PENDING_ANOMALIES_KEY);
}

export async function syncPendingData() {
  // Sync invoices
  const invoices = getPendingInvoices();
  if (invoices.length > 0) {
    let allSynced = true;
    for (const invoice of invoices) {
      try {
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoice),
        });
        if (!res.ok) allSynced = false;
      } catch {
        allSynced = false;
        break;
      }
    }
    if (allSynced) clearPendingInvoices();
  }

  // Sync anomalies
  const anomalies = getPendingAnomalies();
  if (anomalies.length > 0) {
    let allSynced = true;
    for (const anomaly of anomalies) {
      try {
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/anomalies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(anomaly),
        });
        if (!res.ok) allSynced = false;
      } catch {
        allSynced = false;
        break;
      }
    }
    if (allSynced) clearPendingAnomalies();
  }
}

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SmartCart] Back online — syncing pending data...');
    syncPendingData();
  });
}
