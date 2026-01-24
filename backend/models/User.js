const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // Points are the primary currency: every 100 points == $1 dining credit
  points: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', UserSchema);

// User model: stores name, email, and points earned from verified disposals.
// The frontend converts points to dining dollars: Math.floor(points / 100).
