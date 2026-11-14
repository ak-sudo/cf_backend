const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const requestIdMiddleware = require('./middleware/request-id');
const errorHandler = require('./middleware/error-handler');
const { globalRateLimiter } = require('./middleware/rate-limiter');
const { NotFoundError } = require('./utils/errors');
const { setupSwagger } = require('./docs/swagger');
const v1Router = require('./routes/v1');

const app = express();

// Trust reverse proxy if behind one (AWS, Cloudflare, NGINX)
app.set('trust proxy', 1);

// Security Headers with safe CSP allowing Swagger UI docs
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// CORS Configuration
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman) in dev
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Origin blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
  })
);

// Request ID Generation
app.use(requestIdMiddleware);

// HTTP Logging with Pino
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  })
);

// Body Parsing with safe payload limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global Rate Limiting
app.use(globalRateLimiter);

// Interactive OpenAPI / Swagger Documentation (/api-docs & /api-docs.json)
setupSwagger(app);

// Liveness / Readiness Root Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount API v1
app.use('/api/v1', v1Router);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
