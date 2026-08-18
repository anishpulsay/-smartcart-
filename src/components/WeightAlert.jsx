import React from 'react';

export default function WeightAlert({ anomaly, onDismiss }) {
  const isMatchOrRecovery = anomaly.isRecoveryNote || Math.abs(anomaly.actualWeight - anomaly.expectedWeight) <= 5;
  const devPercent = anomaly.expectedWeight ? Math.abs(((anomaly.actualWeight - anomaly.expectedWeight) / anomaly.expectedWeight) * 100).toFixed(1) : '0.0';

  if (isMatchOrRecovery) {
    return (
      <div className="weight-alert" style={{
        background: 'rgba(0, 214, 143, 0.15)',
        border: '1px solid rgba(0, 214, 143, 0.5)',
        color: '#fff',
        padding: '14px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>✅</span>
          <div>
            <strong style={{ color: '#00D68F' }}>Offline SD Cache Recovery / Weight Verified</strong>
            <div style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--clr-text-muted)' }}>
              <strong>{anomaly.productName}</strong> — exact weight verified: <strong>{anomaly.actualWeight}g</strong> (deviation: {devPercent}%)
            </div>
          </div>
        </div>
        <button className="dismiss-btn" onClick={onDismiss} title="Dismiss" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
      </div>
    );
  }

  return (
    <div className="weight-alert" style={{
      background: 'rgba(255, 92, 92, 0.15)',
      border: '1px solid rgba(255, 92, 92, 0.5)',
      color: '#fff',
      padding: '14px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <strong style={{ color: '#ff5c5c' }}>Security Alert: Weight Mismatch Detected!</strong>
          <div style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--clr-text-muted)' }}>
            <strong>{anomaly.productName}</strong> — expected{' '}
            <strong>{anomaly.expectedWeight}g</strong>, sensor reads{' '}
            <strong>{anomaly.actualWeight}g</strong>
            <span style={{ marginLeft: 'var(--sp-2)', opacity: 0.8 }}>
              (deviation: {devPercent}%)
            </span>
          </div>
        </div>
      </div>
      <button className="dismiss-btn" onClick={onDismiss} title="Dismiss" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
    </div>
  );
}
