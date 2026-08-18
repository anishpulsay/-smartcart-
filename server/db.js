import { JSONFilePreset } from 'lowdb/node'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'data.json')

const defaultData = { products: [], invoices: [], anomalies: [] }

let db
export async function getDb() {
  if (!db) {
    db = await JSONFilePreset(dbPath, defaultData)
  }
  return db
}
