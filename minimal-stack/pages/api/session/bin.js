const SESSIONS = global.__CLEARCYCLE_SESSIONS || (global.__CLEARCYCLE_SESSIONS = new Map())

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { sessionId, binBarcode } = await bodyJson(req)
    if (!sessionId || !SESSIONS.has(sessionId)) return res.status(400).json({ error: 'invalid session' })
    const s = SESSIONS.get(sessionId)
    s.binBarcode = binBarcode
    s.binAttachedAt = Date.now()
    SESSIONS.set(sessionId, s)
    res.json({ ok: true })
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
