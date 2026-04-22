const express    = require('express');
const { validateGetProfiles, validateSearchProfiles } = require('../middleware/validate');
const { getAllProfiles, searchProfiles }              = require('../controllers/profiles');

const router = express.Router();

/**
 * GET /api/profiles/search
 * Validate → Parse NL query → Query DB → Respond
 *
 * Must be registered BEFORE the '/' route below.
 * If it were second, Express would try to match "search" as a
 * dynamic segment of the first route and never reach this handler.
 */
router.get('/search', validateSearchProfiles, searchProfiles);

/**
 * GET /api/profiles
 * Validate → Build filter → Query DB → Respond
 */
router.get('/', validateGetProfiles, getAllProfiles);

module.exports = router;
