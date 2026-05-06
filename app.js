/**
 * @file app.js
 * @description Express application factory.
 *
 * Configures and returns the Express app without starting the HTTP server.
 * The server is started separately in server.js so this module can be
 * imported in tests without binding to a port.
 *
 * Middleware registration order (matters for Express):
 *   1. Security (helmet, compression)
 *   2. Logging (morgan)
 *   3. Body parsing + method override
 *   4. Static files
 *   5. View engine
 *   6. Session + flash
 *   7. Template locals
 *   8. Routes
 *   9. Error handlers (must be last)
 */

'use strict';

const express       = require('express');
const path          = require('path');
const helmet        = require('helmet');
const compression   = require('compression');
const morgan        = require('morgan');
const methodOverride = require('method-override');

const sessionConfig   = require('./config/session');
const flash           = require('./middlewares/flash');
const { loadUser }    = require('./middlewares/auth');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes   = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const adminRoutes  = require('./routes/admin');
const apiRoutes    = require('./routes/api');
const userRoutes   = require('./routes/users');

const app = express();

// ── Trust proxy ───────────────────────────────────────────────────────────────
// Required for accurate req.ip behind nginx / a load balancer,
// and for express-session to set secure cookies correctly in production.
app.set('trust proxy', 1);

// ── Security & compression ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                      'https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'",
                      'https://fonts.googleapis.com', 'https://cdn.tailwindcss.com'],
      fontSrc:       ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:        ["'self'", 'data:'],
      connectSrc:    ["'self'"],
    },
  },
}));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(methodOverride('_method')); // Support PUT/DELETE from HTML forms via ?_method=

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Session + flash ───────────────────────────────────────────────────────────
app.use(sessionConfig());
app.use(flash);
app.use(loadUser); // Attach session user to res.locals for all templates

// ── Global template locals ────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.appName     = process.env.APP_NAME     || 'AGILE PRIME DAILY REPORT';
  res.locals.companyName = process.env.COMPANY_NAME || 'Agile Prime General Contracting L.L.C.';
  next();
});

// ── Root redirect ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (!req.session?.adminUser) return res.redirect('/admin/login');
  // Engineers land on the report form; everyone else goes to the dashboard
  if (req.session.adminUser.linkedEngineer) return res.redirect('/reports/new');
  return res.redirect('/admin/dashboard');
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/admin',       authRoutes);
app.use('/reports',     reportRoutes);
app.use('/admin',       adminRoutes);
app.use('/admin/users', userRoutes);
app.use('/api',         apiRoutes);

// ── Error handlers (must be registered last) ──────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
