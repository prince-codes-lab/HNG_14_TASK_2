const Profile         = require('../db/Profile');
const { buildQuery }  = require('../utils/queryBuilder');
const { parseQuery }  = require('../utils/nlParser');

// Fields to return — keeps internal Mongo fields out of the response
const PROJECTION = {
  _id:                 0,
  id:                  1,
  name:                1,
  gender:              1,
  gender_probability:  1,
  age:                 1,
  age_group:           1,
  country_id:          1,
  country_name:        1,
  country_probability: 1,
  created_at:          1,
};

/**
 * GET /api/profiles
 *
 * Receives pre-validated and parsed params from the validation middleware,
 * queries MongoDB, and returns paginated results.
 */
async function getAllProfiles(req, res, next) {
  try {
    // These were attached to req by the validation middleware
    const { filters, sortBy, order, page, limit } = req.parsedParams;

    const { mongoFilter, sortObj } = buildQuery(filters, sortBy, order);
    const skip = (page - 1) * limit;

    // Run count and data fetch in parallel — halves round-trip time
    const [total, data] = await Promise.all([
      Profile.countDocuments(mongoFilter),
      Profile.find(mongoFilter, PROJECTION)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/profiles/search
 *
 * Receives a pre-validated ?q= string from the validation middleware,
 * parses it into filters via the NL parser, then queries MongoDB.
 */
async function searchProfiles(req, res, next) {
  try {
    const { q, page, limit } = req.parsedParams;

    // Convert plain English into a filter object
    const nlFilters = parseQuery(q);

    // If the parser couldn't extract anything meaningful, reject the query
    if (!nlFilters) {
      return res.status(422).json({
        status:  'error',
        message: 'Unable to interpret query',
      });
    }

    const { mongoFilter, sortObj } = buildQuery(nlFilters, 'created_at', 'desc');
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      Profile.countDocuments(mongoFilter),
      Profile.find(mongoFilter, PROJECTION)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      data,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllProfiles, searchProfiles };
