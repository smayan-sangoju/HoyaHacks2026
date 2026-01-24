const mongoose = require('mongoose');

const TrashCanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  label: { type: String, default: null },
  location: { type: String, default: null },
  image: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TrashCan', TrashCanSchema);
