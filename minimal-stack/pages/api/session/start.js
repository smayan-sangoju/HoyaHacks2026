import { v4 as uuidv4 } from 'uuid'

// Simple in-memory session store for prototype. Replace with DB for prod.
const SESSIONS = global.__CLEARCYCLE_SESSIONS || (global.__CLEARCYCLE_SESSIONS = new Map())

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { productBarcode } = await bodyJson(req)
    if (!productBarcode) return res.status(400).json({ error: 'missing productBarcode' })
    const id = uuidv4()
    SESSIONS.set(id, { productBarcode, createdAt: Date.now(), binBarcode: null, used: false })
    res.json({ ok: true, sessionId: id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
}

function bodyJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => raw += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch (e) { resolve({}) }
    })
    req.on('error', reject)
  })
}
