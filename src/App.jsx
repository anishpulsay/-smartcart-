import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import CartPage from './pages/CartPage.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import LiveCameraBar from './components/LiveCameraBar.jsx';

export default function App() {
  return (
    <>
      <OfflineBanner />
      <div className="container" style={{ padding: '0 var(--sp-4)' }}>
        <LiveCameraBar />
      </div>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </>
  );
}
