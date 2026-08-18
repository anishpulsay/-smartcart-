import React, { createContext, useContext, useReducer, useCallback } from 'react';

const CartContext = createContext();

const initialState = {
  items: [],
  anomalies: [],
  invoiceHistory: [],
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.barcode === action.payload.barcode);
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.barcode === action.payload.barcode
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.payload, quantity: 1 }],
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(i => i.barcode !== action.payload),
      };

    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(i =>
          i.barcode === action.payload.barcode
            ? { ...i, quantity: Math.max(0, action.payload.quantity) }
            : i
        ).filter(i => i.quantity > 0),
      };

    case 'FLAG_ANOMALY':
      return {
        ...state,
        anomalies: [...state.anomalies, action.payload],
      };

    case 'DISMISS_ANOMALY':
      return {
        ...state,
        anomalies: state.anomalies.filter((_, idx) => idx !== action.payload),
      };

    case 'CLEAR_CART':
      return { ...state, items: [], anomalies: [] };

    case 'ADD_INVOICE':
      return {
        ...state,
        invoiceHistory: [...state.invoiceHistory, action.payload],
      };

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback((product) => {
    dispatch({ type: 'ADD_ITEM', payload: product });
  }, []);

  const removeItem = useCallback((barcode) => {
    dispatch({ type: 'REMOVE_ITEM', payload: barcode });
  }, []);

  const updateQuantity = useCallback((barcode, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { barcode, quantity } });
  }, []);

  const flagAnomaly = useCallback((anomaly) => {
    dispatch({ type: 'FLAG_ANOMALY', payload: anomaly });
  }, []);

  const dismissAnomaly = useCallback((index) => {
    dispatch({ type: 'DISMISS_ANOMALY', payload: index });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const addInvoice = useCallback((invoice) => {
    dispatch({ type: 'ADD_INVOICE', payload: invoice });
  }, []);

  const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  return (
    <CartContext.Provider value={{
      items: state.items,
      anomalies: state.anomalies,
      invoiceHistory: state.invoiceHistory,
      addItem,
      removeItem,
      updateQuantity,
      flagAnomaly,
      dismissAnomaly,
      clearCart,
      addInvoice,
      subtotal,
      tax,
      total,
      itemCount: state.items.reduce((sum, i) => sum + i.quantity, 0),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
