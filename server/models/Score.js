const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  playerName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 10
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// Index for sorting by score descending
scoreSchema.index({ score: -1 });

module.exports = mongoose.model('Score', scoreSchema);
