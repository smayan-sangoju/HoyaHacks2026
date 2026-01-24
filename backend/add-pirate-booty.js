// Quick script to add Pirate Booty product to database
require('dotenv').config();
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  barcode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  brand: { type: String, default: null },
  category: { type: String, default: null },
  image: { type: String, default: null },
  quantity: { type: String, default: null },
  source: { type: String, enum: ['local', 'openfoodfacts', 'barcode_api', 'manual'], required: true },
  confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
  lastVerified: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', ProductSchema);

async function addPirateBooty() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/clearcycle'
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')
    
    const barcode = '015665624058'
    const productData = {
      barcode,
      name: "Pirate's Booty Aged White Cheddar Rice & Corn Puffs",
      brand: "Pirate's Booty",
      category: "Snacks, Salty snacks, Appetizers, Chips and fries, Crisps, Corn chips",
      image: null,
      source: 'manual',
      confidence: 'high',
      lastVerified: true
    }
    
    // Check if exists
    const existing = await Product.findOne({ barcode })
    if (existing) {
      console.log('Product already exists, updating...')
      await Product.updateOne({ barcode }, productData)
      console.log('Product updated!')
    } else {
      await Product.create(productData)
      console.log('Product created!')
    }
    
    console.log('Pirate Booty product added/updated:', productData)
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

addPirateBooty()
