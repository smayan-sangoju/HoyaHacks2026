require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const USE_MOCK = process.env.USE_MOCK_DB === 'true'
const { fakeVerify } = require('./verify')

let User, DisposalEvent, RecycleEvent, Product, TrashCan, ScanEvent

const app = express()

// CORS configuration - allow all origins for development
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = process.env.PORT || 4000
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/clearcycle'
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production'

if (USE_MOCK) {
  // Use in-memory mock models when USE_MOCK_DB=true
  ;({ User, DisposalEvent, RecycleEvent, Product, TrashCan, ScanEvent } = require('./mockModels'))
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
  TrashCan = require('./models/TrashCan')
  ScanEvent = require('./models/ScanEvent')
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

// Seed trash cans from JSON database
async function ensureTrashCans() {
  try {
    const trashCanPath = path.join(__dirname, 'trash-cans', 'trash-cans.json')
    if (!fs.existsSync(trashCanPath)) {
      console.log('No trash-cans.json found, skipping seeding')
      return
    }

    const rawData = fs.readFileSync(trashCanPath, 'utf8')
    const trashCans = JSON.parse(rawData)

    for (const can of trashCans) {
      const existing = await TrashCan.findOne({ id: can.id })
      if (!existing) {
        await TrashCan.create(can)
        console.log(`Seeded trash can: ${can.id} - ${can.label}`)
      }
    }
  } catch (err) {
    console.error('Error seeding trash cans:', err.message)
  }
}

// Fix existing @admin.com users: set role to admin in DB
async function fixAdminRoles() {
  if (USE_MOCK) return
  try {
    const result = await User.updateMany(
      { email: /@admin\.com$/i, role: { $ne: 'admin' } },
      { $set: { role: 'admin' } }
    )
    if (result.modifiedCount > 0) {
      console.log(`Fixed ${result.modifiedCount} @admin.com user(s) to role: admin`)
    }
  } catch (err) {
    console.error('Error fixing admin roles:', err.message)
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

// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}

function authorizeAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
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
    console.error('OPENROUTER_API_KEY not set!')
    return {
      verified: false,
      confidence: 0,
      verdict: { pass: false, notes: 'OPENROUTER_API_KEY not set; verification disabled.' }
    }
  }

  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash'
  const siteUrl = process.env.OPENROUTER_SITE_URL || 'http://localhost'
  const title = process.env.OPENROUTER_APP_TITLE || 'ClearCycle'
  
  console.log(`Calling OpenRouter API with model: ${model}, frames: ${frames.length}`)

  const system = [
    'You are a recycling verification system for a hackathon demo.',
    'You will receive 2-3 camera frames from a short verification video.',
    'Return ONLY strict JSON (no markdown, no extra text).',
    'Required keys: bin_visible (boolean), bottle_visible (boolean), disposal_action (boolean), item_enters_bin (boolean), confidence (number 0..1), notes (string).',
    'item_enters_bin should be true if the item (bottle/container) actually goes INTO the trash can or breaks the plane of the bin opening. It should be false if the item is just held near the bin or thrown away from it.',
    'Also include pass (boolean) where pass=true only if all 4 booleans (bin_visible, bottle_visible, disposal_action, item_enters_bin) are true and confidence >= 0.65.'
  ].join('\n')

  const userContent = [
    {
      type: 'text',
      text: 'Analyze these video frames and verify: 1) A recycling bin/trash can is visible, 2) A bottle or container is visible, 3) A disposal action is happening (person throwing/disposing), and 4) The item actually enters the trash can or breaks the plane of the bin opening (not just held near it or thrown away). Return JSON with bin_visible, bottle_visible, disposal_action, item_enters_bin (all booleans), confidence (0-1), notes, and pass (true only if all checks pass with confidence >= 0.65).'
    },
    ...frames.map((url) => ({ type: 'image_url', image_url: { url } }))
  ]

  // Add timeout to OpenRouter API call
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
  
  let resp, data
  try {
    resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
      }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    
    data = await resp.json().catch(() => ({}))
    console.log('OpenRouter API response status:', resp.status)
    
    if (!resp.ok) {
      console.error('OpenRouter API error:', data?.error || resp.statusText)
      return {
        verified: false,
        confidence: 0,
        verdict: { pass: false, notes: `OpenRouter API error: ${data?.error?.message || data?.error?.type || resp.statusText || 'unknown error'}` }
      }
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      console.error('OpenRouter API timeout')
      return {
        verified: false,
        confidence: 0,
        verdict: { pass: false, notes: 'Verification timeout - API took too long to respond' }
      }
    }
    console.error('OpenRouter fetch error:', err.message)
    return {
      verified: false,
      confidence: 0,
      verdict: { pass: false, notes: 'OpenRouter API error: ' + err.message }
    }
  }

  const text = data?.choices?.[0]?.message?.content
  console.log('OpenRouter response text (first 200 chars):', text?.substring(0, 200))
  
  const obj = extractJsonObject(typeof text === 'string' ? text : JSON.stringify(text))
  if (!obj) {
    console.error('Failed to parse JSON from OpenRouter response. Raw text:', text)
    return {
      verified: false,
      confidence: 0,
      verdict: { pass: false, notes: 'Model response was not valid JSON. Response: ' + (text?.substring(0, 100) || 'empty') }
    }
  }

  console.log('Parsed verification object:', obj)
  
  const confidence = Number(obj.confidence || 0)
  // Check for item_enters_bin field (new requirement)
  const itemEntersBin = obj.item_enters_bin !== undefined ? Boolean(obj.item_enters_bin) : Boolean(obj.disposal_action)
  // Pass requires all checks: bin visible, bottle visible, disposal action, AND item enters bin
  const binVisible = Boolean(obj.bin_visible)
  const bottleVisible = Boolean(obj.bottle_visible)
  const disposalAction = Boolean(obj.disposal_action)
  const allChecksPass = binVisible && bottleVisible && disposalAction && itemEntersBin
  const verified = Boolean(obj.pass === true) && allChecksPass && confidence >= 0.65
  
  console.log('Verification checks:', {
    binVisible,
    bottleVisible,
    disposalAction,
    itemEntersBin,
    allChecksPass,
    confidence,
    passFromModel: obj.pass,
    finalVerified: verified
  })
  
  return { 
    verified, 
    confidence, 
    verdict: { 
      ...obj, 
      item_enters_bin: itemEntersBin,
      bin_visible: binVisible,
      bottle_visible: bottleVisible,
      disposal_action: disposalAction,
      pass: verified
    } 
  }
}

// Gemini API verification (alternative to OpenRouter)
async function verifyFramesWithGemini({ frames }) {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    // Fallback to OpenRouter if Gemini not configured
    return await verifyFramesWithOpenRouter({ frames })
  }

  try {
    // Convert data URLs to base64 strings (remove data:image/jpeg;base64, prefix)
    const base64Images = frames.map(url => {
      if (typeof url === 'string' && url.startsWith('data:')) {
        return url.split(',')[1]
      }
      return url
    })

    // Use Gemini 1.5 Pro or Flash for vision
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

    const parts = [
      {
        text: 'You are a recycling verification system. Analyze these video frames and return ONLY valid JSON (no markdown, no extra text). Required keys: bin_visible (boolean), bottle_visible (boolean), disposal_action (boolean), confidence (number 0..1), notes (string). Include pass (boolean) where pass=true only if all 3 booleans are true and confidence >= 0.65. Check if a recycling bin is visible, a bottle/container is visible, and the disposal action is happening (bottle entering bin).'
      },
      ...base64Images.map(img => ({
        inline_data: {
          mime_type: 'image/jpeg',
          data: img
        }
      }))
    ]

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    })

    const data = await resp.json()
    if (!resp.ok) {
      return {
        verified: false,
        confidence: 0,
        verdict: { pass: false, notes: `Gemini API error: ${data?.error?.message || resp.statusText || 'unknown'}` }
      }
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return {
        verified: false,
        confidence: 0,
        verdict: { pass: false, notes: 'No response from Gemini API' }
      }
    }

    const obj = extractJsonObject(text)
    if (!obj) {
      return {
        verified: false,
        confidence: 0,
        verdict: { pass: false, notes: 'Gemini response was not valid JSON.' }
      }
    }

    const confidence = Number(obj.confidence || 0)
    const verified = Boolean(obj.pass === true)
    return { verified, confidence, verdict: obj }
  } catch (err) {
    console.error('Gemini verification error:', err)
    // Fallback to OpenRouter on error
    return await verifyFramesWithOpenRouter({ frames })
  }
}

// Points mapping (configurable)
const POINTS_MAP = {
  bottle: 50, // water bottle
  can: 20,
  food: 25, // food waste
  other: 15
}

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), backend: 'running' })
})

app.get('/', (req, res) => {
  res.json({ message: 'ClearCycle Backend is running!', version: '1.0.0' })
})

// --- AUTHENTICATION ROUTES ---

// POST /api/auth/register
// Register a new student or admin account
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    console.log('Register request received:', { name, email, role })
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' })
    }

    // Check if user already exists
    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Determine role: Auto-detect admin if @admin.com email, otherwise use provided role or default to student
    let userRole = 'student'
    if (email.endsWith('@admin.com')) {
      userRole = 'admin'
      console.log('Email ends with @admin.com, setting role to admin')
    } else if (role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts require @admin.com email address' })
    }
    
    console.log('Final role for user:', userRole)

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    console.log('Creating user with role:', userRole)
    
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: userRole
    })

    // Force role update for admin (ensure DB has it)
    if (userRole === 'admin') {
      await User.findByIdAndUpdate(user._id, { role: 'admin' })
    }

    const refreshedUser = await User.findById(user._id)
    console.log('User created:', { id: refreshedUser._id, email: refreshedUser.email, role: refreshedUser.role })

    // Generate token
    const token = jwt.sign(
      { id: refreshedUser._id, email: refreshedUser.email, name: refreshedUser.name, role: refreshedUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    const responseUser = { id: refreshedUser._id, name: refreshedUser.name, email: refreshedUser.email, role: refreshedUser.role, points: refreshedUser.points }
    console.log('Sending response:', { success: true, user: responseUser })
    
    return res.json({
      success: true,
      user: responseUser,
      token
    })
  } catch (err) {
    console.error('Registration error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// POST /api/auth/login
// Login as student or admin
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, points: user.points },
      token
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// GET /api/auth/me
// Get current user info (requires authentication)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, points: user.points }
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

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

    // Allow scanning the same product multiple times (cooldown disabled)
    // Users can scan the same barcode multiple times since all items have the same barcode
    // No cooldown check - removed to allow multiple scans of the same product

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
    console.log(`Verifying video with ${frames.length} frames for session ${sessionId}`)
    
    if (!frames || frames.length === 0) {
      console.warn('No frames provided, using fallback verification')
      return res.json({
        ok: true,
        verified: false,
        confidence: 0,
        pointsAwarded: 0,
        verdict: { pass: false, notes: 'No video frames provided for verification' },
        videoUrl: `/uploads/${path.basename(req.file.path)}`,
        error: 'No frames extracted from video'
      })
    }
    
    // Use OpenRouter (which can use Gemini model) if configured, otherwise fallback to Gemini direct
    let verificationResult
    try {
      if (process.env.OPENROUTER_API_KEY) {
        console.log('Using OpenRouter with Gemini for verification')
        console.log(`API Key present: ${process.env.OPENROUTER_API_KEY.substring(0, 10)}...`)
        console.log(`Model: ${process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash'}`)
        verificationResult = await verifyFramesWithOpenRouter({ frames })
        console.log('OpenRouter verification complete:', {
          verified: verificationResult.verified,
          confidence: verificationResult.confidence,
          pass: verificationResult.verdict?.pass
        })
      } else if (process.env.GEMINI_API_KEY) {
        console.log('Using Gemini API directly for verification')
        verificationResult = await verifyFramesWithGemini({ frames })
      } else {
        console.warn('No API key configured, verification will fail')
        verificationResult = { verified: false, confidence: 0, verdict: { pass: false, notes: 'No API key configured - verification disabled' } }
      }
      console.log('Final verification result:', JSON.stringify(verificationResult, null, 2))
    } catch (err) {
      console.error('Verification error:', err)
      verificationResult = { verified: false, confidence: 0, verdict: { pass: false, notes: 'Verification service error: ' + err.message } }
    }
    
    const { verified, confidence, verdict } = verificationResult

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

    console.log(`Video verification complete for session ${sessionId}: verified=${verified}, points=${pointsAwarded}, confidence=${confidence}`)
    console.log('Verification details:', {
      bin_visible: verdict?.bin_visible,
      bottle_visible: verdict?.bottle_visible,
      disposal_action: verdict?.disposal_action,
      item_enters_bin: verdict?.item_enters_bin,
      pass: verdict?.pass,
      notes: verdict?.notes
    })

    // Always return a response - never hang
    return res.json({
      ok: true,
      verified: Boolean(verified),
      confidence: Number(confidence || 0),
      pointsAwarded: Number(pointsAwarded || 0),
      verdict: verdict || { 
        pass: Boolean(verified), 
        notes: verified ? 'Video verified successfully' : 'Verification failed - check requirements',
        bin_visible: false,
        bottle_visible: false,
        disposal_action: false,
        item_enters_bin: false
      },
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
app.get('/api/health', (req, res) => {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY
  const hasGemini = !!process.env.GEMINI_API_KEY
  res.json({ 
    ok: true, 
    verification: {
      openRouter: hasOpenRouter,
      gemini: hasGemini,
      model: process.env.OPENROUTER_MODEL || 'not set',
      configured: hasOpenRouter || hasGemini
    }
  })
})

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

// Helper function to check recyclability using AI
async function checkRecyclability(productName, brand, category) {
  try {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      console.log('No OpenRouter API key, skipping recyclability check')
      return { recyclable: null, message: 'API key not configured', confidence: 0 }
    }
    
    console.log('Starting recyclability check with OpenRouter API')

    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash'
    const siteUrl = process.env.OPENROUTER_SITE_URL || 'http://localhost'
    const title = process.env.OPENROUTER_APP_TITLE || 'ClearCycle'

    const prompt = `Analyze this product and determine if it's recyclable. Return ONLY valid JSON (no markdown, no extra text).

Product: ${productName || 'Unknown'}
Brand: ${brand || 'Unknown'}
Category: ${category || 'Unknown'}

Return JSON with these keys:
- recyclable (boolean): true if the product/item is commonly recyclable, false if not
- message (string): A short message (max 50 words) explaining why it is or isn't recyclable
- confidence (number 0-1): How confident you are in this assessment

Consider:
- Common recyclable items: plastic bottles (#1, #2), aluminum cans, glass bottles, cardboard, paper
- Non-recyclable items: plastic bags, styrofoam, certain plastics (#3, #6, #7), contaminated items
- If information is insufficient, set recyclable to null and message to "Unable to determine recyclability"`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

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
        temperature: 0.3,
        messages: [
          { role: 'user', content: prompt }
        ]
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!resp.ok) {
      console.error('Recyclability check API error:', resp.status)
      return { recyclable: null, message: null, confidence: 0 }
    }

    const data = await resp.json()
    const text = data?.choices?.[0]?.message?.content
    const obj = extractJsonObject(typeof text === 'string' ? text : JSON.stringify(text))

    if (!obj) {
      console.error('Failed to parse recyclability response')
      return { recyclable: null, message: null, confidence: 0 }
    }

    return {
      recyclable: obj.recyclable === true ? true : (obj.recyclable === false ? false : null),
      message: obj.message || null,
      confidence: Number(obj.confidence || 0)
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Recyclability check timeout')
    } else {
      console.error('Recyclability check error:', err.message)
    }
    return { recyclable: null, message: null, confidence: 0 }
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
      // Check recyclability - wait for it to complete before returning
      console.log(`Checking recyclability for product: ${product.name}, brand: ${product.brand}, category: ${product.category}`)
      const recyclabilityPromise = checkRecyclability(product.name, product.brand, product.category)
      
      // Return product info with recyclability
      const productData = {
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
      }
      
      // Wait for recyclability check (with timeout)
      try {
        const recyclability = await Promise.race([
          recyclabilityPromise,
          new Promise((resolve) => {
            setTimeout(() => {
              console.log('Recyclability check timeout after 8 seconds')
              resolve({ recyclable: null, message: null, confidence: 0 })
            }, 8000)
          })
        ])
        console.log('Recyclability result:', recyclability)
        productData.recyclable = recyclability.recyclable
        productData.recyclabilityMessage = recyclability.message
        productData.recyclabilityConfidence = recyclability.confidence
      } catch (err) {
        console.error('Recyclability check error:', err)
        productData.recyclable = null
        productData.recyclabilityMessage = null
        productData.recyclabilityConfidence = 0
      }
      
      console.log('Returning product data with recyclability:', {
        name: productData.name,
        recyclable: productData.recyclable,
        message: productData.recyclabilityMessage
      })
      return res.json(productData)
    }

    // 2. Try OpenFoodFacts
    let offfProduct = null
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
      // Use AbortController for timeout (Node.js fetch doesn't support timeout option)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'ClearCycle/1.0 (https://clearcycle.app)'
        }
      })
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        // Check if product exists (status 1 means found, 0 means not found)
        if (data.status === 1 && data.product) {
          offfProduct = data.product
          console.log(`OpenFoodFacts found product for barcode ${barcode}`)
        } else {
          console.log(`OpenFoodFacts: Product not found for barcode ${barcode} (status: ${data.status})`)
        }
      } else {
        console.log(`OpenFoodFacts API error: ${response.status} for barcode ${barcode}`)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error(`OpenFoodFacts lookup timeout for barcode ${barcode}`)
      } else {
        console.error('OpenFoodFacts lookup error:', err.message)
      }
    }

    if (offfProduct) {
      // Try multiple field names for product name (OpenFoodFacts has variations)
      // Check product_name first, then language-specific versions
      let name = offfProduct.product_name || 
                 offfProduct.product_name_en || 
                 offfProduct.product_name_fr || 
                 offfProduct.abbreviated_product_name ||
                 offfProduct.generic_name ||
                 offfProduct.name ||
                 offfProduct.product_name_fr_imported ||
                 ''
      
      // If name is empty or just whitespace, try other fields
      if (!name || !name.trim()) {
        name = offfProduct.product_name_en || 
               offfProduct.product_name_fr || 
               offfProduct.abbreviated_product_name ||
               offfProduct.generic_name ||
               ''
      }
      
      // Clean up the name - remove extra whitespace and newlines
      const cleanName = (name || '').trim().replace(/\s+/g, ' ') || 'Unknown'
      
      // Try multiple field names for brand
      const brand = (offfProduct.brands || 
                    offfProduct.brand || 
                    offfProduct.brands_tags?.[0] || 
                    '').trim()
      
      // Try multiple field names for category
      let category = offfProduct.categories || 
                     (offfProduct.categories_tags?.join(', ') || '') ||
                     offfProduct.category || 
                     ''
      // Clean up category - take first few if comma-separated
      if (category.includes(',')) {
        category = category.split(',').slice(0, 3).join(', ').trim()
      }
      
      const quantity = offfProduct.quantity || null
      
      // Try multiple image URLs
      const image = offfProduct.image_url || 
                    offfProduct.image_front_url || 
                    offfProduct.image_small_url ||
                    (offfProduct.images?.front?.display?.url || null) ||
                    null
      
      const confidence = computeConfidence(cleanName, image)
      
      console.log(`Product extracted: name="${cleanName}", brand="${brand}", category="${category}"`)

      // Save to local DB
      try {
        await Product.create({
          barcode,
          name: cleanName,
          brand: brand || null,
          category: category || null,
          quantity,
          image,
          source: 'openfoodfacts',
          confidence,
          lastVerified: false
        })
      } catch (err) {
        console.error('Error saving product to DB:', err)
      }

      // Check recyclability
      const recyclabilityPromise = checkRecyclability(cleanName, brand, category)
      
      // Make sure we have a valid name before returning
      if (!cleanName || cleanName === 'Unknown' || cleanName.trim() === '') {
        console.warn(`Warning: Product name is empty for barcode ${barcode}, using brand or fallback`)
        // Try to use brand as name if name is missing
        const fallbackName = (brand && brand.trim()) ? brand.trim() : `Product (Barcode: ${barcode})`
        const productData = {
          found: true,
          barcode,
          name: fallbackName,
          brand: brand || null,
          category: category || null,
          quantity,
          image,
          source: 'openfoodfacts',
          confidence,
          needsVerification: confidence === 'low' || confidence === 'medium'
        }
        
        // Add recyclability
        try {
          const recyclability = await Promise.race([
            recyclabilityPromise,
            new Promise((resolve) => setTimeout(() => resolve({ recyclable: null, message: null, confidence: 0 }), 8000))
          ])
          productData.recyclable = recyclability.recyclable
          productData.recyclabilityMessage = recyclability.message
          productData.recyclabilityConfidence = recyclability.confidence
        } catch (err) {
          console.error('Recyclability check error:', err)
        }
        
        return res.json(productData)
      }
      
      const productData = {
        found: true,
        barcode,
        name: cleanName,
        brand: brand || null,
        category: category || null,
        quantity,
        image,
        source: 'openfoodfacts',
        confidence,
        needsVerification: confidence === 'low' || confidence === 'medium'
      }
      
      // Add recyclability
      try {
        const recyclability = await Promise.race([
          recyclabilityPromise,
          new Promise((resolve) => setTimeout(() => resolve({ recyclable: null, message: null, confidence: 0 }), 8000))
        ])
        productData.recyclable = recyclability.recyclable
        productData.recyclabilityMessage = recyclability.message
        productData.recyclabilityConfidence = recyclability.confidence
      } catch (err) {
        console.error('Recyclability check error:', err)
      }
      
      return res.json(productData)
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

      // Check recyclability
      const recyclabilityPromise = checkRecyclability(name, brand, category)
      const productData = {
        found: true,
        barcode,
        name,
        brand,
        category,
        image,
        source: 'barcode_api',
        confidence,
        needsVerification: true
      }
      
      // Add recyclability
      try {
        const recyclability = await Promise.race([
          recyclabilityPromise,
          new Promise((resolve) => setTimeout(() => resolve({ recyclable: null, message: null, confidence: 0 }), 8000))
        ])
        productData.recyclable = recyclability.recyclable
        productData.recyclabilityMessage = recyclability.message
        productData.recyclabilityConfidence = recyclability.confidence
      } catch (err) {
        console.error('Recyclability check error:', err)
      }
      
      return res.json(productData)
    }

    // 4. Not found — return not found
    console.log(`Product not found in any source for barcode ${barcode}`)
    return res.json({
      found: false,
      barcode,
      name: null,
      brand: null,
      category: null,
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

// --- QR Code Routes ---

// GET /api/qr?canId=TC001
// Generate QR code PNG for a trash can
app.get('/api/qr', async (req, res) => {
  try {
    const { canId } = req.query
    if (!canId || typeof canId !== 'string') {
      return res.status(400).json({ error: 'Missing canId' })
    }

    // Verify can exists (optional, demo mode allows any canId)
    const can = await TrashCan.findOne({ id: canId }).catch(() => null)
    if (!can && process.env.DEMO_MODE !== 'true') {
      return res.status(404).json({ error: 'Trash can not found' })
    }

    // Generate QR code
    const qrcode = require('qrcode')
    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000'
    const qrUrl = `${baseUrl}/can/${encodeURIComponent(canId)}`
    
    const pngBuffer = await qrcode.toBuffer(qrUrl, { width: 300 })
    
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(pngBuffer)
  } catch (err) {
    console.error('QR generation error:', err)
    return res.status(500).json({ error: 'QR generation failed', details: err.message })
  }
})

// GET /api/trash-cans
// List all trash cans
app.get('/api/trash-cans', async (req, res) => {
  try {
    let cans = await TrashCan.find().sort({ createdAt: -1 }).catch(() => [])
    
    // Fallback to JSON file if MongoDB is empty or unavailable
    if (!cans || cans.length === 0) {
      try {
        const trashCanPath = path.join(__dirname, 'trash-cans', 'trash-cans.json')
        if (fs.existsSync(trashCanPath)) {
          const rawData = fs.readFileSync(trashCanPath, 'utf8')
          cans = JSON.parse(rawData)
        }
      } catch (e) {
        console.error('Error reading JSON fallback:', e)
      }
    }
    
    return res.json({ cans: cans || [] })
  } catch (err) {
    console.error('Error fetching trash cans:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// GET /api/trash-cans/:canId
// Get a specific trash can
app.get('/api/trash-cans/:canId', async (req, res) => {
  try {
    const { canId } = req.params
    
    // Try MongoDB first
    let can = await TrashCan.findOne({ id: canId }).catch(() => null)
    
    // Fallback to JSON file if not in MongoDB
    if (!can) {
      try {
        const trashCanPath = path.join(__dirname, 'trash-cans', 'trash-cans.json')
        if (fs.existsSync(trashCanPath)) {
          const rawData = fs.readFileSync(trashCanPath, 'utf8')
          const trashCans = JSON.parse(rawData)
          const jsonCan = trashCans.find(c => c.id === canId)
          if (jsonCan) {
            // Return JSON data formatted like MongoDB would
            return res.json({ can: jsonCan })
          }
        }
      } catch (e) {
        console.error('Error reading JSON fallback:', e)
      }
    }
    
    if (!can) {
      return res.status(404).json({ error: 'Trash can not found' })
    }
    
    return res.json({ can })
  } catch (err) {
    console.error('Error fetching trash can:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// POST /api/trash-cans
// Create a new trash can (requires admin authentication)
app.post('/api/trash-cans', authenticateToken, authorizeAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id, label, location } = req.body
    if (!id) {
      return res.status(400).json({ error: 'Missing can id' })
    }

    // Check if already exists
    const existing = await TrashCan.findOne({ id })
    if (existing) {
      return res.status(409).json({ error: 'Trash can id already exists' })
    }

    // Handle image if uploaded
    let imageUrl = null
    if (req.file) {
      imageUrl = `/uploads/${path.basename(req.file.path)}`
    }

    const can = await TrashCan.create({ id, label, location, image: imageUrl })
    return res.json({ saved: true, can })
  } catch (err) {
    console.error('Error creating trash can:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// POST /api/scan-event
// Log a scan event when user scans a trash can QR code
app.post('/api/scan-event', async (req, res) => {
  try {
    const { trashCanId, userId, metadata } = req.body
    if (!trashCanId) {
      return res.status(400).json({ error: 'Missing trashCanId' })
    }

    // Verify can exists
    const can = await TrashCan.findOne({ id: trashCanId }).catch(() => null)
    if (!can && process.env.DEMO_MODE !== 'true') {
      return res.status(404).json({ error: 'Trash can not found' })
    }

    const event = await ScanEvent.create({ trashCanId, userId, metadata })
    return res.json({ logged: true, event })
  } catch (err) {
    console.error('Error logging scan event:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// GET /api/scan-events?canId=TC001
// Get all scan events for a specific can
app.get('/api/scan-events', async (req, res) => {
  try {
    const { canId } = req.query
    if (!canId) {
      return res.status(400).json({ error: 'Missing canId' })
    }

    const events = await ScanEvent.find({ trashCanId: canId }).sort({ scannedAt: -1 }).limit(100)
    return res.json({ events })
  } catch (err) {
    console.error('Error fetching scan events:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// Start server after seeding demo user and trash cans
Promise.all([ensureDemoUser(), ensureTrashCans(), fixAdminRoles()]).then(() => {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
}).catch(err => {
  console.error('Startup error:', err)
})

// Anti-fraud notes (code comments):
// - We compute a SHA256 imageHash and reject duplicate uploads with the same hash.
// - For stronger anti-fraud: require geofencing (collect GPS from the client and
//   verify distance to campus bins), require scanning a QR code printed on bins,
//   or require a short video showing the item and disposal action.
