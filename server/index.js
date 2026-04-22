require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Score = require('./models/Score');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3000;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB!'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/scores', async (req, res) => {
  try {
    const filter = req.query.player ? { playerName: req.query.player } : {};
    const limit = req.query.player ? 100 : 10;
    const topScores = await Score.find(filter)
      .sort({ score: -1, date: 1 })
      .limit(limit)
      .exec();
    res.json(topScores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

app.post('/scores', async (req, res) => {
  try {
    const { playerName, score } = req.body;
    
    if (!playerName || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    const newScore = new Score({ playerName, score });
    await newScore.save();
    
    res.status(201).json(newScore);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
