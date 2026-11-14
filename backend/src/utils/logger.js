const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : isTest ? 'silent' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'newPassword',
      'oldPassword',
      'token',
      'accessToken',
      'refreshToken',
      'otp',
      'secret',
      'credentials',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

module.exports = logger;
