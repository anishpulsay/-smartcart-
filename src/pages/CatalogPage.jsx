import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { savePendingAnomaly } from '../utils/offlineSync';

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const { itemCount, addItem, flagAnomaly } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    fetch((import.meta.env.VITE_API_URL || '') + '/api/products')
      .then(r => r.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const handleAdd = async (product) => {
    addItem(product);

    // Simulate weight sensor: 90% chance correct, 10% chance mismatch
    const isAnomaly = Math.random() < 0.1;
    if (isAnomaly) {
      const deviation = product.weight * (0.1 + Math.random() * 0.2); // 10-30% off
      const actualWeight = Math.round(product.weight + (Math.random() > 0.5 ? deviation : -deviation));
      const anomaly = {
        productName: product.name,
        productBarcode: product.barcode,
        expectedWeight: product.weight,
        actualWeight,
        timestamp: new Date().toISOString(),
      };
      
      flagAnomaly(anomaly);

      try {
        await fetch((import.meta.env.VITE_API_URL || '') + '/api/anomalies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(anomaly),
        });
      } catch {
        savePendingAnomaly(anomaly);
      }
    }
  };

  return (
    <div style={styles.page} className="page-enter">
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner} className="container">
          <div>
            <h1 style={styles.title}>
              <span style={styles.titleIcon}>🏪</span> Product Catalog
            </h1>
            <p style={styles.subtitle}>{products.length} products available</p>
          </div>
          <button
            id="go-to-cart-btn"
            className="btn btn-primary"
            onClick={() => navigate('/cart')}
            style={styles.cartBtn}
          >
            🛒 Cart
            {itemCount > 0 && <span style={styles.cartBadge}>{itemCount}</span>}
          </button>
        </div>
      </header>

      <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-16)' }}>
        {/* Search & Filters */}
        <div style={styles.filterRow}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="product-search-input"
            style={styles.searchInput}
          />
        </div>

        {/* Category chips */}
        <div style={styles.chips}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm ${activeCategory === cat ? '' : 'btn-secondary'}`}
              style={activeCategory === cat ? styles.chipActive : styles.chip}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div style={styles.loadingGrid}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={styles.skeleton} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: '3rem' }}>🔍</span>
            <p>No products found</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filtered.map((product, idx) => (
              <div
                key={product.barcode}
                className="card"
                style={{
                  ...styles.productCard,
                  animationDelay: `${idx * 0.05}s`,
                }}
              >
                <div style={styles.productImage}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} style={styles.imageConfig} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: '2.5rem' }}>📦</span>
                  )}
                </div>
                <div style={styles.productInfo}>
                  <span style={styles.categoryLabel}>{product.category}</span>
                  <h3 style={styles.productName}>{product.name}</h3>
                  <div style={styles.productMeta}>
                    <span style={styles.weight}>⚖️ {product.weight}g</span>
                  </div>
                  <div style={styles.productFooter}>
                    <span style={styles.price}>₹{product.price.toFixed(2)}</span>
                    <button
                      className="btn btn-primary btn-sm"
                      style={styles.addBtn}
                      onClick={() => handleAdd(product)}
                    >
                      Add +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
  titleIcon: { marginRight: 'var(--sp-2)' },
  subtitle: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--clr-text-muted)',
    marginTop: 'var(--sp-1)',
  },
  cartBtn: { position: 'relative' },
  cartBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    background: 'var(--clr-danger)',
    color: '#fff',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
  },
  filterRow: { marginBottom: 'var(--sp-4)' },
  searchInput: { maxWidth: '400px' },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--sp-2)',
    marginBottom: 'var(--sp-6)',
  },
  chip: {},
  chipActive: {
    background: 'var(--gradient-accent)',
    color: '#fff',
    border: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 'var(--sp-5)',
  },
  productCard: {
    animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    overflow: 'hidden',
  },
  productImage: {
    height: '160px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid var(--clr-border)',
    overflow: 'hidden',
  },
  imageConfig: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  productInfo: {
    padding: 'var(--sp-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-2)',
    flex: 1,
  },
  categoryLabel: {
    fontSize: 'var(--fs-xs)',
    color: 'var(--clr-accent-light)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  productName: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-md)',
    fontWeight: 600,
  },
  productMeta: {
    display: 'flex',
    gap: 'var(--sp-3)',
    fontSize: 'var(--fs-xs)',
    color: 'var(--clr-text-muted)',
  },
  weight: {},
  productFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 'var(--sp-3)',
    borderTop: '1px solid var(--clr-border)',
  },
  price: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-lg)',
    fontWeight: 700,
    color: 'var(--clr-success)',
  },
  addBtn: {},
  loadingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 'var(--sp-5)',
  },
  skeleton: {
    height: '260px',
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  empty: {
    textAlign: 'center',
    padding: 'var(--sp-16)',
    color: 'var(--clr-text-muted)',
  },
};
