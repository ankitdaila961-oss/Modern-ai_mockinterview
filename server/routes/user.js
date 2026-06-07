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

// GET /api/user/analytics  (protected)
router.get('/analytics', protect, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, question, answer, score, feedback, communication_score, technical_score, confidence_score, created_at 
       FROM interviews 
       WHERE user_id = ? 
       ORDER BY created_at ASC`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json({
        hasData: false,
        summary: {
          sessionsCount: 0,
          avgOverallScore: 0,
          avgCommunicationScore: 0,
          avgTechnicalScore: 0,
          avgConfidenceScore: 0,
          streak: 0
        },
        weeklyProgress: [],
        recentActivity: []
      });
    }

    // Process statistics
    let totalOverall = 0;
    let overallCount = 0;
    let totalComm = 0;
    let commCount = 0;
    let totalTech = 0;
    let techCount = 0;
    let totalConf = 0;
    let confCount = 0;

    const processedSessions = rows.map(row => {
      const isQuick = row.question !== null;
      // Normalize quick score (1-10) to 0-100 scale, full mock is already 0-100
      let normalizedScore = 0;
      if (row.score !== null) {
        normalizedScore = isQuick ? row.score * 10 : row.score;
        totalOverall += normalizedScore;
        overallCount++;
      }

      if (row.communication_score !== null) {
        totalComm += row.communication_score;
        commCount++;
      }
      if (row.technical_score !== null) {
        totalTech += row.technical_score;
        techCount++;
      }
      if (row.confidence_score !== null) {
        totalConf += row.confidence_score;
        confCount++;
      }

      return {
        id: row.id,
        type: isQuick ? 'Quick Practice' : 'Mock Session',
        score: normalizedScore,
        rawScore: row.score,
        communication: row.communication_score,
        technical: row.technical_score,
        confidence: row.confidence_score,
        created_at: row.created_at
      };
    });

    const avgOverallScore = overallCount > 0 ? Math.round(totalOverall / overallCount) : 0;
    const avgCommunicationScore = commCount > 0 ? Math.round(totalComm / commCount) : 0;
    const avgTechnicalScore = techCount > 0 ? Math.round(totalTech / techCount) : 0;
    const avgConfidenceScore = confCount > 0 ? Math.round(totalConf / confCount) : 0;

    // Calculate daily streak
    // Get unique sorted dates (local timezone date parts)
    const dates = [...new Set(rows.map(r => {
      const d = new Date(r.created_at);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }))].sort();

    let streak = 0;
    if (dates.length > 0) {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const todayStr = formatDate(today);
      const yesterdayStr = formatDate(yesterday);

      const lastActiveDate = dates[dates.length - 1];
      if (lastActiveDate === todayStr || lastActiveDate === yesterdayStr) {
        streak = 1;
        let checkDate = new Date(lastActiveDate);
        
        // Go backwards day by day and check if exists
        for (let i = dates.length - 2; i >= 0; i--) {
          checkDate.setDate(checkDate.getDate() - 1);
          const checkStr = formatDate(checkDate);
          if (dates[i] === checkStr) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    // Format weekly progress (last 10 sessions)
    const weeklyProgress = processedSessions.slice(-10).map(s => ({
      date: new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: s.score,
      type: s.type
    }));

    // Recent activity (last 5 sessions, newest first)
    const recentActivity = processedSessions.slice(-5).reverse().map(s => ({
      id: s.id,
      type: s.type,
      score: s.score,
      rawScore: s.rawScore,
      created_at: s.created_at
    }));

    res.json({
      hasData: true,
      summary: {
        sessionsCount: processedSessions.length,
        avgOverallScore,
        avgCommunicationScore,
        avgTechnicalScore,
        avgConfidenceScore,
        streak
      },
      weeklyProgress,
      recentActivity
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
