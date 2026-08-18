import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useCart } from '../context/CartContext';
import { savePendingInvoice } from '../utils/offlineSync';

export default function PaymentPage() {
  const { items, subtotal, tax, total, clearCart, addInvoice, anomalies } = useCart();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState(null); // 'cash' | 'upi'
  const [completed, setCompleted] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);

  if (items.length === 0 && !completed) {
    return (
      <div style={styles.page} className="page-enter">
        <div style={styles.emptyState}>
          <span style={{ fontSize: '4rem' }}>🛒</span>
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 'var(--sp-4)' }}>No items to checkout</h2>
          <button className="btn btn-primary" onClick={() => navigate('/catalog')} style={{ marginTop: 'var(--sp-6)' }}>
            ← Go to Catalog
          </button>
        </div>
      </div>
    );
  }

  const upiId = 'anishpulsay2104@okicici';
  const upiLink = `upi://pay?pa=${upiId}&pn=SmartCart&am=${total.toFixed(2)}&cu=INR&tn=SmartCart+Invoice`;

  const handleFinalize = async () => {
    const invoice = {
      id: `INV-${Date.now()}`,
      items: items.map(i => ({
        barcode: i.barcode,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        lineTotal: i.price * i.quantity,
        weight: i.weight,
      })),
      subtotal,
      tax,
      total,
      paymentMethod,
      anomalies: anomalies.map(a => ({
        productBarcode: a.productBarcode,
        expectedWeight: a.expectedWeight,
        actualWeight: a.actualWeight,
      })),
      timestamp: new Date().toISOString(),
    };

    setInvoiceId(invoice.id);

    // Try to POST to backend, cache if offline
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
      if (!res.ok) throw new Error('Server error');
    } catch {
      savePendingInvoice(invoice);
    }

    addInvoice(invoice);
    clearCart();
    setCompleted(true);
  };

  useEffect(() => {
    let intervalId;
    if (paymentMethod === 'upi' && !completed) {
      // 1. Reset backend state on mount
      fetch('/api/payment/reset', { method: 'POST' }).catch(() => {});
      
      // 2. Poll for payment status every 2 seconds
      intervalId = setInterval(async () => {
        try {
          const res = await fetch('/api/payment/status', { cache: 'no-store' });
          const data = await res.json();
          if (data.paid) {
            clearInterval(intervalId);
            handleFinalize();
          }
        } catch {
          // ignore network errors
        }
      }, 2000);
    }
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, completed]);

  if (completed) {
    return (
      <div style={styles.page} className="page-enter">
        <div style={styles.successCard} className="glass">
          <div style={styles.successIcon}>✅</div>
          <h1 style={styles.successTitle}>Payment Complete!</h1>
          <p style={styles.successSub}>Invoice <strong>{invoiceId}</strong> has been generated</p>
          <div style={styles.successMeta}>
            <span className="badge badge-success">
              {paymentMethod === 'cash' ? '💵 Cash' : '📱 UPI'} Payment
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-xl)', fontWeight: 700 }}>
              ₹{total.toFixed(2)}
            </span>
          </div>
          <p style={{ color: 'var(--clr-text-muted)', fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-4)' }}>
            Invoice stored for shopkeeper access. Thank you for shopping with SmartCart!
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/')} style={{ marginTop: 'var(--sp-8)' }}>
            🏠 Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page} className="page-enter">
      <header style={styles.header}>
        <div style={styles.headerInner} className="container">
          <h1 style={styles.title}>💳 Checkout & Payment</h1>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/cart')}>
            ← Back to Cart
          </button>
        </div>
      </header>

      <div className="container" style={{ padding: 'var(--sp-6)', maxWidth: '800px' }}>
        {/* Invoice Preview */}
        <div className="glass" style={styles.invoiceCard}>
          <div style={styles.invoiceHeader}>
            <div>
              <h2 style={styles.invoiceTitle}>📄 Digital Invoice</h2>
              <p style={styles.invoiceDate}>{new Date().toLocaleString()}</p>
            </div>
            <span className="badge badge-warning">PENDING</span>
          </div>

          <div className="table-wrapper" style={{ marginTop: 'var(--sp-4)' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.barcode}>
                    <td style={{ color: 'var(--clr-text-muted)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} /> : '📦'}
                        {item.name}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>₹{item.price.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.invoiceTotals}>
            <div style={styles.totalLine}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div style={styles.totalLine}><span>GST (5%)</span><span>₹{tax.toFixed(2)}</span></div>
            <div style={{ ...styles.totalLine, ...styles.grandTotalLine }}>
              <span>Grand Total</span><span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Anomaly warnings in invoice */}
          {anomalies.length > 0 && (
            <div style={styles.anomalySection}>
              <h3 style={{ color: 'var(--clr-warning)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-2)' }}>
                ⚠️ Billing Anomalies Detected ({anomalies.length})
              </h3>
              {anomalies.map((a, i) => (
                <div key={i} style={styles.anomalyItem}>
                  {a.productName}: expected {a.expectedWeight}g, got {a.actualWeight}g
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <h2 style={styles.paymentTitle}>Select Payment Method</h2>
        <div style={styles.paymentGrid}>
          {/* Cash */}
          <div
            className="card"
            style={{
              ...styles.paymentOption,
              ...(paymentMethod === 'cash' ? styles.paymentSelected : {}),
            }}
            onClick={() => setPaymentMethod('cash')}
          >
            <div style={styles.paymentIcon}>💵</div>
            <h3 style={styles.paymentName}>Cash</h3>
            <p style={styles.paymentDesc}>Pay with cash at the counter</p>
            {paymentMethod === 'cash' && <div style={styles.checkmark}>✓</div>}
          </div>

          {/* UPI */}
          <div
            className="card"
            style={{
              ...styles.paymentOption,
              ...(paymentMethod === 'upi' ? styles.paymentSelected : {}),
            }}
            onClick={() => setPaymentMethod('upi')}
          >
            <div style={styles.paymentIcon}>📱</div>
            <h3 style={styles.paymentName}>UPI</h3>
            <p style={styles.paymentDesc}>Scan QR code to pay via UPI</p>
            {paymentMethod === 'upi' && <div style={styles.checkmark}>✓</div>}
          </div>
        </div>

        {/* UPI QR Code */}
        {paymentMethod === 'upi' && (
          <div className="glass" style={styles.qrSection}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
              Scan to Pay ₹{total.toFixed(2)}
            </h3>
            <div style={styles.qrWrapper}>
              <QRCode
                value={upiLink}
                size={200}
                bgColor="transparent"
                fgColor="#f0f0f5"
                level="M"
              />
            </div>
            <p style={styles.qrUpiId}>UPI ID: <strong>{upiId}</strong></p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--clr-text-muted)', textAlign: 'center' }}>
              Scan with any UPI app (Google Pay, PhonePe, Paytm, etc.)
            </p>
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)' }}>
              <span className="badge badge-warning" style={{ fontSize: 'var(--fs-base)', padding: 'var(--sp-2) var(--sp-4)', background: 'rgba(255, 165, 0, 0.1)', color: 'orange', border: '1px solid orange', borderRadius: '20px' }}>
                ⏳ Waiting for payment confirmation...
              </span>
              
              <button 
                className="btn btn-sm"
                style={{ background: 'transparent', border: '1px dashed var(--clr-border)', color: 'var(--clr-text-muted)', marginTop: 'var(--sp-4)' }}
                onClick={() => fetch('/api/payment/webhook', { method: 'POST' })}
              >
                🛠️ Simulate Webhook (Dev)
              </button>
            </div>
          </div>
        )}

        {/* Finalize */}
        {paymentMethod === 'cash' && (
          <button
            id="finalize-payment-btn"
            className="btn btn-success btn-lg"
            style={styles.finalizeBtn}
            onClick={handleFinalize}
          >
            ✅ Confirm Cash Payment — ₹{total.toFixed(2)}
          </button>
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
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-xl)',
    fontWeight: 700,
  },
  invoiceCard: { padding: 'var(--sp-6)' },
  invoiceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-lg)',
    fontWeight: 600,
  },
  invoiceDate: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--clr-text-muted)',
    marginTop: 'var(--sp-1)',
  },
  invoiceTotals: {
    padding: 'var(--sp-4) 0',
  },
  totalLine: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 'var(--sp-2) 0',
    fontSize: 'var(--fs-base)',
    color: 'var(--clr-text-secondary)',
    fontFamily: 'monospace',
  },
  grandTotalLine: {
    borderTop: '1px solid var(--clr-border)',
    paddingTop: 'var(--sp-4)',
    marginTop: 'var(--sp-2)',
    fontWeight: 700,
    fontSize: 'var(--fs-lg)',
    color: 'var(--clr-text-primary)',
  },
  anomalySection: {
    padding: 'var(--sp-4)',
    background: 'var(--clr-warning-bg)',
    borderRadius: 'var(--radius-md)',
    marginTop: 'var(--sp-4)',
  },
  anomalyItem: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--clr-text-secondary)',
    padding: 'var(--sp-1) 0',
    fontFamily: 'monospace',
  },
  paymentTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-xl)',
    fontWeight: 700,
    marginTop: 'var(--sp-8)',
    marginBottom: 'var(--sp-4)',
  },
  paymentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--sp-4)',
  },
  paymentOption: {
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all var(--transition-base)',
  },
  paymentSelected: {
    borderColor: 'var(--clr-accent)',
    boxShadow: '0 0 30px var(--clr-accent-glow)',
    background: 'rgba(108,99,255,0.08)',
  },
  paymentIcon: { fontSize: '2.5rem', marginBottom: 'var(--sp-3)' },
  paymentName: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-lg)',
    fontWeight: 600,
  },
  paymentDesc: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--clr-text-muted)',
    marginTop: 'var(--sp-2)',
  },
  checkmark: {
    position: 'absolute',
    top: 'var(--sp-3)',
    right: 'var(--sp-3)',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--gradient-accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 'var(--fs-sm)',
  },
  qrSection: {
    padding: 'var(--sp-8)',
    marginTop: 'var(--sp-6)',
  },
  qrWrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: 'var(--sp-6)',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 'var(--sp-4)',
  },
  qrUpiId: {
    textAlign: 'center',
    fontSize: 'var(--fs-sm)',
    color: 'var(--clr-text-secondary)',
    marginBottom: 'var(--sp-2)',
    fontFamily: 'monospace',
  },
  finalizeBtn: {
    width: '100%',
    marginTop: 'var(--sp-6)',
    marginBottom: 'var(--sp-16)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  successCard: {
    maxWidth: '500px',
    margin: 'var(--sp-16) auto',
    padding: 'var(--sp-10)',
    textAlign: 'center',
  },
  successIcon: { fontSize: '4rem', marginBottom: 'var(--sp-4)' },
  successTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-3xl)',
    fontWeight: 800,
    marginBottom: 'var(--sp-2)',
  },
  successSub: {
    fontSize: 'var(--fs-base)',
    color: 'var(--clr-text-secondary)',
  },
  successMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-4)',
    marginTop: 'var(--sp-6)',
  },
};
