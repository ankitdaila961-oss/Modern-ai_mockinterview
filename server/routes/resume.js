const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const pool     = require('../db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// ── Ensure uploads folder exists ──────────────────────
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Multer storage config ─────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const safeName = `resume_${req.user.id}_${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// ── POST /api/resume/upload  (protected) ─────────────
router.post('/upload', protect, (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum size is 5 MB.'
        : err.message;
      return res.status(400).json({ message: msg });
    }
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const relativePath = `uploads/${req.file.filename}`;

    try {
      // Delete old resume file if it exists
      const [rows] = await pool.query('SELECT resume_path FROM users WHERE id = ?', [req.user.id]);
      if (rows[0]?.resume_path) {
        const oldPath = path.join(__dirname, '../../', rows[0].resume_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      // Save new path to DB
      await pool.query('UPDATE users SET resume_path = ? WHERE id = ?', [relativePath, req.user.id]);

      res.json({
        message: 'Resume uploaded successfully.',
        file: {
          name:     req.file.originalname,
          size:     req.file.size,
          path:     relativePath,
          url:      `/${relativePath}`,
        },
      });
    } catch (dbErr) {
      console.error('[upload-resume]', dbErr.message);
      res.status(500).json({ message: 'Database error while saving resume path.' });
    }
  });
});

// ── GET /api/resume/my-resume  (protected) ───────────
router.get('/my-resume', protect, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT resume_path FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length || !rows[0].resume_path) {
      return res.json({ resume: null });
    }
    res.json({
      resume: {
        path: rows[0].resume_path,
        url:  `/${rows[0].resume_path}`,
      },
    });
  } catch (err) {
    console.error('[my-resume]', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/resume/delete  (protected) ───────────
router.delete('/delete', protect, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT resume_path FROM users WHERE id = ?', [req.user.id]);
    if (rows[0]?.resume_path) {
      const fullPath = path.join(__dirname, '../../', rows[0].resume_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      await pool.query('UPDATE users SET resume_path = NULL WHERE id = ?', [req.user.id]);
    }
    res.json({ message: 'Resume deleted.' });
  } catch (err) {
    console.error('[delete-resume]', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
