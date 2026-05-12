const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

/**
 * @route POST /api/audit
 * @desc  Submit SaaS tools for AI audit
 * @access Public (can be restricted later)
 */
router.post('/', auditController.runAudit);

// GET /api/audit/:id - Fetch a public audit (masked)
router.get('/:id', auditController.getPublicAudit);

module.exports = router;
