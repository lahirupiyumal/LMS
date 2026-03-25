// ================== IMPORTS ==================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');

const Quiz = require('../models/Quiz');
const { summarizeText } = require('../utils/summarize');
const { generateQuizQuestions } = require('../utils/quizGenerator');


// ================== FILE UPLOAD SETUP ==================
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

const upload = multer({ storage, fileFilter });


// ================== CREATE (POST) ==================
// PDF upload කරලා summary + quiz create කරන route එක
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    // DB connection check
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database is not connected.' });
    }

    // file check
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // PDF read
    const dataBuffer = fs.readFileSync(req.file.path);
    const parsed = await pdfParse(dataBuffer);
    const text = (parsed.text || '').trim();

    if (!text) {
      return res.status(400).json({ message: 'Unable to extract text from PDF.' });
    }

    // summary + questions generate
    const summary = summarizeText(text, 6);
    const questions = generateQuizQuestions(summary, 10);

    if (questions.length !== 10) {
      return res.status(500).json({ message: 'Quiz generation failed.' });
    }

    // save to DB
    const newQuiz = new Quiz({ summary, questions });
    const savedQuiz = await newQuiz.save();

    res.status(201).json(savedQuiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    // uploaded file delete කරනවා
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});


// ================== CREATE (POST - FROM SUMMARY) ==================
router.post('/from-summary', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database is not connected.' });
    }

    const summary = (req.body.summary || '').trim();
    if (!summary) {
      return res.status(400).json({ message: 'Summary is required.' });
    }

    const questions = generateQuizQuestions(summary, 10);

    if (!Array.isArray(questions) || questions.length !== 10) {
      return res.status(500).json({ message: 'Quiz generation failed. Exactly 10 questions are required.' });
    }

    const newQuiz = new Quiz({ summary, questions });
    const savedQuiz = await newQuiz.save();

    res.status(201).json(savedQuiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ================== ATTEMPT + EVALUATE (POST) ==================
router.post('/:id/attempt', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database is not connected.' });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (!Array.isArray(quiz.questions) || quiz.questions.length !== 10) {
      return res.status(400).json({ message: 'Quiz is invalid. Expected exactly 10 questions.' });
    }

    const submittedAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];
    if (submittedAnswers.length !== quiz.questions.length) {
      return res.status(400).json({ message: 'Please submit answers for all 10 questions.' });
    }

    const submittedMap = new Map();
    for (const answer of submittedAnswers) {
      const questionNumber = Number(answer?.questionNumber);
      const selectedAnswer = String(answer?.selectedAnswer || '').trim();

      if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > quiz.questions.length) {
        return res.status(400).json({ message: 'Invalid question number in submitted answers.' });
      }

      submittedMap.set(questionNumber, selectedAnswer);
    }

    if (submittedMap.size !== quiz.questions.length) {
      return res.status(400).json({ message: 'Please submit one answer per question.' });
    }

    const evaluatedQuestions = quiz.questions.map((question, index) => {
      const questionNumber = index + 1;
      const selectedAnswer = (submittedMap.get(questionNumber) || '').trim();
      const correctAnswer = String(question.correctAnswer || '').trim();
      const isCorrect = Boolean(selectedAnswer) && selectedAnswer === correctAnswer;

      return {
        questionText: question.questionText,
        options: question.options,
        correctAnswer,
        selectedAnswer,
        isCorrect
      };
    });

    const correctAnswers = evaluatedQuestions.filter((q) => q.isCorrect).length;
    const totalQuestions = quiz.questions.length;
    const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = scorePercentage >= 60;
    const createdAt = new Date();

    const attemptData = {
      summary: quiz.summary,
      questions: evaluatedQuestions,
      totalQuestions,
      correctAnswers,
      scorePercentage,
      passed,
      certificateGenerated: passed,
      createdAt
    };

    quiz.attempts.push(attemptData);
    await quiz.save();

    const certificate = passed
      ? {
          certificateId: `CERT-${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}${String(createdAt.getDate()).padStart(2, '0')}-${String(quiz._id).slice(-6).toUpperCase()}`,
          issuedAt: createdAt,
          quizTitle: 'Summary Quiz'
        }
      : null;

    res.status(200).json({
      attempt: {
        correctAnswers,
        totalQuestions,
        scorePercentage,
        passed,
        createdAt
      },
      evaluation: evaluatedQuestions.map((question, index) => ({
        questionNumber: index + 1,
        questionText: question.questionText,
        selectedAnswer: question.selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: question.isCorrect
      })),
      certificate
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ================== READ (GET ALL) ==================
router.get('/', async (req, res) => {
  try {
    const quizzes = await Quiz.find().sort({ uploadedAt: -1 });
    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ================== READ (GET BY ID) ==================
router.get('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ================== READ (ONLY SUMMARY) ==================
router.get('/:id/summary', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select('summary');
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    res.json({ summary: quiz.summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ================== READ (ONLY QUESTIONS) ==================
router.get('/:id/questions', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select('questions');
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const safeQuestions = (quiz.questions || []).map((question) => ({
      questionText: question.questionText,
      options: (question.options || []).map((option) => ({ text: option.text }))
    }));

    res.json({ name: 'Summary Quiz', questions: safeQuestions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ================== UPDATE (PUT / PATCH) ==================

router.put('/:id', async (req, res) => {
  try {
    const { summary, questions } = req.body;

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.id,
      { summary, questions },
      { new: true } // updated document return වෙනවා
    );

    if (!updatedQuiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json(updatedQuiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ================== DELETE ==================
router.delete('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    await Quiz.deleteOne({ _id: req.params.id });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;