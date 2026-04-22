const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const pool = require('../db');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');

const router = express.Router();

async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return null;
  }
}

router.post('/', protect, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'GROQ API key is missing. Add GROQ_API_KEY to .env' });
    }

    // Get user's resume
    const [rows] = await pool.query('SELECT resume_path FROM users WHERE id = ?', [req.user.id]);
    let resumeText = '';
    if (rows[0] && rows[0].resume_path) {
      const fullPath = path.join(__dirname, '../../', rows[0].resume_path);
      if (fs.existsSync(fullPath)) {
        resumeText = await extractTextFromPDF(fullPath);
      }
    }

    // Build system prompt
    let systemPrompt = `You are an expert AI Career Coach and Mock Interviewer. Be conversational, concise, and professional.`;
    if (resumeText) {
      systemPrompt += `\n\nThe user's resume:\n\`\`\`\n${resumeText.substring(0, 5000)}\n\`\`\`\nBase your advice on this resume.`;
    } else {
      systemPrompt += `\n\nThe user has not uploaded a resume yet. Encourage them to upload one in the Resume section for personalized advice.`;
    }

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    res.json({ reply: responseText });

  } catch (error) {
    console.error('[chat-error]', error);
    res.status(500).json({ message: 'Failed to generate response. Please try again.' });
  }
});

module.exports = router;