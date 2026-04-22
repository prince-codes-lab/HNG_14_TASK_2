const express       = require('express');
const cors          = require('cors');
const profileRoutes = require('./routes/profiles');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// The grading script makes cross-origin requests, so this header is required.
app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
// Useful for verifying the server is up on your hosting platform
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/profiles', profileRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches anything passed to next(err) from route handlers.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  const code = err.statusCode || 500;
  res.status(code).json({
    status:  'error',
    message: code >= 500 ? 'Internal server error' : err.message,
  });
});

module.exports = app;
