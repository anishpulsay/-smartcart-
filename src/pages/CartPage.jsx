import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import WeightAlert from '../components/WeightAlert';
import { savePendingAnomaly } from '../utils/offlineSync';

export default function CartPage() {
  const {
    items, anomalies, addItem, removeItem, updateQuantity,
    flagAnomaly, dismissAnomaly, subtotal, tax, total, itemCount,
  } = useCart();
  const navigate = useNavigate();
  const [scale, setScale] = useState({ currentWeight: 0, status: 'Balanced / Tared', lastDelta: 0 });

  useEffect(() => {
    const fetchScale = () => {
      fetch('/api/scale')
        .then(r => r.json())
        .then(data => setScale(data))
        .catch(() => {});
    };
    fetchScale();
    const interval = setInterval(fetchScale, 1000);
    return () => clearInterval(interval);
  }, []);

  const expectedTotalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
  const isBasketBalanced = Math.abs(Number(scale?.currentWeight || 0) - expectedTotalWeight) <= 40;

  return (
    <div style={styles.page} className="page-enter">
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner} className="container">
          <div>
            <h1 style={styles.title}>🛒 Shopping Cart</h1>
            <p style={styles.subtitle}>{itemCount} item{itemCount !== 1 ? 's' : ''} in cart</p>
          </div>
          <div style={styles.headerActions}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/catalog')}>
              ← Back to Catalog
            </button>
            {items.length > 0 && (
              <button className="btn btn-success" onClick={() => navigate('/payment')}>
                Proceed to Pay →
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="container" style={{ padding: 'var(--sp-6)', maxWidth: '900px' }}>
        {/* Weight Alerts */}
        {anomalies.map((anomaly, idx) => (
          <WeightAlert key={idx} anomaly={anomaly} onDismiss={() => dismissAnomaly(idx)} />
        ))}

        {/* Live Basket Weight Verification Banner */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: isBasketBalanced ? 'rgba(0, 214, 143, 0.1)' : 'rgba(255, 92, 92, 0.1)',
          border: `1px solid ${isBasketBalanced ? 'rgba(0, 214, 143, 0.4)' : 'rgba(255, 92, 92, 0.4)'}`,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '2rem' }}>⚖️</span>
            <div>
              <h4 style={{ margin: 0, color: '#fff', fontSize: '1.05rem', fontWeight: 700 }}>
                Live Smart Cart Scale & Security Status
              </h4>
              <div style={{ fontSize: '0.85rem', color: 'var(--clr-text-muted)', marginTop: '4px' }}>
                Expected Cart Weight: <strong style={{ color: '#ffc107' }}>{expectedTotalWeight} g</strong> | 
                Load Cell Reading: <strong style={{ color: isBasketBalanced ? '#00D68F' : '#ff5c5c' }}>{Number(scale?.currentWeight || 0).toFixed(1)} g</strong>
              </div>
            </div>
          </div>
          <div style={{
            background: isBasketBalanced ? 'rgba(0, 214, 143, 0.2)' : 'rgba(255, 92, 92, 0.2)',
            color: isBasketBalanced ? '#00D68F' : '#ff5c5c',
            padding: '6px 14px',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}>
            {isBasketBalanced ? '✅ Weight Verified' : '⚠️ Weight Mismatch Alert'}
          </div>
        </div>

        {/* Cart Items */}
        {items.length === 0 ? (
          <div style={styles.emptyCart}>
            <span style={{ fontSize: '4rem' }}>🛒</span>
            <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 'var(--sp-4)' }}>Your cart is empty</h2>
            <p style={{ color: 'var(--clr-text-muted)', marginTop: 'var(--sp-2)' }}>
              Add items from the catalog
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrapper" style={{ marginTop: 'var(--sp-6)' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product & Live Weight</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.barcode} style={styles.cartRow}>
                      <td>
                        <div style={styles.productCell}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                          ) : (
                            <span style={{ fontSize: '1.5rem' }}>📦</span>
                          )}
                          <div>
                            <div style={styles.itemName}>{item.name}</div>
                            <div style={{
                              display: 'inline-block',
                              background: 'rgba(255, 193, 7, 0.15)',
                              color: '#ffc107',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              marginTop: '4px'
                            }}>
                              ⚖️ Unit Weight: {item.weight || 150}g
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={styles.qtyControls}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={styles.qtyBtn}
                            onClick={() => updateQuantity(item.barcode, item.quantity - 1)}
                          >−</button>
                          <span style={styles.qtyValue}>{item.quantity}</span>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={styles.qtyBtn}
                            onClick={() => updateQuantity(item.barcode, item.quantity + 1)}
                          >+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          style={styles.removeBtn}
                          onClick={() => removeItem(item.barcode)}
                          title="Remove"
                        >🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={styles.totalsCard} className="glass">
              <div style={styles.totalRow}>
                <span>Subtotal</span>
                <span style={{ fontFamily: 'monospace' }}>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={styles.totalRow}>
                <span>GST (5%)</span>
                <span style={{ fontFamily: 'monospace' }}>₹{tax.toFixed(2)}</span>
              </div>
              <div style={{ ...styles.totalRow, ...styles.grandTotal }}>
                <span>Grand Total</span>
                <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-xl)' }}>₹{total.toFixed(2)}</span>
              </div>
              <button
                id="proceed-to-pay-btn"
                className="btn btn-success btn-lg"
                style={{ width: '100%', marginTop: 'var(--sp-4)' }}
                onClick={() => navigate('/payment')}
              >
                💳 Proceed to Payment
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh' },
  header: {
    borderBottom: '1px solid var(--clr-border)',
    background: 'rgba(10,10,26,0.8)',
    backdropFilter: 'blur(20px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--sp-4) var(--sp-6)',
    flexWrap: 'wrap',
    gap: 'var(--sp-3)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-xl)',
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--clr-text-muted)',
    marginTop: 'var(--sp-1)',
  },
  headerActions: {
    display: 'flex',
    gap: 'var(--sp-3)',
    alignItems: 'center',
  },
  emptyCart: {
    textAlign: 'center',
    padding: 'var(--sp-16) var(--sp-8)',
  },
  cartRow: {
    transition: 'background var(--transition-fast)',
  },
  productCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
  },
  itemName: { fontWeight: 600 },
  itemBarcode: {
    fontSize: 'var(--fs-xs)',
    color: 'var(--clr-text-muted)',
    fontFamily: 'monospace',
    marginTop: '2px',
  },
  qtyControls: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
  },
  qtyBtn: {
    width: '30px',
    height: '30px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 700,
    fontSize: 'var(--fs-md)',
  },
  qtyValue: {
    fontWeight: 700,
    fontFamily: 'monospace',
    fontSize: 'var(--fs-md)',
    minWidth: '24px',
    textAlign: 'center',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--fs-md)',
    opacity: 0.5,
    transition: 'opacity var(--transition-fast)',
  },
  totalsCard: {
    padding: 'var(--sp-6)',
    marginTop: 'var(--sp-6)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 'var(--sp-3) 0',
    fontSize: 'var(--fs-base)',
    color: 'var(--clr-text-secondary)',
  },
  grandTotal: {
    borderTop: '1px solid var(--clr-border)',
    paddingTop: 'var(--sp-4)',
    marginTop: 'var(--sp-2)',
    fontWeight: 700,
    fontSize: 'var(--fs-lg)',
    color: 'var(--clr-text-primary)',
  },
};
