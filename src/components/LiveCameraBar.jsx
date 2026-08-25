import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';

export default function LiveCameraBar() {
  const [scans, setScans] = useState([]);
  const [scale, setScale] = useState({ currentWeight: 0.0, lastDelta: 0.0, status: 'Balanced / Tared', lastVerifiedItem: null });
  const [autoAdd, setAutoAdd] = useState(() => {
    const saved = localStorage.getItem('smartcart_auto_add');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showVideo, setShowVideo] = useState(true);
  const [products, setProducts] = useState([]);
  const [lastAddedId, setLastAddedId] = useState(null);
  const { items, addItem, flagAnomaly, setPendingWeight } = useCart();
  
  const expectedTotalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);

  useEffect(() => {
    localStorage.setItem('smartcart_auto_add', JSON.stringify(autoAdd));
  }, [autoAdd]);

  useEffect(() => {
    fetch((import.meta.env.VITE_API_URL || '') + '/api/products')
      .then(r => r.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Could not load products for camera matching", err));
  }, []);

  useEffect(() => {
    // Poll camera scans and scale status every 1.2 seconds
    const interval = setInterval(() => {
      fetch((import.meta.env.VITE_API_URL || '') + '/api/scale')
        .then(r => r.json())
        .then(scaleData => {
          if (scaleData && typeof scaleData.currentWeight === 'number') {
            setScale(scaleData);
          }
          
          fetch((import.meta.env.VITE_API_URL || '') + '/api/camera_scans')
            .then(r => r.json())
            .then(data => {
              if (Array.isArray(data)) {
                setScans(data);
                if (autoAdd && data.length > 0) {
                  const latest = data[data.length - 1];
                  if (latest.id !== lastAddedId && latest.confidence >= 35) {
                    
                    // Match the product to find expected weight
                    let matchedProduct = findBestMatchProduct(latest.item_name);
                    
                    const expectedWeight = matchedProduct ? matchedProduct.weight : 150;
                    // Calculate discrepancy between current scale weight and expected cart total
                    const currentScaleWeight = scaleData ? scaleData.currentWeight : 0;
                    const discrepancy = currentScaleWeight - expectedTotalWeight;
                    
                    // Allow +/- 30g tolerance for the newly added item
                    if (Math.abs(discrepancy - expectedWeight) <= 30) {
                      setLastAddedId(latest.id);
                      handleAddToCart(latest, true); // true = skip simulation since it's already on scale
                    } else {
                      // Do not add, do not update lastAddedId so it tries again
                      console.log(`Weight mismatch for ${latest.item_name}: expected item weight ${expectedWeight}g, but cart weight discrepancy is ${discrepancy}g. Waiting for scale to match...`);
                    }
                  }
                }
              }
            })
            .catch(err => console.error("Error polling camera scans:", err));
        })
        .catch(console.error);
    }, 1200);

    return () => clearInterval(interval);
  }, [autoAdd, lastAddedId, products, addItem, expectedTotalWeight]);

  const handleTare = () => {
    fetch((import.meta.env.VITE_API_URL || '') + '/api/scale/tare', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.scale) setScale(data.scale);
      })
      .catch(console.error);
  };

  const handleSimulateWeight = (grams = 100, name = 'Simulated Item') => {
    fetch((import.meta.env.VITE_API_URL || '') + '/api/scale/simulate_add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grams, item_name: name })
    })
      .then(r => r.json())
      .then(data => {
        if (data.scale) setScale(data.scale);
      })
      .catch(console.error);
  };

  const findBestMatchProduct = (itemName) => {
    if (!itemName) return null;
    const query = itemName.toLowerCase().replace(/_/g, ' ').trim();
    const queryWords = query.split(/\s+/).filter(w => w.length > 1);
    
    let matchedProduct = null;
    let bestScore = 0;

    products.forEach(p => {
      const pName = p.name.toLowerCase().replace(/_/g, ' ').trim();
      
      if (pName === query) {
        if (bestScore < 1000) {
          bestScore = 1000;
          matchedProduct = p;
        }
        return;
      }

      if (pName.includes(query) || query.includes(pName)) {
        const score = 500 + Math.min(pName.length, query.length);
        if (score > bestScore) {
          bestScore = score;
          matchedProduct = p;
        }
        return;
      }

      // 3. Word-level overlap scoring
      const pWords = pName.split(/\s+/).filter(w => w.length > 1);
      if (queryWords.length > 0 && pWords.length > 0) {
        const matchedWords = queryWords.filter(qw => pWords.includes(qw));
        // Require at least half of the query or product words to match OR the primary brand word (first word) matches
        const overlapRatio = matchedWords.length / Math.max(queryWords.length, pWords.length);
        if (matchedWords.length > 0 && (overlapRatio >= 0.4 || matchedWords.includes(pWords[0]))) {
          const score = overlapRatio * 100 + (matchedWords.includes(pWords[0]) ? 50 : 0);
          if (score > bestScore && score >= 40) {
            bestScore = score;
            matchedProduct = p;
          }
        }
      }
    });
    return matchedProduct;
  };

  const handleAddToCart = (scan, skipSimulation = false) => {
    const query = scan.item_name.toLowerCase().replace(/_/g, ' ').trim();
    let matchedProduct = findBestMatchProduct(scan.item_name);

    // If no match in catalog, create dynamic ML item
    if (!matchedProduct) {
      matchedProduct = {
        barcode: `ML_${scan.id || Date.now()}`,
        name: scan.item_name.replace(/_/g, ' ').toUpperCase(),
        price: 49.00, // Default price for ML detected item
        weight: 150,
        category: 'AI Camera Detected',
        imageUrl: `https://loremflickr.com/400/400/${encodeURIComponent(query)}?lock=${Math.floor(Math.random()*100)}`
      };
    }

    addItem(matchedProduct);

    // Verify weight with Load Cell API (Skip if we already verified via real scale reading)
    if (!skipSimulation) {
      fetch((import.meta.env.VITE_API_URL || '') + '/api/scale/simulate_add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grams: matchedProduct.weight || 100,
          item_name: matchedProduct.name
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.scale) setScale(data.scale);
        })
        .catch(console.error);
    }

    // If item was recovered from offline SD cache, trigger a visual confirmation alert
    if (scan.offline_recovered) {
      flagAnomaly({
        productName: `${matchedProduct.name} (Offline SD Recovery)`,
        productBarcode: matchedProduct.barcode,
        expectedWeight: matchedProduct.weight,
        actualWeight: matchedProduct.weight,
        timestamp: new Date(scan.timestamp * 1000 || Date.now()).toISOString(),
        isRecoveryNote: true
      });
    }
  };

  const clearScans = () => {
    fetch((import.meta.env.VITE_API_URL || '') + '/api/camera_scans', { method: 'DELETE' })
      .then(() => setScans([]))
      .catch(console.error);
  };

  const latestScan = scans.length > 0 ? scans[scans.length - 1] : null;

  const matchedLatest = latestScan ? findBestMatchProduct(latestScan.item_name) : null;
  const expectedWeight = matchedLatest ? matchedLatest.weight : 150;
  const currentDiscrepancy = (scale?.currentWeight || 0) - expectedTotalWeight;
  const isWeightVerified = Math.abs(currentDiscrepancy - expectedWeight) <= 30;

  useEffect(() => {
    if (latestScan && latestScan.id !== lastAddedId) {
      setPendingWeight(expectedWeight);
    } else {
      setPendingWeight(0);
    }
  }, [latestScan, lastAddedId, expectedWeight, setPendingWeight]);

  return (
    <div style={styles.container} className="glass">
      <div style={styles.header}>
        <div style={styles.statusGroup}>
          <span style={styles.pulseDot} className="pulse-dot" />
          <div>
            <h4 style={styles.title}>📡 Scovery ML Smart Camera Live Feed</h4>
            <span style={styles.subText}>Connected to Raspberry Pi Zero-Latency Stream (`Render Cloud Relay`)</span>
          </div>
        </div>

        <div style={styles.controls}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowVideo(!showVideo)}
            style={{ fontSize: 'var(--fs-xs)', background: showVideo ? 'rgba(108, 99, 255, 0.25)' : '' }}
          >
            {showVideo ? '🔴 Hide Video Stream' : '📹 Show Video Stream'}
          </button>
          <label style={styles.autoAddLabel}>
            <input 
              type="checkbox" 
              checked={autoAdd} 
              onChange={e => setAutoAdd(e.target.checked)} 
              style={{ accentColor: 'var(--clr-success)', width: '18px', height: '18px' }}
            />
            <span style={{ fontWeight: 600, color: autoAdd ? 'var(--clr-success)' : 'var(--clr-text-secondary)' }}>
              ⚡ Auto-Add to Cart
            </span>
          </label>
          {scans.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={clearScans} style={{ fontSize: 'var(--fs-xs)' }}>
              Clear ({scans.length})
            </button>
          )}
        </div>
      </div>

      {/* Load Cell & Scale Real-Time Verification Panel */}
      <div style={{
        margin: '12px 0',
        padding: '12px 16px',
        background: 'rgba(0, 214, 143, 0.08)',
        border: '1px solid rgba(0, 214, 143, 0.3)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.6rem' }}>⚖️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
              HX711 Load Cell Weight: <span style={{ color: '#00D68F', fontSize: '1.1rem' }}>{Number(scale?.currentWeight || 0).toFixed(1)} g</span>
              {scale?.lastDelta !== 0 && (
                <span style={{ fontSize: '0.8rem', color: scale?.lastDelta > 0 ? '#00D68F' : '#ff5c5c', marginLeft: '8px' }}>
                  ({scale?.lastDelta > 0 ? `+${scale?.lastDelta}` : scale?.lastDelta}g)
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
              Status: <span style={{ color: scale?.status?.includes('Verified') ? '#00D68F' : scale?.status?.includes('Mismatch') || scale?.status?.includes('Unscanned') ? '#ff5c5c' : '#fff', fontWeight: 600 }}>{scale?.status || 'Balanced / Tared'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleTare}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            title="Zero / Tare the physical or simulated scale"
          >
            ⚖️ Tare Zero
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => handleSimulateWeight(100)}
            style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(255, 255, 255, 0.05)' }}
            title="Simulate placing a 100g item on the scale"
          >
            +100g Test
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => handleSimulateWeight(500)}
            style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(255, 255, 255, 0.05)' }}
            title="Simulate placing an unscanned 500g item on the scale"
          >
            +500g Alert Test
          </button>
        </div>
      </div>

      {showVideo && (
        <div style={styles.videoBox}>
          <img 
            src={`http://localhost:7860/video_feed`} 
            alt="Raspberry Pi Live ML Feed" 
            style={styles.videoStream}
          />
        </div>
      )}

      {latestScan ? (
        <div style={styles.scanContent}>
          <div style={styles.activeCard}>
            <div style={styles.iconBox}>📷</div>
            <div style={styles.scanDetails}>
              <div style={styles.scanHeader}>
                <span style={styles.itemName}>{latestScan.item_name.replace('_', ' ').toUpperCase()}</span>
                <span style={styles.confidenceBadge}>
                  {(latestScan.confidence).toFixed(1)}% Confidence
                </span>
                <span style={{
                  background: 'rgba(255, 193, 7, 0.15)',
                  color: '#ffc107',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  border: '1px solid rgba(255, 193, 7, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  📦 Expected: {expectedWeight}g
                </span>
                <span style={{
                  background: isWeightVerified ? 'rgba(0, 214, 143, 0.15)' : 'rgba(255, 92, 92, 0.15)',
                  color: isWeightVerified ? '#00D68F' : '#ff5c5c',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  border: `1px solid ${isWeightVerified ? 'rgba(0, 214, 143, 0.4)' : 'rgba(255, 92, 92, 0.4)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  ⚖️ Scale Delta: {currentDiscrepancy > 0 ? `+${currentDiscrepancy}g` : `${currentDiscrepancy}g`} ({isWeightVerified ? 'Verified Match ✅' : 'Scale Checking... ⌛'})
                </span>
                {latestScan.offline_recovered && (
                  <span style={styles.offlineRecoveryBadge}>
                    🌐 SD Card Offline Sync
                  </span>
                )}
              </div>
              <p style={styles.timestamp}>
                Scanned at {new Date(latestScan.timestamp * 1000 || Date.now()).toLocaleTimeString()}
              </p>
            </div>
            <button 
              className="btn btn-primary" 
              style={styles.addBtn}
              onClick={() => handleAddToCart(latestScan)}
            >
              + Add to Cart
            </button>
          </div>

          {/* Recent Scans History Carousel / Chips */}
          {scans.length > 1 && (
            <div style={styles.historyBar}>
              <span style={styles.historyLabel}>Recent Scans:</span>
              <div style={styles.historyChips}>
                {scans.slice(-6).reverse().map((s, idx) => {
                  const m = findBestMatchProduct(s.item_name);
                  return (
                    <div key={idx} style={styles.chip} onClick={() => handleAddToCart(s)} title="Click to add to cart">
                      <span>{s.item_name.replace('_', ' ')}</span>
                      <span style={{ color: '#ffc107', fontWeight: 600, fontSize: '0.75rem', marginLeft: '4px' }}>({m ? m.weight : 150}g)</span>
                      <span style={styles.chipConf}>{Math.round(s.confidence)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={styles.emptyFeed}>
          <span>📷 Waiting for item detection from Raspberry Pi camera...</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    margin: 'var(--sp-4) auto',
    padding: 'var(--sp-4) var(--sp-6)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid rgba(108, 99, 255, 0.3)',
    background: 'linear-gradient(135deg, rgba(16, 16, 36, 0.85) 0%, rgba(26, 20, 50, 0.85) 100%)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    maxWidth: '1200px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 'var(--sp-3)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: 'var(--sp-3)',
  },
  statusGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
  },
  pulseDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#00D68F',
    boxShadow: '0 0 12px #00D68F',
    display: 'inline-block',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-md)',
    fontWeight: 700,
    margin: 0,
    color: '#fff',
  },
  subText: {
    fontSize: 'var(--fs-xs)',
    color: 'var(--clr-text-muted)',
    fontFamily: 'monospace',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-4)',
  },
  autoAddLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    cursor: 'pointer',
    fontSize: 'var(--fs-sm)',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  scanContent: {
    marginTop: 'var(--sp-3)',
  },
  activeCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--sp-4)',
    background: 'rgba(255, 255, 255, 0.03)',
    padding: 'var(--sp-3) var(--sp-4)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(0, 214, 143, 0.3)',
    flexWrap: 'wrap',
  },
  iconBox: {
    fontSize: '2rem',
    background: 'rgba(0, 214, 143, 0.1)',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
  },
  scanDetails: {
    flex: 1,
    minWidth: '200px',
  },
  scanHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    flexWrap: 'wrap',
  },
  itemName: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-lg)',
    fontWeight: 700,
    color: 'var(--clr-accent-light)',
  },
  confidenceBadge: {
    background: 'rgba(0, 214, 143, 0.15)',
    color: '#00D68F',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    border: '1px solid rgba(0, 214, 143, 0.3)',
  },
  offlineRecoveryBadge: {
    background: 'rgba(108, 99, 255, 0.2)',
    color: '#b06cff',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    border: '1px solid #b06cff',
  },
  timestamp: {
    fontSize: 'var(--fs-xs)',
    color: 'var(--clr-text-muted)',
    margin: '4px 0 0 0',
  },
  addBtn: {
    whiteSpace: 'nowrap',
    boxShadow: '0 0 15px rgba(108, 99, 255, 0.4)',
  },
  historyBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    marginTop: 'var(--sp-3)',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  historyLabel: {
    fontSize: 'var(--fs-xs)',
    color: 'var(--clr-text-muted)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  historyChips: {
    display: 'flex',
    gap: 'var(--sp-2)',
  },
  chip: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--fs-xs)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  chipConf: {
    color: '#00D68F',
    fontWeight: 700,
    fontSize: '10px',
  },
  videoBox: {
    marginTop: 'var(--sp-3)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid rgba(108, 99, 255, 0.4)',
    background: '#000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    maxHeight: '420px',
  },
  videoStream: {
    width: '100%',
    maxHeight: '420px',
    objectFit: 'contain',
    display: 'block',
  },
  emptyFeed: {
    padding: 'var(--sp-4)',
    textAlign: 'center',
    color: 'var(--clr-text-muted)',
    fontSize: 'var(--fs-sm)',
  }
};
