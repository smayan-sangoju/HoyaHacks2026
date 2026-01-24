const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  barcode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  brand: { type: String, default: null },
  category: { type: String, default: null },
  image: { type: String, default: null },
  quantity: { type: String, default: null },
  // Source: "local" | "openfoodfacts" | "barcode_api" | "manual"
  source: { type: String, enum: ['local', 'openfoodfacts', 'barcode_api', 'manual'], required: true },
  // Confidence: "high" | "medium" | "low"
  confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
  // Whether this product was manually verified by a user
  lastVerified: { type: Boolean, default: false },
  // When this record was last updated
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
