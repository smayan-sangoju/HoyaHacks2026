require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const USE_MOCK = process.env.USE_MOCK_DB === 'true'
const { fakeVerify } = require('./verify')

let User, DisposalEvent, RecycleEvent, Product

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 4000
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/clearcycle'

if (USE_MOCK) {
  // Use in-memory mock models when USE_MOCK_DB=true
  ;({ User, DisposalEvent, RecycleEvent, Product } = require('./mockModels'))
  console.log('Running in MOCK DB mode — no MongoDB required')
} else {
  const mongoose = require('mongoose')
  ;(async () => {
    try {
      await mongoose.connect(MONGO_URI)
      console.log('Connected to MongoDB')
    } catch (err) {
      console.error('MongoDB connection error', err)
    }
  })()
  User = require('./models/User')
  DisposalEvent = require('./models/DisposalEvent')
  RecycleEvent = require('./models/RecycleEvent')
  Product = require('./models/Product')
}

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer config - store uploaded files in backend/uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // keep original name prefixed with timestamp to avoid collisions
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Serve uploaded images statically
app.use('/uploads', express.static(UPLOAD_DIR));

// Simple seed: create demo user if missing
async function ensureDemoUser() {
  const email = process.env.DEMO_USER_EMAIL || 'demo@clear.cycle'
  const name = process.env.DEMO_USER_NAME || 'Demo Student'
  let user = await User.findOne({ email })
  if (!user) {
    user = await User.create({ name, email, diningCredits: 0 })
    console.log('Created demo user:', email)
  }
}

// Helper to compute SHA256 hash of a file buffer (for duplicate detection)
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeBaseUrl(url) {
  if (!url) return ''
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function s3IsConfigured() {
  return Boolean(
    process.env.S3_BUCKET &&
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_PUBLIC_BASE_URL
  )
}

let _s3Client = null
function getS3Client() {
  if (!s3IsConfigured()) return null
  if (_s3Client) return _s3Client
  _s3Client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    },
    forcePathStyle: true
  })
  return _s3Client
}

async function uploadFileToS3IfConfigured({ filePath, contentType, key }) {
  const client = getS3Client()
  if (!client) return null

  const Body = fs.createReadStream(filePath)
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body,
    ContentType: contentType || 'application/octet-stream'
  }))

  const publicBase = normalizeBaseUrl(process.env.S3_PUBLIC_BASE_URL)
  return `${publicBase}/${key}`
}

// --- Minimal in-memory rate limiting (hackathon-safe) ---
function createRateLimiter({ windowMs, max, keyFn }) {
  const buckets = new Map()
  return function rateLimit(req, res, next) {
    const now = Date.now()
    const key = keyFn(req)
    const b = buckets.get(key)
    if (!b || now > b.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    b.count += 1
    if (b.count > max) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfterSeconds: retryAfter })
    }
    return next()
  }
}

const recycleRateLimit = createRateLimiter({
  windowMs: Number(process.env.RATE_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_MAX || 60),
  keyFn: (req) => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip
    const email = (req.body && req.body.email) || (req.query && req.query.email) || ''
    return `${ip}|${email}`
  }
})

// --- Recycle session flow (product -> bin -> video) ---
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 60_000)
const USER_COOLDOWN_MS = Number(process.env.USER_COOLDOWN_MS || 30_000)
const BIN_COOLDOWN_MS = Number(process.env.BIN_COOLDOWN_MS || 15_000)
const USER_PRODUCT_COOLDOWN_MS = Number(process.env.USER_PRODUCT_COOLDOWN_MS || 86_400_000) // 24h
const RECYCLE_POINTS = Number(process.env.RECYCLE_POINTS || 50)

const recycleSessions = new Map()
function newSessionId() {
  return crypto.randomBytes(16).toString('hex')
}
function getSessionOrThrow(sessionId) {
  const s = recycleSessions.get(sessionId)
  if (!s) {
    const err = new Error('Invalid session')
    err.status = 404
    throw err
  }
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    recycleSessions.delete(sessionId)
    const err = new Error('Session expired')
    err.status = 410
    throw err
  }
  return s
}

function parseDataUrlImages(rawFrames) {
  if (!rawFrames) return []
  try {
    const arr = typeof rawFrames === 'string' ? JSON.parse(rawFrames) : rawFrames
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x) => typeof x === 'string' && x.startsWith('data:image/'))
      .slice(0, 3)
  } catch {
    return []
  }
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {}
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const candidate = text.slice(start, end + 1)
    try {
      return JSON.parse(candidate)
    } catch {}
  }
  return null
}

async function verifyFramesWithOpenRouter({ frames }) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    return {
      verified: true,
      confidence: 0.5,
      verdict: { pass: true, note: 'OPENROUTER_API_KEY not set; skipping vision verification.' }
    }
  }

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
  const siteUrl = process.env.OPENROUTER_SITE_URL || 'http://localhost'
  const title = process.env.OPENROUTER_APP_TITLE || 'ClearCycle'

  const system = [
    'You are a recycling verification system for a hackathon demo.',
    'You will receive 2-3 camera frames from a short verification video.',
    'Return ONLY strict JSON (no markdown, no extra text).',
    'Required keys: bin_visible (boolean), bottle_visible (boolean), disposal_action (boolean), confidence (number 0..1), notes (string).',
    'Also include pass (boolean) where pass=true only if all 3 booleans are true and confidence >= 0.65.'
  ].join('\n')

  const userContent = [
    {
      type: 'text',
      text: 'Check if a recycling bin is visible, a bottle/container is visible, and the disposal action is happening (bottle entering bin).'
    },
    ...frames.map((url) => ({ type: 'image_url', image_url: { url } }))
  ]

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': title
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent }
      ]
    })
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    return {
      verified: false,
      confidence: 0,
      verdict: { pass: false, notes: `OpenRouter error: ${data?.error?.message || resp.statusText || 'unknown'}` }
    }
  }

  const text = data?.choices?.[0]?.message?.content
  const obj = extractJsonObject(typeof text === 'string' ? text : JSON.stringify(text))
  if (!obj) {
    return {
      verified: false,
      confidence: 0,
      verdict: { pass: false, notes: 'Model response was not valid JSON.' }
    }
  }

  const confidence = Number(obj.confidence || 0)
  const verified = Boolean(obj.pass === true)
  return { verified, confidence, verdict: obj }
}

// Points mapping (configurable)
const POINTS_MAP = {
  bottle: 50, // water bottle
  can: 20,
  food: 25, // food waste
  other: 15
}

// POST /api/upload
// Accepts: form-data { image: file, itemType: string, email: string }
// Verifies via fakeVerify, prevents duplicates (by imageHash), and awards points only if verified.
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const { itemType, email } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    // Load file buffer to compute hash
    const buffer = fs.readFileSync(req.file.path);
    const imageHash = sha256(buffer);

    // Duplicate prevention: check if same hash exists recently (e.g., ever)
      const existing = await DisposalEvent.findOne({ imageHash });
    if (existing) {
      // If duplicate, do not award credit and flag as not verified
      return res.status(409).json({
        error: 'Duplicate upload detected',
        duplicate: true,
        disposal: existing
      });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      // For demo convenience, create a user automatically
      user = await User.create({ name: email.split('@')[0], email, diningCredits: 0 })
    }

  // Fake AI verification. Pass filename so the heuristic can match it.
  const { verified, confidence, note } = fakeVerify({ itemType, imageBuffer: buffer, filename: req.file.originalname });

    // Save disposal event
    const imageUrl = `/uploads/${path.basename(req.file.path)}`;
    const event = new DisposalEvent({
      userId: user._id,
      itemType,
      imageUrl,
      imageHash,
      verified
    });
    await event.save();

    // Determine points for this item type
    const pointsForType = POINTS_MAP[itemType] || POINTS_MAP.other
    const pointsAwarded = verified ? pointsForType : 0

    // Save pointsAwarded on the event
    event.pointsAwarded = pointsAwarded
    await event.save()

    // Only award points if verified
    if (verified) {
      user.points = (user.points || 0) + pointsAwarded
      await user.save()
      // Optional: log to Solana (placeholder)
      // logToSolana(event).catch(console.error);
    }

    return res.json({
      success: true,
      verified,
      confidence,
      note,
      pointsAwarded,
      newPoints: user.points,
      disposal: event
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// POST /api/redeem
// Body: { email: string, dollars: number }
// Redeems dollars by subtracting points (100 points per $1).
app.post('/api/redeem', async (req, res) => {
  try {
    const { email, dollars } = req.body
    if (!email || !dollars) return res.status(400).json({ error: 'Missing email or dollars' })
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const requiredPoints = Math.floor(dollars) * 100
    if ((user.points || 0) < requiredPoints) return res.status(400).json({ error: 'Not enough points' })

    user.points = (user.points || 0) - requiredPoints
    await user.save()
    return res.json({ success: true, newPoints: user.points })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// --- New recycle flow endpoints (barcode -> barcode -> video) ---

app.post('/api/recycle/session/start', recycleRateLimit, async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Missing email' })

    // Ensure user exists
    let user = await User.findOne({ email })
    if (!user) user = await User.create({ name: email.split('@')[0], email, points: 0 })

    const sessionId = newSessionId()
    recycleSessions.set(sessionId, {
      sessionId,
      email,
      userId: user._id,
      step: 'product',
      createdAt: Date.now(),
      productBarcode: null,
      binBarcode: null
    })

    return res.json({
      sessionId,
      step: 'product',
      expiresInMs: SESSION_TTL_MS
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

app.post('/api/recycle/session/:sessionId/product', recycleRateLimit, async (req, res) => {
  try {
    const { sessionId } = req.params
    const { barcode } = req.body || {}
    if (!barcode) return res.status(400).json({ error: 'Missing barcode' })

    const s = getSessionOrThrow(sessionId)
    if (s.step !== 'product') return res.status(409).json({ error: `Invalid step. Expected product, got ${s.step}` })

    // Anti-cheat: per-user-per-product cooldown window
    const recentSame = await RecycleEvent.find({ userId: s.userId, productBarcode: barcode })
      .sort({ timestamp: -1 })
      .limit(1)
      .lean()
    if (recentSame && recentSame[0] && Date.now() - new Date(recentSame[0].timestamp).getTime() < USER_PRODUCT_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Cooldown: product already scanned recently for this user' })
    }

    s.productBarcode = String(barcode)
    s.step = 'bin'
    return res.json({ ok: true, step: 'bin', productBarcode: s.productBarcode })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({ error: err.message })
  }
})

app.post('/api/recycle/session/:sessionId/bin', recycleRateLimit, async (req, res) => {
  try {
    const { sessionId } = req.params
    const { barcode } = req.body || {}
    if (!barcode) return res.status(400).json({ error: 'Missing barcode' })

    const s = getSessionOrThrow(sessionId)
    if (s.step !== 'bin') return res.status(409).json({ error: `Invalid step. Expected bin, got ${s.step}` })

    s.binBarcode = String(barcode)
    s.step = 'video'
    return res.json({ ok: true, step: 'video', binBarcode: s.binBarcode })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({ error: err.message })
  }
})

const videoUpload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_VIDEO_BYTES || 12 * 1024 * 1024),
    fieldSize: Number(process.env.MAX_FIELD_BYTES || 6 * 1024 * 1024)
  }
})

app.post('/api/recycle/session/:sessionId/video', recycleRateLimit, videoUpload.single('video'), async (req, res) => {
  try {
    const { sessionId } = req.params
    const s = getSessionOrThrow(sessionId)
    if (s.step !== 'video') return res.status(409).json({ error: `Invalid step. Expected video, got ${s.step}` })
    if (!req.file) return res.status(400).json({ error: 'Missing video file' })

    // Cooldowns (user + bin) enforced on server
    const lastUser = await RecycleEvent.findOne({ userId: s.userId, verified: true }).sort({ timestamp: -1 })
    if (lastUser && Date.now() - new Date(lastUser.timestamp).getTime() < USER_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Cooldown: user is cooling down' })
    }
    const lastBin = await RecycleEvent.findOne({ binBarcode: s.binBarcode, verified: true }).sort({ timestamp: -1 })
    if (lastBin && Date.now() - new Date(lastBin.timestamp).getTime() < BIN_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Cooldown: bin is cooling down' })
    }

    // Duplicate video prevention
    const buffer = fs.readFileSync(req.file.path)
    const videoHash = sha256(buffer)
    const dup = await RecycleEvent.findOne({ videoHash })
    if (dup) {
      return res.status(409).json({ error: 'Duplicate video detected', duplicate: true })
    }

    const frames = parseDataUrlImages(req.body.frames)
    const { verified, confidence, verdict } = await verifyFramesWithOpenRouter({ frames })

    // Store (local) URL by default; optionally upload to S3-compatible object storage (Cloudflare R2, Supabase, etc.)
    let videoUrl = `/uploads/${path.basename(req.file.path)}`
    if (s3IsConfigured()) {
      const keyPrefix = (process.env.S3_KEY_PREFIX || 'clearcycle').replace(/^\/+|\/+$/g, '')
      const key = `${keyPrefix}/videos/${path.basename(req.file.path)}`
      const uploaded = await uploadFileToS3IfConfigured({ filePath: req.file.path, contentType: req.file.mimetype, key })
      if (uploaded) {
        videoUrl = uploaded
        try { fs.unlinkSync(req.file.path) } catch {}
      }
    }

    const pointsAwarded = verified ? RECYCLE_POINTS : 0
    const event = await RecycleEvent.create({
      userId: s.userId,
      productBarcode: s.productBarcode,
      binBarcode: s.binBarcode,
      videoUrl,
      videoHash,
      verified,
      aiConfidence: confidence,
      aiVerdict: verdict,
      pointsAwarded
    })

    if (verified) {
      const user = await User.findOne({ _id: s.userId })
      if (user) {
        user.points = (user.points || 0) + pointsAwarded
        await user.save()
      }
    }

    // End session after upload attempt (pass or fail)
    recycleSessions.delete(sessionId)

    return res.json({
      ok: true,
      verified,
      confidence,
      pointsAwarded,
      verdict,
      videoUrl,
      recycleEvent: event
    })
  } catch (err) {
    console.error(err)
    const status = err.status || 500
    return res.status(status).json({ error: err.message })
  }
})

// GET user info
app.get('/api/user/:email', async (req, res) => {
  const { email } = req.params
  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user })
})

// GET history for user
app.get('/api/history/:email', async (req, res) => {
  const { email } = req.params
  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ error: 'User not found' })
  const events = await DisposalEvent.find({ userId: user._id }).sort({ timestamp: -1 }).lean()
  res.json({ events })
})

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Placeholder for Solana logging (optional)
async function logToSolana(disposalEvent) {
  // For hackathon demo this is a no-op. To implement:
  // - Use @solana/web3.js to create a transaction with a small memo or store
  //   disposal event hash on-chain. Be mindful of fees and testnet vs mainnet.
  // - Or use an off-chain anchored log (e.g., Arweave or IPFS + signature stored on Solana).
}

// Helper: compute product confidence based on available data
function computeConfidence(name, image) {
  if (!name || name === 'Unknown' || name.length < 3) return 'low'
  if (image) return 'high'
  return 'medium'
}

// Helper: call a general barcode API (placeholder for UPC database)
async function lookupGeneralBarcode(barcode) {
  const apiKey = process.env.BARCODE_API_KEY
  if (!apiKey) return null

  try {
    // Placeholder: swap provider endpoint as needed (e.g., barcodelookup.com, upcitemdb.com, etc.)
    // For now, return null to signal "not implemented"
    return null
  } catch (err) {
    console.error('General barcode API error:', err)
    return null
  }
}

// GET /api/product?barcode=...
// Cascade: local DB → OpenFoodFacts → general API → not found
app.get('/api/product', async (req, res) => {
  const { barcode } = req.query
  if (!barcode || typeof barcode !== 'string') {
    return res.status(400).json({ error: 'Missing barcode' })
  }

  try {
    // 1. Check local database first
    let product = await Product.findOne({ barcode })
    if (product) {
      return res.json({
        found: true,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand || '',
        category: product.category || '',
        quantity: product.quantity || '',
        image: product.image || null,
        source: product.source,
        confidence: product.confidence,
        needsVerification: !product.lastVerified && product.source !== 'manual'
      })
    }

    // 2. Try OpenFoodFacts
    let offfProduct = null
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
      const response = await fetch(url, { timeout: 5000 })
      if (response.ok) {
        const data = await response.json()
        if (data.product) {
          offfProduct = data.product
        }
      }
    } catch (err) {
      console.error('OpenFoodFacts lookup error:', err)
    }

    if (offfProduct) {
      const name = offfProduct.product_name || 'Unknown'
      const brand = offfProduct.brands || ''
      const category = offfProduct.categories || ''
      const quantity = offfProduct.quantity || null
      const image = offfProduct.image_url || null
      const confidence = computeConfidence(name, image)

      // Save to local DB
      try {
        await Product.create({
          barcode,
          name,
          brand,
          category,
          quantity,
          image,
          source: 'openfoodfacts',
          confidence,
          lastVerified: false
        })
      } catch (err) {
        console.error('Error saving product to DB:', err)
      }

      return res.json({
        found: true,
        barcode,
        name,
        brand,
        category,
        quantity,
        image,
        source: 'openfoodfacts',
        confidence,
        needsVerification: confidence === 'low' || confidence === 'medium'
      })
    }

    // 3. Try general barcode API
    const generalProduct = await lookupGeneralBarcode(barcode)
    if (generalProduct) {
      const name = generalProduct.name || 'Unknown'
      const brand = generalProduct.brand || ''
      const category = generalProduct.category || ''
      const image = generalProduct.image || null
      const confidence = computeConfidence(name, image)

      // Save to local DB
      try {
        await Product.create({
          barcode,
          name,
          brand,
          category,
          image,
          source: 'barcode_api',
          confidence,
          lastVerified: false
        })
      } catch (err) {
        console.error('Error saving product to DB:', err)
      }

      return res.json({
        found: true,
        barcode,
        name,
        brand,
        category,
        image,
        source: 'barcode_api',
        confidence,
        needsVerification: true
      })
    }

    // 4. Not found — return not found and let frontend show manual add form
    return res.json({
      found: false,
      barcode,
      needsVerification: true
    })
  } catch (err) {
    console.error('Product lookup error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// POST /api/product
// Manual product entry or verification confirmation
app.post('/api/product', async (req, res) => {
  try {
    const { barcode, name, brand, category, quantity, image, lastVerified } = req.body

    if (!barcode || !name) {
      return res.status(400).json({ error: 'Missing barcode or name' })
    }

    // Upsert into DB
    const existingProduct = await Product.findOne({ barcode })
    if (existingProduct) {
      // Update existing
      existingProduct.name = name
      existingProduct.brand = brand || existingProduct.brand
      existingProduct.category = category || existingProduct.category
      existingProduct.quantity = quantity || existingProduct.quantity
      existingProduct.image = image || existingProduct.image
      existingProduct.source = 'manual'
      existingProduct.confidence = 'high'
      existingProduct.lastVerified = lastVerified !== false
      existingProduct.updatedAt = new Date()
      await existingProduct.save()
      return res.json({ saved: true, product: existingProduct })
    } else {
      // Create new
      const newProduct = await Product.create({
        barcode,
        name,
        brand: brand || null,
        category: category || null,
        quantity: quantity || null,
        image: image || null,
        source: 'manual',
        confidence: 'high',
        lastVerified: lastVerified !== false
      })
      return res.json({ saved: true, product: newProduct })
    }
  } catch (err) {
    console.error('Product save error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// Start server after seeding demo user
ensureDemoUser().then(() => {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
})

// Anti-fraud notes (code comments):
// - We compute a SHA256 imageHash and reject duplicate uploads with the same hash.
// - For stronger anti-fraud: require geofencing (collect GPS from the client and
//   verify distance to campus bins), require scanning a QR code printed on bins,
//   or require a short video showing the item and disposal action.
