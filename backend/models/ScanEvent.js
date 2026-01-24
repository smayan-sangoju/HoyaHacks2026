const mongoose = require('mongoose');

const ScanEventSchema = new mongoose.Schema({
  trashCanId: { type: String, required: true, index: true },
  scannedAt: { type: Date, default: Date.now },
  userId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null }
});

module.exports = mongoose.model('ScanEvent', ScanEventSchema);
