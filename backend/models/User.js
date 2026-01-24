const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  // Points are the primary currency: every 100 points == $1 dining credit
  points: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);

// User model: stores name, email, password, role, and points earned from verified disposals.
// Roles: 'student' (default) or 'admin' (can manage trash cans)
// The frontend converts points to dining dollars: Math.floor(points / 100).
