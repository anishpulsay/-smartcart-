import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={styles.wrapper}>
      {/* Top right time widget */}
      <div style={styles.timeWidget}>
        {timeString}
      </div>

      {/* Animated background orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />
      <div style={styles.orb3} />

      <div style={styles.content} className="animate-fade-in-up">
        {/* Logo / Cart icon */}
        <div style={styles.iconWrapper} className="animate-float">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="url(#grad)" strokeWidth="2" opacity="0.3"/>
            <path d="M20 22h6l3 6h28l-4 18H30L24 22" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="32" cy="54" r="3" fill="#6C63FF"/>
            <circle cx="50" cy="54" r="3" fill="#b06cff"/>
            <path d="M36 36h8M40 32v8" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="80" y2="80">
                <stop stopColor="#6C63FF"/>
                <stop offset="1" stopColor="#b06cff"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <p style={styles.tagline}>
          Welcome to <span style={styles.brand}>Scovery</span>
        </p>
        <p style={styles.subtitle}>
          Your intelligent shopping companion — scan, weigh, and checkout seamlessly.
        </p>

        {/* CTA */}
        <button
          id="start-shopping-btn"
          className="btn btn-primary btn-lg"
          style={styles.cta}
          onClick={() => navigate('/catalog')}
        >
          🛒 Start Shopping
        </button>

        <p style={styles.footer}>
          &copy; 2026 Scovery Solutions. All rights reserved.
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  timeWidget: {
    position: 'absolute',
    top: 'var(--sp-6)',
    right: 'var(--sp-6)',
    fontSize: 'var(--fs-lg)',
    fontFamily: 'monospace',
    fontWeight: 600,
    color: 'var(--clr-text-primary)',
    background: 'var(--clr-bg-card)',
    padding: 'var(--sp-2) var(--sp-4)',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--clr-border)',
    zIndex: 10,
    boxShadow: 'var(--shadow-md)',
  },
  orb1: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)',
    top: '-150px',
    right: '-100px',
    animation: 'float 6s ease-in-out infinite',
  },
  orb2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(176,108,255,0.12) 0%, transparent 70%)',
    bottom: '-100px',
    left: '-80px',
    animation: 'float 8s ease-in-out infinite reverse',
  },
  orb3: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,214,143,0.08) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'float 10s ease-in-out infinite',
  },
  content: {
    textAlign: 'center',
    zIndex: 1,
    padding: 'var(--sp-8)',
    maxWidth: '600px',
  },
  iconWrapper: {
    marginBottom: 'var(--sp-8)',
    display: 'inline-block',
  },
  greetingWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-3)',
    marginBottom: 'var(--sp-4)',
  },
  emoji: {
    fontSize: 'clamp(2rem, 4vw, 3rem)',
  },
  greeting: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-hero)',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #f0f0f5, #a0a0c0)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.1,
  },
  tagline: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 800,
    color: 'var(--clr-text-primary)',
    marginBottom: 'var(--sp-4)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  brand: {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    background: 'linear-gradient(135deg, #6C63FF 0%, #00D68F 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 0 40px rgba(108, 99, 255, 0.4)',
  },
  subtitle: {
    fontSize: 'var(--fs-base)',
    color: 'var(--clr-text-muted)',
    marginBottom: 'var(--sp-8)',
    maxWidth: '420px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: 1.7,
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--sp-3)',
    justifyContent: 'center',
    marginBottom: 'var(--sp-10)',
  },
  pill: {
    padding: 'var(--sp-2) var(--sp-4)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--fs-sm)',
    color: 'var(--clr-text-secondary)',
    backdropFilter: 'blur(8px)',
  },
  cta: {
    marginBottom: 'var(--sp-8)',
    animation: 'glow-pulse 2s ease-in-out infinite',
    fontSize: 'var(--fs-lg)',
    padding: 'var(--sp-5) var(--sp-12)',
  },
  footer: {
    fontSize: 'var(--fs-xs)',
    color: 'var(--clr-text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
};
