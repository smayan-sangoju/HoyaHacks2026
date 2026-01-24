const mongoose = require('mongoose')

const RecycleEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  productBarcode: { type: String, required: true },
  binBarcode: { type: String, required: true },

  videoUrl: { type: String, required: true },
  videoHash: { type: String, required: true },

  verified: { type: Boolean, default: false },
  aiConfidence: { type: Number, default: 0 },
  aiVerdict: { type: Object, default: null },

  pointsAwarded: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
})

// Anti-cheat: prevent re-uploading the exact same video blob
RecycleEventSchema.index({ videoHash: 1 }, { unique: true })

// Anti-cheat (hackathon-safe): prevent a user from re-scanning the same product barcode repeatedly
RecycleEventSchema.index({ userId: 1, productBarcode: 1, timestamp: -1 })

RecycleEventSchema.index({ binBarcode: 1, timestamp: -1 })

module.exports = mongoose.model('RecycleEvent', RecycleEventSchema)

