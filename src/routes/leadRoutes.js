const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { leadLimiter } = require('../middleware/rateLimiter');

// POST /api/leads - Capture a new lead
router.post('/', leadLimiter, leadController.captureLead);

module.exports = router;
