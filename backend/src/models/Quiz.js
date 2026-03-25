const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    options: { type: [optionSchema], required: true },
    correctAnswer: { type: String, required: true }
  },
  { _id: false }
);

const attemptQuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    options: { type: [optionSchema], required: true },
    correctAnswer: { type: String, required: true },
    selectedAnswer: { type: String, default: '' },
    isCorrect: { type: Boolean, default: false }
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    summary: { type: String, required: true },
    questions: {
      type: [attemptQuestionSchema],
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length === 10;
        },
        message: 'Each attempt must store exactly 10 questions.'
      }
    },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    scorePercentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    certificateGenerated: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema({
  summary: {
    type: String,
    required: true
  },
 




  
  questions: {
    type: [questionSchema],
    validate: {
      validator: function (value) {
        return Array.isArray(value) && value.length === 10;
      },
      message: 'Exactly 10 quiz questions are required.'
    }
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  attempts: {
    type: [attemptSchema],
    default: []
  }
});

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;
