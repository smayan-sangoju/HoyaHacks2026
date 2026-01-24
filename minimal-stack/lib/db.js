import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || ''

export async function connectDB() {
  if (!MONGODB_URI) return null
  if (mongoose.connection.readyState === 1) return mongoose
  await mongoose.connect(MONGODB_URI, { dbName: 'clearcycle' })
  return mongoose
}

// simple models (define only if mongoose is connected)
export function getModels() {
  if (!mongoose.connection.readyState) return {}
  const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ email: String, points: Number }))
  const Event = mongoose.models.Event || mongoose.model('Event', new mongoose.Schema({
    productBarcode: String,
    binBarcode: String,
    videoUrl: String,
    verified: Boolean,
    points: Number,
    createdAt: Date
  }))
  return { User, Event }
}
