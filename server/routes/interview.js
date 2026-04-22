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

router.post('/generate', protect, async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'GROQ API key is missing.' });

    const [rows] = await pool.query('SELECT resume_path FROM users WHERE id = ?', [req.user.id]);
    let resumeText = '';
    if (rows[0]?.resume_path) {
      const fullPath = path.join(__dirname, '../../', rows[0].resume_path);
      if (fs.existsSync(fullPath)) resumeText = await extractTextFromPDF(fullPath);
    }

    const groq = new Groq({ apiKey });
    let prompt = `You are an expert technical interviewer.\n`;
    if (resumeText) {
      prompt += `The candidate resume:\n\`\`\`\n${resumeText.substring(0, 5000)}\n\`\`\`\nGenerate exactly 5 relevant interview questions based on the skills and experiences in this resume.\n`;
    } else {
      prompt += `No resume provided. Generate exactly 5 standard behavioral and situational interview questions.\n`;
    }
    prompt += `Respond ONLY with a valid JSON array of 5 strings. No explanation, no markdown. Example: ["Q1?","Q2?","Q3?","Q4?","Q5?"]`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    let questionsArr;
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      questionsArr = JSON.parse(match ? match[0] : raw);
    } catch (e) {
      return res.status(500).json({ message: 'AI returned invalid format. Please try again.' });
    }

    if (!Array.isArray(questionsArr) || questionsArr.length === 0) {
      return res.status(500).json({ message: 'AI returned invalid question format.' });
    }

    const [insertInterview] = await pool.query('INSERT INTO interviews (user_id) VALUES (?)', [req.user.id]);
    const interviewId = insertInterview.insertId;
    await pool.query('INSERT INTO questions (interview_id, question_text) VALUES ?', [questionsArr.map(q => [interviewId, q])]);
    const [savedQuestions] = await pool.query(
      'SELECT id, question_text FROM questions WHERE interview_id = ? ORDER BY id ASC',
      [interviewId]
    );
    res.json({ interviewId, questions: savedQuestions });
  } catch (error) {
    console.error('[interview-generate]', error);
    res.status(500).json({ message: 'Failed to generate interview. Please try again.' });
  }
});

router.post('/answer', protect, async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    if (!questionId || !answer) return res.status(400).json({ message: 'Question ID and answer are required.' });

    const [rows] = await pool.query(`
      SELECT q.id, q.question_text FROM questions q
      JOIN interviews i ON q.interview_id = i.id
      WHERE q.id = ? AND i.user_id = ?
    `, [questionId, req.user.id]);

    if (rows.length === 0) return res.status(403).json({ message: 'Access denied or question not found.' });

    await pool.query('UPDATE questions SET user_answer = ? WHERE id = ?', [answer, questionId]);

    const questionText = rows[0].question_text;
    const apiKey = process.env.GROQ_API_KEY;
    const groq = new Groq({ apiKey });

    const prompt = `You are an expert interviewer giving instant feedback on a candidate answer.
Question: "${questionText}"
Candidate Answer: "${answer}"
Respond ONLY with a valid JSON object. No markdown, no extra text:
{
  "score": <number 1-10>,
  "is_good": <true or false>,
  "mistakes": "<specific mistakes or gaps, write None if answer is strong>",
  "correct_answer": "<what a complete ideal answer should include>",
  "tip": "<one specific actionable tip>"
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    let feedback = null;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      feedback = JSON.parse(match ? match[0] : raw);
    } catch (e) {
      console.error('[answer-feedback] parse error:', raw);
    }

    res.json({ message: 'Answer saved successfully.', feedback });
  } catch (error) {
    console.error('[interview-answer]', error);
    res.status(500).json({ message: 'Failed to save answer.' });
  }
});

router.post('/:id/feedback', protect, async (req, res) => {
  try {
    const interviewId = req.params.id;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'GROQ API key is missing.' });

    const [interviews] = await pool.query('SELECT id FROM interviews WHERE id = ? AND user_id = ?', [interviewId, req.user.id]);
    if (interviews.length === 0) return res.status(403).json({ message: 'Interview not found or access denied.' });

    const [questions] = await pool.query('SELECT question_text, user_answer FROM questions WHERE interview_id = ?', [interviewId]);
    if (questions.length === 0) return res.status(400).json({ message: 'No questions found.' });

    let qnaText = '';
    questions.forEach((q, i) => {
      qnaText += `Q${i+1}: ${q.question_text}\nA${i+1}: ${q.user_answer || '(No answer provided)'}\n\n`;
    });

    const groq = new Groq({ apiKey });
    const prompt = `You are an expert AI Career Coach evaluating a mock interview.
Transcript:
${qnaText}
Respond ONLY with a valid JSON object. No markdown:
{
  "communication": <number 0-10>,
  "confidence": <number 0-10>,
  "technical": <number 0-10>,
  "overall_score": <number 0-10>,
  "feedback_summary": "<paragraph summarizing overall performance>",
  "suggestions": "<actionable tips for improvement>"
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    let feedbackData;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      feedbackData = JSON.parse(match ? match[0] : raw);
    } catch (e) {
      return res.status(500).json({ message: 'AI returned invalid feedback format.' });
    }

    res.json({ feedback: feedbackData });
  } catch (error) {
    console.error('[interview-feedback]', error);
    res.status(500).json({ message: 'Failed to generate feedback.' });
  }
});

module.exports = router;
