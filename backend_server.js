// Enhanced Backend System for Student Grading App
// File: server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
const TelegramBot = require('node-telegram-bot-api');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const app = express();

// ================================
// CONFIGURATION & SECURITY
// ================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute for AI features
  message: { error: 'AI request limit exceeded. Please wait.' }
});

app.use('/api/', limiter);
app.use('/api/ai/', strictLimiter);

// ================================
// DATABASE MODELS
// ================================

// User Schema
const userSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  level: { type: String, required: true },
  grades: { type: Map, of: Number },
  average: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  ipAddress: String,
  userAgent: String,
  location: String
});

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  event: { type: String, required: true },
  level: String,
  sessionId: String,
  data: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
  ipAddress: String
});

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  sessionId: String,
  rating: { type: Number, min: 1, max: 5 },
  feedback: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

// ================================
// EXTERNAL SERVICES
// ================================

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Telegram Bot
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ================================
// UTILITY FUNCTIONS
// ================================

// Generate session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Calculate weighted average
function calculateWeightedAverage(grades, subjects) {
  let totalWeightedScore = 0;
  let totalCoefficients = 0;
  
  for (const [subject, grade] of Object.entries(grades)) {
    if (subjects[subject] && grade !== null && grade !== undefined) {
      totalWeightedScore += grade * subjects[subject];
      totalCoefficients += subjects[subject];
    }
  }
  
  return totalCoefficients > 0 ? (totalWeightedScore / totalCoefficients) : 0;
}

// Subject configurations
const levelSubjects = {
  primary: {
    title: 'السادس ابتدائي',
    subjects: {
      'اللغة العربية': 4,
      'اللغة الفرنسية': 3,
      'الرياضيات': 4,
      'النشاط العلمي': 2,
      'التربية الإسلامية': 2,
      'الاجتماعيات': 2,
      'التربية البدنية': 1,
      'التربية الفنية': 1,
      'التربية الموسيقية': 1
    }
  },
  middle2: {
    title: 'الثانية إعدادي',
    subjects: {
      'اللغة العربية': 4,
      'اللغة الفرنسية': 3,
      'الإنجليزية': 2,
      'الرياضيات': 4,
      'علوم الحياة والأرض': 2,
      'الفيزياء والكيمياء': 2,
      'التربية الإسلامية': 2,
      'الاجتماعيات': 3,
      'التربية البدنية': 1,
      'التربية الفنية': 1,
      'المعلوميات': 1
    }
  },
  middle3: {
    title: 'الثالثة إعدادي',
    subjects: {
      'اللغة العربية': 5,
      'اللغة الفرنسية': 3,
      'الإنجليزية': 2,
      'الرياضيات': 5,
      'علوم الحياة والأرض': 3,
      'الفيزياء والكيمياء': 3,
      'التربية الإسلامية': 2,
      'الاجتماعيات': 3,
      'التربية البدنية': 1,
      'التربية الفنية': 1,
      'المعلوميات': 2
    }
  },
  bac1: {
    title: 'الأولى باكالوريا',
    subjects: {
      'اللغة العربية': 4,
      'اللغة الفرنسية': 4,
      'الإنجليزية': 3,
      'الرياضيات': 7,
      'علوم الحياة والأرض': 7,
      'الفيزياء والكيمياء': 7,
      'التربية الإسلامية': 2,
      'الفلسفة': 4,
      'الاجتماعيات': 4,
      'التربية البدنية': 2
    }
  },
  bac2: {
    title: 'الثانية باكالوريا',
    subjects: {
      'اللغة العربية': 4,
      'اللغة الفرنسية': 4,
      'الإنجليزية': 3,
      'الرياضيات': 9,
      'علوم الحياة والأرض': 7,
      'الفيزياء والكيمياء': 7,
      'الفلسفة': 4,
      'الاجتماعيات': 2
    }
  }
};

// ================================
// MIDDLEWARE
// ================================

// Session validation middleware
const validateSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.body.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }
  req.sessionId = sessionId;
  next();
};

// Analytics middleware
const trackAnalytics = (event) => {
  return async (req, res, next) => {
    try {
      const analytics = new Analytics({
        event,
        level: req.body.level,
        sessionId: req.sessionId,
        data: req.body,
        ipAddress: req.ip
      });
      await analytics.save();
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
    next();
  };
};

// ================================
// API ROUTES
// ================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize session
app.post('/api/session/init', [
  body('level').isIn(Object.keys(levelSubjects)).withMessage('Invalid level')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { level } = req.body;
    const sessionId = generateSessionId();
    
    const user = new User({
      sessionId,
      level,
      grades: new Map(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    await user.save();
    
    // Track session creation
    await trackAnalytics('session_created')({ 
      sessionId, 
      body: { level }, 
      ip: req.ip 
    }, res, () => {});
    
    res.json({ 
      sessionId, 
      level,
      subjects: levelSubjects[level].subjects 
    });
  } catch (error) {
    console.error('Session init error:', error);
    res.status(500).json({ error: 'Failed to initialize session' });
  }
});

// Save grades
app.post('/api/grades/save', [
  validateSession,
  body('grades').isObject().withMessage('Grades must be an object'),
  body('level').isIn(Object.keys(levelSubjects)).withMessage('Invalid level')
], trackAnalytics('grades_saved'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { grades, level } = req.body;
    const { sessionId } = req;
    
    // Validate grades
    const subjects = levelSubjects[level].subjects;
    const validatedGrades = {};
    
    for (const [subject, grade] of Object.entries(grades)) {
      if (subjects[subject] && grade >= 0 && grade <= 20) {
        validatedGrades[subject] = parseFloat(grade);
      }
    }
    
    const average = calculateWeightedAverage(validatedGrades, subjects);
    
    await User.findOneAndUpdate(
      { sessionId },
      { 
        grades: validatedGrades,
        average: parseFloat(average.toFixed(2)),
        updatedAt: new Date()
      },
      { upsert: true }
    );
    
    res.json({ 
      success: true,
      average: parseFloat(average.toFixed(2)),
      totalSubjects: Object.keys(validatedGrades).length
    });
  } catch (error) {
    console.error('Save grades error:', error);
    res.status(500).json({ error: 'Failed to save grades' });
  }
});

// Get AI suggestions
app.post('/api/ai/suggestions', [
  validateSession,
  body('level').isIn(Object.keys(levelSubjects)).withMessage('Invalid level')
], trackAnalytics('ai_suggestions_requested'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId } = req;
    const user = await User.findOne({ sessionId });
    
    if (!user || !user.grades || user.grades.size === 0) {
      return res.status(400).json({ error: 'No grades found for this session' });
    }
    
    const { level } = user;
    const subjects = levelSubjects[level].subjects;
    const grades = Object.fromEntries(user.grades);
    
    // Prepare data for AI
    const gradeData = Object.entries(grades)
      .map(([subject, grade]) => `${subject}: ${grade}/20 (معامل ${subjects[subject]})`)
      .join('\n');
    
    const prompt = `
أنت مستشار تربوي خبير للطلاب المغاربة. إليك درجات طالب في ${levelSubjects[level].title}:

${gradeData}

المعدل العام: ${user.average}/20

قدم:
1. تحليل سريع للأداء
2. أهم 3 نصائح للتحسين
3. المواد التي تحتاج تركيز أكبر
4. استراتيجية للمراجعة

اجعل الإجابة مختصرة ومفيدة باللغة العربية.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "أنت مستشار تربوي متخصص في النظام التعليمي المغربي. تقدم نصائح عملية ومفيدة للطلاب."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const suggestions = completion.choices[0].message.content;
    
    res.json({ 
      suggestions,
      average: user.average,
      level: levelSubjects[level].title
    });
  } catch (error) {
    console.error('AI suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// Get user results
app.get('/api/results/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = await User.findOne({ sessionId });
    
    if (!user) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const subjects = levelSubjects[user.level].subjects;
    const grades = Object.fromEntries(user.grades);
    
    // Find weak subjects (below 10)
    const weakSubjects = Object.entries(grades)
      .filter(([, grade]) => grade < 10)
      .map(([subject, grade]) => ({ subject, grade, coefficient: subjects[subject] }));
    
    // Calculate status
    let status = 'راسب';
    if (user.average >= 10) {
      status = 'ناجح';
    } else if (user.average >= 9.5) {
      status = 'مقبول بشروط';
    }
    
    res.json({
      sessionId,
      level: levelSubjects[user.level].title,
      average: user.average,
      status,
      grades,
      weakSubjects,
      totalSubjects: Object.keys(grades).length,
      lastUpdated: user.updatedAt
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// Submit feedback
app.post('/api/feedback', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional().isLength({ max: 500 }).withMessage('Feedback too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating, feedback, sessionId } = req.body;
    
    const feedbackDoc = new Feedback({
      sessionId,
      rating,
      feedback
    });
    
    await feedbackDoc.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ================================
// ADMIN ROUTES
// ================================

// Get analytics dashboard
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const [
      totalUsers,
      activeUsers,
      levelStats,
      recentActivity
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ updatedAt: { $gte: lastWeek } }),
      User.aggregate([
        { $group: { _id: '$level', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Analytics.find({ timestamp: { $gte: lastWeek } })
        .sort({ timestamp: -1 })
        .limit(100)
    ]);
    
    res.json({
      totalUsers,
      activeUsers,
      levelStats,
      recentActivity: recentActivity.length
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ================================
// TELEGRAM NOTIFICATIONS
// ================================

// Send daily stats to Telegram
async function sendDailyStats() {
  try {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const [
      newUsers,
      activeUsers,
      topLevel
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: yesterday } }),
      User.countDocuments({ updatedAt: { $gte: yesterday } }),
      User.aggregate([
        { $match: { createdAt: { $gte: yesterday } } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ])
    ]);
    
    const message = `
📊 إحصائيات يومية - معدلي

👥 مستخدمون جدد: ${newUsers}
🔥 مستخدمون نشطون: ${activeUsers}
📚 أكثر المستويات استخداماً: ${topLevel[0] ? levelSubjects[topLevel[0]._id]?.title || topLevel[0]._id : 'لا يوجد'}

📅 ${today.toLocaleDateString('ar-EG')}
    `;
    
    await telegramBot.sendMessage(TELEGRAM_CHAT_ID, message);
  } catch (error) {
    console.error('Telegram notification error:', error);
  }
}

// Schedule daily stats (run every day at 9 AM)
setInterval(sendDailyStats, 24 * 60 * 60 * 1000);

// ================================
// DATABASE CONNECTION & SERVER
// ================================

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/grading-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;