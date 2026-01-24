const mongoose = require('mongoose');

const DisposalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: { type: String, required: true },
  imageUrl: { type: String, required: true },
  imageHash: { type: String, required: true },
  verified: { type: Boolean, default: false },
  // pointsAwarded records how many points this disposal earned (0 if unverified)
  pointsAwarded: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DisposalEvent', DisposalSchema);

// DisposalEvent model: records each upload with a reference to the user,
// the item type claimed, image URL (path), the imageHash used for duplicate
// detection, whether the fake AI verified the disposal, and a timestamp.
