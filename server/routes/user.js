const express = require('express');
const pool = require('../db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/user/profile  (protected)
router.get('/profile', protect, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
