import formidable from 'formidable'
import fs from 'fs'
import crypto from 'crypto'

export const config = { api: { bodyParser: false } }

const SESSIONS = global.__CLEARCYCLE_SESSIONS || (global.__CLEARCYCLE_SESSIONS = new Map())
const VIDEO_HASHES = global.__CLEARCYCLE_HASHES || (global.__CLEARCYCLE_HASHES = new Set())

// Simple rate limiting / cooldowns (in-memory)
const COOLDOWNS = global.__CLEARCYCLE_COOLDOWNS || (global.__CLEARCYCLE_COOLDOWNS = new Map())

function enforceCooldown(key, ms = 10_000) {
  const last = COOLDOWNS.get(key) || 0
  if (Date.now() - last < ms) return false
  COOLDOWNS.set(key, Date.now())
  return true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // parse multipart
  const form = new formidable.IncomingForm()
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'upload error' })
    try {
      const sessionId = fields.sessionId
      if (!sessionId || !SESSIONS.has(sessionId)) return res.status(400).json({ error: 'invalid session' })
      const session = SESSIONS.get(sessionId)

      // order enforcement: product & bin must be present
      if (!session.productBarcode || !session.binBarcode) return res.status(400).json({ error: 'incomplete session' })

      // enforce cooldown per productBarcode
      if (!enforceCooldown(session.productBarcode, 5000)) return res.status(429).json({ error: 'too many attempts' })

      // read video file
      const file = files.video
      if (!file) return res.status(400).json({ error: 'no video' })
      const buf = fs.readFileSync(file.filepath)
      const hash = crypto.createHash('sha256').update(buf).digest('hex')
      if (VIDEO_HASHES.has(hash)) return res.status(400).json({ ok: false, reason: 'duplicate video' })
      // store hash to prevent reuploads
      VIDEO_HASHES.add(hash)

      // frames JSON
      const frames = JSON.parse(fields.frames || '[]')

      // AI verification using OpenRouter (stubbed)
      const ai = await verifyWithOpenRouter(frames, { productBarcode: session.productBarcode, binBarcode: session.binBarcode })

      // apply simple logic: require binVisible && bottleVisible && confidence > 0.6
      const pass = ai.binVisible && ai.bottleVisible && ai.confidence > 0.6
      if (pass) {
        // award points (for prototype, just return success)
        return res.json({ ok: true, points: 50, ai })
      } else {
        return res.json({ ok: false, reason: 'ai_reject', ai })
      }

    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: 'server error' })
    }
  })
}

async function verifyWithOpenRouter(frames, context) {
  // This is a simple implementation that sends frames to OpenRouter
  // Replace the endpoint with your OpenRouter / vision-enabled model endpoint.
  const API_KEY = process.env.OPENROUTER_API_KEY
  if (!API_KEY) {
    // In dev mode, fake a response
    return { binVisible: true, bottleVisible: true, action: 'dispose', confidence: 0.85 }
  }

  // For a real integration: POST frames to the model (multipart or json with base64 frames)
  // and parse the returned JSON verdict. This demo returns a placeholder.
  return { binVisible: true, bottleVisible: true, action: 'dispose', confidence: 0.78 }
}
