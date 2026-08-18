import express from 'express'
import cors from 'cors'
import { getDb } from './db.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// ─── Products ─────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  const db = await getDb()
  res.json(db.data.products)
})

app.get('/api/products/:barcode', async (req, res) => {
  const db = await getDb()
  const product = db.data.products.find(p => p.barcode === req.params.barcode)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  res.json(product)
})

// ─── Invoices ─────────────────────────────────────────────────

app.post('/api/invoices', async (req, res) => {
  const db = await getDb()
  const invoice = { ...req.body, createdAt: new Date().toISOString() }
  // Remove existing with same id (for offline re-sync)
  db.data.invoices = db.data.invoices.filter(i => i.id !== invoice.id)
  db.data.invoices.unshift(invoice)
  await db.write()
  res.json({ success: true, invoiceId: invoice.id })
})

app.get('/api/invoices', async (req, res) => {
  const db = await getDb()
  res.json(db.data.invoices)
})

// ─── Anomalies ────────────────────────────────────────────────

app.post('/api/anomalies', async (req, res) => {
  const db = await getDb()
  const anomaly = { ...req.body, id: Date.now(), createdAt: new Date().toISOString() }
  db.data.anomalies.unshift(anomaly)
  await db.write()
  res.json({ success: true, id: anomaly.id })
})

app.get('/api/anomalies', async (req, res) => {
  const db = await getDb()
  res.json(db.data.anomalies)
})

// ─── Payment Webhook Mock ─────────────────────────────────────

let mockPaymentStatus = { paid: false };

app.get('/api/payment/status', (req, res) => {
  res.json(mockPaymentStatus);
});

app.post('/api/payment/webhook', (req, res) => {
  mockPaymentStatus.paid = true;
  res.json({ success: true });
});

app.post('/api/payment/reset', (req, res) => {
  mockPaymentStatus.paid = false;
  res.json({ success: true });
});

// ─── Camera Scans (Added for ML Camera) ───────────────────────

let recentScans = []

app.post('/api/camera_scans', (req, res) => {
  const scan = { ...req.body, id: Date.now() }
  recentScans.push(scan)
  if (recentScans.length > 50) recentScans.shift()
  res.json({ success: true, scan })
})

app.get('/api/camera_scans', (req, res) => {
  res.json(recentScans)
})

app.delete('/api/camera_scans', (req, res) => {
  recentScans = []
  res.json({ success: true })
})

// ─── Load Cell Scale Integration (HX711 / Raspberry Pi) ───────

let scaleState = {
  currentWeight: 0.0,       // Live weight in grams on the cart basket
  lastDelta: 0.0,           // Last weight change (+/- grams)
  isStable: true,           // Whether scale reading has settled
  lastUpdated: null,
  status: 'Balanced / Tared', // 'Balanced / Tared', 'Verified ✅', 'Weight Mismatch ⚠️', 'Unscanned Item 🚨'
  lastVerifiedItem: null,
  history: []
}

function roundTo(num, decimals = 1) {
  return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
}

app.post('/api/scale', (req, res) => {
  const { current_weight, delta, is_stable, status_override, verified_item } = req.body;
  const oldWeight = scaleState.currentWeight;
  const newWeight = typeof current_weight === 'number' ? roundTo(current_weight, 1) : oldWeight;
  const weightDelta = typeof delta === 'number' ? roundTo(delta, 1) : roundTo(newWeight - oldWeight, 1);

  scaleState.currentWeight = newWeight;
  scaleState.lastDelta = weightDelta;
  if (typeof is_stable === 'boolean') scaleState.isStable = is_stable;
  scaleState.lastUpdated = new Date().toISOString();

  if (status_override) scaleState.status = status_override;
  if (verified_item !== undefined) scaleState.lastVerifiedItem = verified_item;

  scaleState.history.push({
    weight: newWeight,
    delta: weightDelta,
    timestamp: scaleState.lastUpdated
  });
  if (scaleState.history.length > 50) scaleState.history.shift();

  res.json({ success: true, scale: scaleState });
})

app.get('/api/scale', (req, res) => {
  res.json(scaleState);
})

app.post('/api/scale/tare', (req, res) => {
  scaleState.currentWeight = 0.0;
  scaleState.lastDelta = 0.0;
  scaleState.status = 'Balanced / Tared';
  scaleState.lastVerifiedItem = null;
  res.json({ success: true, scale: scaleState });
})

app.post('/api/scale/simulate_add', (req, res) => {
  const { grams, item_name, status_override } = req.body;
  const addWeight = Number(grams) || 100;
  scaleState.currentWeight = roundTo(scaleState.currentWeight + addWeight, 1);
  scaleState.lastDelta = roundTo(addWeight, 1);
  scaleState.lastUpdated = new Date().toISOString();
  if (status_override) {
    scaleState.status = status_override;
  } else if (item_name) {
    scaleState.status = `Verified ✅ (+${addWeight}g for ${item_name})`;
    scaleState.lastVerifiedItem = { name: item_name, weight: addWeight };
  } else {
    scaleState.status = `Unscanned Item Placed (+${addWeight}g)`;
  }
  res.json({ success: true, scale: scaleState });
})

// ─── Start ────────────────────────────────────────────────────

app.listen(PORT, async () => {
  // Auto-seed if no products exist
  const db = await getDb()
  if (db.data.products.length === 0) {
    const { default: seed } = await import('./seed.js').catch(() => ({ default: null }))
  }
  console.log(`🚀 SmartCart API running on http://localhost:${PORT}`)
})
