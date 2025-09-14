import express from 'express';
import { body, validationResult, query } from 'express-validator';
import Lead from '../models/Lead.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Validation middleware
const validateLead = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('phone')
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number'),
  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company is required')
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters'),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),
  body('source')
    .isIn(['website', 'facebook_ads', 'google_ads', 'referral', 'events', 'other'])
    .withMessage('Invalid source'),
  body('status')
    .optional()
    .isIn(['new', 'contacted', 'qualified', 'lost', 'won'])
    .withMessage('Invalid status'),
  body('score')
    .isInt({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  body('leadValue')
    .isFloat({ min: 0 })
    .withMessage('Lead value must be a positive number'),
  body('isQualified')
    .optional()
    .isBoolean()
    .withMessage('isQualified must be a boolean'),
  body('lastActivityAt')
    .custom((value) => {
      if (!value || value === null || value === '') return true; // allow null/empty
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new Error('lastActivityAt must be a valid date');
      return true;
    })
];

// Helper function to build query filters
const buildFilterQuery = (filters) => {
  const query = {};

  Object.keys(filters).forEach(key => {
    const filter = filters[key];
    if (!filter || typeof filter !== 'object') return;

    const { operator, value, value2 } = filter;
    if (!operator || value === undefined) return;

    switch (key) {
      case 'email':
      case 'company':
      case 'city':
      case 'state':
        if (operator === 'equals') query[key] = value;
        if (operator === 'contains') query[key] = new RegExp(value, 'i');
        break;

      case 'source':
      case 'status':
        if (operator === 'equals') query[key] = value;
        if (operator === 'in' && Array.isArray(value)) query[key] = { $in: value };
        break;

      case 'score':
      case 'leadValue':
        if (operator === 'equals') query[key] = value;
        if (operator === 'gt') query[key] = { $gt: value };
        if (operator === 'lt') query[key] = { $lt: value };
        if (operator === 'between' && value2 !== undefined) {
          query[key] = { $gte: value, $lte: value2 };
        }
        break;

      case 'createdAt':
      case 'lastActivityAt':
        if (operator === 'on') {
          const date = new Date(value);
          const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
          query[key] = { $gte: date, $lt: nextDay };
        }
        if (operator === 'before') query[key] = { $lt: new Date(value) };
        if (operator === 'after') query[key] = { $gt: new Date(value) };
        if (operator === 'between' && value2 !== undefined) {
          query[key] = { $gte: new Date(value), $lte: new Date(value2) };
        }
        break;

      case 'isQualified':
        if (operator === 'equals') query[key] = value === 'true' || value === true;
        break;
    }
  });

  return query;
};

// 📌 Get lead statistics (moved before :id to avoid route conflict)
router.get('/stats/overview', async (req, res, next) => {
  try {
    const [totalLeads, statusStats, sourceStats, avgScore] = await Promise.all([
      Lead.countDocuments(),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
      Lead.aggregate([{ $group: { _id: null, avgScore: { $avg: '$score' } } }])
    ]);

    res.json({
      totalLeads,
      statusStats,
      sourceStats,
      avgScore: avgScore[0]?.avgScore || 0
    });
  } catch (error) {
    next(error);
  }
});

// Get all leads with pagination and filters
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim(),
  query('sortBy').optional().trim(),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array().map(err => err.msg) 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};

    // Apply filters if provided
    if (req.query.filters) {
      try {
        const filters = typeof req.query.filters === 'string' 
          ? JSON.parse(req.query.filters) 
          : req.query.filters;
        query = { ...query, ...buildFilterQuery(filters) };
      } catch (error) {
        return res.status(400).json({ error: 'Invalid filters format' });
      }
    }

    // Apply search if provided
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') },
        { city: new RegExp(search, 'i') },
        { state: new RegExp(search, 'i') }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder;

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email'),
      Lead.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      leads,
      pagination: {
        currentPage: page,
        totalPages,
        totalLeads: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single lead
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead });
  } catch (error) {
    next(error);
  }
});

// Create lead
router.post('/', validateLead, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array().map(err => err.msg) 
      });
    }

    const leadData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Convert lastActivityAt to Date if exists
    if (req.body.lastActivityAt) {
      leadData.lastActivityAt = new Date(req.body.lastActivityAt);
    }

    const lead = new Lead(leadData);
    await lead.save();
    
    await lead.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      message: 'Lead created successfully',
      lead
    });
  } catch (error) {
    next(error);
  }
});

// Update lead
router.put('/:id', validateLead, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array().map(err => err.msg) 
      });
    }

    const updateData = { ...req.body };
    
    if (req.body.lastActivityAt) {
      updateData.lastActivityAt = new Date(req.body.lastActivityAt);
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      message: 'Lead updated successfully',
      lead
    });
  } catch (error) {
    next(error);
  }
});

// Delete lead
router.delete('/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
