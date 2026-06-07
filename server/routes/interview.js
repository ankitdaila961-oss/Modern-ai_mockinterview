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
    const { avgConfidence } = req.body;
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
  "communication": <number 0-100>,
  "technical": <number 0-100>,
  "overall_score": <number 0-100>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<area to improve 1>", "<area to improve 2>"],
  "feedback_summary": "<paragraph summarizing overall performance and advice>"
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

    const overallScore = Math.round(Number(feedbackData.overall_score)) || 0;
    const commScore = Math.round(Number(feedbackData.communication)) || 0;
    const techScore = Math.round(Number(feedbackData.technical)) || 0;
    const confScore = avgConfidence !== undefined && avgConfidence !== null ? Math.round(Number(avgConfidence)) : null;

    // Save evaluation metrics in database
    await pool.query(`
      UPDATE interviews 
      SET score = ?, feedback = ?, communication_score = ?, technical_score = ?, confidence_score = ?
      WHERE id = ? AND user_id = ?
    `, [overallScore, feedbackData.feedback_summary, commScore, techScore, confScore, interviewId, req.user.id]);

    res.json({ feedback: feedbackData });
  } catch (error) {
    console.error('[interview-feedback]', error);
    res.status(500).json({ message: 'Failed to generate feedback.' });
  }
});

router.post('/question', async (req, res) => {
  try {
    const { job_role, difficulty } = req.body;
    if (!job_role || !difficulty) {
      return res.status(400).json({ message: 'job_role and difficulty are required in the request body.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'GROQ API key is missing.' });

    const groq = new Groq({ apiKey });
    const prompt = `Generate a ${difficulty} level interview question for a ${job_role}. Respond ONLY with a valid JSON object containing a "question" key. No markdown, no extra text. Example: { "question": "What is..." }`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    let questionData;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      questionData = JSON.parse(match ? match[0] : raw);
    } catch (e) {
      questionData = { question: raw };
    }

    if (!questionData?.question) {
       questionData = { question: raw };
    }

    res.json({ question: questionData.question });
  } catch (error) {
    console.error('[interview-question]', error);
    res.status(500).json({ message: 'Failed to generate question.' });
  }
});

router.post('/evaluate', protect, async (req, res) => {
  try {
    const { question, user_answer } = req.body;
    if (!question || !user_answer) {
      return res.status(400).json({ message: 'question and user_answer are required in the request body.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'GROQ API key is missing.' });

    const groq = new Groq({ apiKey });
    const prompt = `You are an expert interviewer evaluating a candidate's answer.
Question: "${question}"
Candidate Answer: "${user_answer}"
Analyze the answer, give a score from 1 to 10, and provide constructive feedback.
Respond ONLY with a valid JSON object containing exactly two keys: "score" (a number) and "feedback" (a string).
No markdown formatting, no extra text. Example: { "score": 8, "feedback": "Good answer but improve clarity..." }`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    let evaluationData;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      evaluationData = JSON.parse(match ? match[0] : raw);
    } catch (e) {
      evaluationData = { score: 5, feedback: "Could not parse AI response. Raw output: " + raw };
    }

    const scoreValue = Number(evaluationData.score) || 5;
    const feedbackText = evaluationData.feedback || 'No feedback provided.';

    // Save to interviews table
    await pool.query(
      'INSERT INTO interviews (user_id, question, answer, score, feedback) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, question, user_answer, scoreValue, feedbackText]
    );

    res.json({
      score: scoreValue,
      feedback: feedbackText
    });
  } catch (error) {
    console.error('[interview-evaluate]', error);
    res.status(500).json({ message: 'Failed to evaluate answer.' });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, question, answer, score, feedback, created_at FROM interviews WHERE user_id = ? AND question IS NOT NULL ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ history: rows });
  } catch (error) {
    console.error('[interview-history]', error);
    res.status(500).json({ message: 'Failed to fetch history.' });
  }
});

module.exports = router;
