// Simple in-memory mock models to run the backend without MongoDB.
// This mimics the small subset of Mongoose APIs used by server.js.

let _userId = 1
let _eventId = 1
const users = []
const events = []
const recycleEvents = []

function toObjectId(n) {
  // return a string id similar to Mongo ObjectId
  return `m_${n}`
}

class User {
  constructor({ name, email, points = 0 }) {
    this._id = toObjectId(_userId++)
    this.name = name
    this.email = email
    this.points = points
  }

  async save() {
    const idx = users.findIndex((u) => u._id === this._id || u.email === this.email)
    if (idx >= 0) {
      users[idx] = this
    } else {
      users.push(this)
    }
    return this
  }

  static async findOne(query) {
    if (query.email) return users.find((u) => u.email === query.email) || null
    if (query._id) return users.find((u) => u._id === query._id) || null
    return null
  }

  static async create(obj) {
    const u = new User(obj)
    await u.save()
    return u
  }
}

class DisposalEvent {
  constructor({ userId, itemType, imageUrl, imageHash, verified = false, pointsAwarded = 0, timestamp = Date.now() }) {
    this._id = toObjectId(_eventId++)
    this.userId = userId
    this.itemType = itemType
    this.imageUrl = imageUrl
    this.imageHash = imageHash
    this.verified = verified
    this.pointsAwarded = pointsAwarded
    this.timestamp = new Date(timestamp)
  }

  async save() {
    const idx = events.findIndex((e) => e._id === this._id)
    if (idx >= 0) events[idx] = this
    else events.push(this)
    return this
  }

  static async findOne(query) {
    if (query.imageHash) return events.find((e) => e.imageHash === query.imageHash) || null
    return null
  }

  // mimic Mongoose chain: find(...).sort(...).lean()
  static find(query) {
    const filtered = events.filter((e) => {
      if (query.userId) return String(e.userId) === String(query.userId)
      return true
    })

    return {
      sort: (sortSpec) => ({
        lean: async () => {
          // Only support sorting by timestamp desc/asc
          const copy = filtered.slice()
          if (sortSpec && sortSpec.timestamp === -1) copy.sort((a, b) => b.timestamp - a.timestamp)
          if (sortSpec && sortSpec.timestamp === 1) copy.sort((a, b) => a.timestamp - b.timestamp)
          return copy
        }
      })
    }
  }
}

class RecycleEvent {
  constructor({
    userId,
    productBarcode,
    binBarcode,
    videoUrl,
    videoHash,
    verified = false,
    aiConfidence = 0,
    aiVerdict = null,
    pointsAwarded = 0,
    timestamp = Date.now()
  }) {
    this._id = toObjectId(_eventId++)
    this.userId = userId
    this.productBarcode = productBarcode
    this.binBarcode = binBarcode
    this.videoUrl = videoUrl
    this.videoHash = videoHash
    this.verified = verified
    this.aiConfidence = aiConfidence
    this.aiVerdict = aiVerdict
    this.pointsAwarded = pointsAwarded
    this.timestamp = new Date(timestamp)
  }

  async save() {
    const idx = recycleEvents.findIndex((e) => e._id === this._id)
    if (idx >= 0) recycleEvents[idx] = this
    else recycleEvents.push(this)
    return this
  }

  static async create(obj) {
    const e = new RecycleEvent(obj)
    await e.save()
    return e
  }

  static async findOne(query) {
    // minimal subset used by server.js
    if (query.videoHash) return recycleEvents.find((e) => e.videoHash === query.videoHash) || null

    // last verified for user/bin lookups
    if (query.userId && query.verified === true && query.binBarcode == null) {
      const matches = recycleEvents
        .filter((e) => String(e.userId) === String(query.userId) && e.verified === true)
        .sort((a, b) => b.timestamp - a.timestamp)
      return matches[0] || null
    }

    if (query.binBarcode && query.verified === true) {
      const matches = recycleEvents
        .filter((e) => e.binBarcode === query.binBarcode && e.verified === true)
        .sort((a, b) => b.timestamp - a.timestamp)
      return matches[0] || null
    }

    return null
  }

  static find(query) {
    // mimic Mongoose chain: find(...).sort(...).limit(...).lean()
    const filtered = recycleEvents.filter((e) => {
      if (query.userId && String(e.userId) !== String(query.userId)) return false
      if (query.productBarcode && e.productBarcode !== query.productBarcode) return false
      if (query.binBarcode && e.binBarcode !== query.binBarcode) return false
      if (query.verified != null && e.verified !== query.verified) return false
      return true
    })

    return {
      sort: (sortSpec) => {
        const copy = filtered.slice()
        if (sortSpec && sortSpec.timestamp === -1) copy.sort((a, b) => b.timestamp - a.timestamp)
        if (sortSpec && sortSpec.timestamp === 1) copy.sort((a, b) => a.timestamp - b.timestamp)
        return {
          limit: (n) => ({
            lean: async () => copy.slice(0, n)
          }),
          lean: async () => copy
        }
      }
    }
  }
}

class Product {
  constructor({ barcode, name, brand, category, image, quantity, source, confidence, lastVerified = false, updatedAt = Date.now() }) {
    this._id = toObjectId(_eventId++)
    this.barcode = barcode
    this.name = name
    this.brand = brand || null
    this.category = category || null
    this.image = image || null
    this.quantity = quantity || null
    this.source = source
    this.confidence = confidence
    this.lastVerified = lastVerified
    this.updatedAt = new Date(updatedAt)
  }

  async save() {
    const idx = mockProducts.findIndex((p) => p.barcode === this.barcode)
    if (idx >= 0) mockProducts[idx] = this
    else mockProducts.push(this)
    return this
  }

  static async findOne(query) {
    if (query.barcode) return mockProducts.find((p) => p.barcode === query.barcode) || null
    return null
  }

  static async updateOne(query, update) {
    const idx = mockProducts.findIndex((p) => p.barcode === query.barcode)
    if (idx >= 0) {
      Object.assign(mockProducts[idx], update.$set || update)
      return { matchedCount: 1 }
    }
    return { matchedCount: 0 }
  }

  static async create(obj) {
    const p = new Product(obj)
    await p.save()
    return p
  }
}

const mockProducts = []
const mockTrashCans = []
let scanEventId = 1

class TrashCan {
  constructor({ id, label, location, createdAt = Date.now() }) {
    this._id = toObjectId(_eventId++)
    this.id = id
    this.label = label || null
    this.location = location || null
    this.createdAt = new Date(createdAt)
  }

  async save() {
    const idx = mockTrashCans.findIndex((c) => c.id === this.id)
    if (idx >= 0) mockTrashCans[idx] = this
    else mockTrashCans.push(this)
    return this
  }

  static async findOne(query) {
    if (query.id) return mockTrashCans.find((c) => c.id === query.id) || null
    return null
  }

  static async find() {
    return mockTrashCans.slice()
  }

  static async create(obj) {
    const c = new TrashCan(obj)
    await c.save()
    return c
  }
}

class ScanEvent {
  constructor({ trashCanId, scannedAt = Date.now(), userId = null, metadata = null }) {
    this._id = `scan_${scanEventId++}`
    this.trashCanId = trashCanId
    this.scannedAt = new Date(scannedAt)
    this.userId = userId
    this.metadata = metadata
  }

  async save() {
    // In-memory only, no persistence
    return this
  }

  static async findOne(query) {
    return null
  }

  static async find(query) {
    return {
      sort: (sortSpec) => ({
        limit: (n) => ({
          lean: async () => []
        })
      })
    }
  }

  static async create(obj) {
    const e = new ScanEvent(obj)
    await e.save()
    return e
  }
}

module.exports = { User, DisposalEvent, RecycleEvent, Product, TrashCan, ScanEvent }
