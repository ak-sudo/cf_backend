const swaggerUi = require('swagger-ui-express');

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CivicFlow Unified Civic Issue Management API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API for citizen civic issue reporting, automated Gemma 4 AI classification, municipal department assignment, field worker task resolution, EcoCoins reward ledger, and administrative GIS analytics.',
    contact: {
      name: 'CivicFlow Engineering Team',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'CivicFlow API v1',
    },
  ],
  components: {
    securitySchemes: {
      FirebaseAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase ID Token issued upon user authentication',
      },
    },
    schemas: {
      StandardSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
          meta: { type: 'object' },
        },
      },
      StandardError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Request could not be processed' },
          requestId: { type: 'string', example: 'e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c' },
        },
      },
    },
  },
  security: [{ FirebaseAuth: [] }],
  tags: [
    { name: 'Health', description: 'System liveness, readiness, and service connectivity checks' },
    { name: 'Auth', description: 'Firebase user session synchronization and profile management' },
    { name: 'Users', description: 'Administrative RBAC user management and department scoping' },
    { name: 'Reports', description: 'Civic complaint submission, Cloudinary upload signatures, and queries' },
    { name: 'Worker', description: 'Field worker task execution, on-site progress, and resolution proof' },
    { name: 'Rewards', description: 'EcoCoins wallet, immutable ledger, and perks redemption' },
    { name: 'Analytics', description: 'Municipal operational overview, GIS heatmaps, and worker leaderboards' },
    { name: 'Notifications', description: 'Citizen notifications and chronological activity timeline' },
    { name: 'Audit', description: 'Immutable system audit trails (Super Admin exclusive)' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'System health probe',
        security: [],
        responses: {
          200: { description: 'API is healthy' },
        },
      },
    },
    '/auth/sync': {
      post: {
        tags: ['Auth'],
        summary: 'Synchronize Firebase user with MongoDB and retrieve user profile',
        responses: {
          200: { description: 'User profile synchronized' },
          401: { description: 'Missing or invalid Firebase token' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile, role, department, and EcoCoins balance',
        responses: {
          200: { description: 'User profile returned' },
          401: { description: 'Unauthorized' },
        },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update user profile (display name, phone number, photo URL)',
        responses: {
          200: { description: 'Profile updated' },
        },
      },
    },
    '/reports': {
      post: {
        tags: ['Reports'],
        summary: 'Submit a new civic issue report (triggers async Gemma 4 AI analysis)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'coordinates', 'images'],
                properties: {
                  title: { type: 'string', example: 'Dangerous pothole on MG Road' },
                  description: { type: 'string', example: 'Deep crater in the middle of the road causing traffic slowdown.' },
                  category: { type: 'string', enum: ['GARBAGE', 'POTHOLE', 'BROKEN_INFRASTRUCTURE', 'ANIMAL_CARCASS', 'GRAFFITI', 'DAMAGED_SIGNBOARD', 'WATER_LEAKAGE', 'OTHER'] },
                  coordinates: { type: 'array', items: { type: 'number' }, example: [77.209, 28.6139] },
                  images: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', example: 'https://res.cloudinary.com/civicflow/pothole.jpg' },
                        publicId: { type: 'string', example: 'pothole1' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Report created and queued for AI analysis' },
          422: { description: 'Validation failed' },
        },
      },
      get: {
        tags: ['Reports'],
        summary: 'List reports with RBAC filtering, pagination, and geospatial radius query',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'longitude', in: 'query', schema: { type: 'number' } },
          { name: 'latitude', in: 'query', schema: { type: 'number' } },
          { name: 'radiusMeters', in: 'query', schema: { type: 'integer', default: 5000 } },
        ],
        responses: {
          200: { description: 'Paginated reports list' },
        },
      },
    },
    '/reports/upload-signature': {
      post: {
        tags: ['Reports'],
        summary: 'Generate HMAC SHA-256 signature for direct client upload to Cloudinary',
        responses: {
          200: { description: 'Upload authorization parameters generated' },
        },
      },
    },
    '/worker/tasks': {
      get: {
        tags: ['Worker'],
        summary: 'List tasks assigned to the authenticated field worker',
        responses: {
          200: { description: 'Worker assigned tasks' },
          403: { description: 'Forbidden: Worker role required' },
        },
      },
    },
    '/worker/tasks/{id}/start': {
      patch: {
        tags: ['Worker'],
        summary: 'Mark task as IN_PROGRESS',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Task marked in progress' },
        },
      },
    },
    '/worker/tasks/{id}/resolve': {
      patch: {
        tags: ['Worker'],
        summary: 'Submit resolution proof photos, mark RESOLVED, and trigger EcoCoins reward',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['resolutionImages', 'notes'],
                properties: {
                  resolutionImages: { type: 'array', items: { type: 'string' } },
                  notes: { type: 'string', example: 'Asphalt filled and leveled.' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Task resolved successfully' },
        },
      },
    },
    '/rewards/wallet': {
      get: {
        tags: ['Rewards'],
        summary: 'Get citizen EcoCoins balance and recent ledger activity',
        responses: {
          200: { description: 'Wallet balance and transactions' },
        },
      },
    },
    '/rewards/catalog': {
      get: {
        tags: ['Rewards'],
        summary: 'List active civic perks redeemable with EcoCoins',
        responses: {
          200: { description: 'Catalog items' },
        },
      },
    },
    '/rewards/redeem': {
      post: {
        tags: ['Rewards'],
        summary: 'Redeem EcoCoins for a perk voucher (idempotent & double-spend protected)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['rewardItemId'],
                properties: {
                  rewardItemId: { type: 'string' },
                  idempotencyKey: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Perk voucher issued' },
          400: { description: 'Insufficient balance or out of stock' },
        },
      },
    },
    '/analytics/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Municipal operational overview, resolution rates, and SLA metrics (Admin / Super Admin)',
        responses: {
          200: { description: 'Overview metrics' },
          403: { description: 'Forbidden: Admin role required' },
        },
      },
    },
    '/analytics/heatmap': {
      get: {
        tags: ['Analytics'],
        summary: 'Lightweight coordinate points for GIS map heatmaps and spatial clustering',
        responses: {
          200: { description: 'Heatmap coordinate points' },
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List in-app notifications with unread badge count',
        responses: {
          200: { description: 'Notifications and unread count' },
        },
      },
    },
    '/notifications/stream': {
      get: {
        tags: ['Notifications'],
        summary: 'Chronological civic activity stream / milestone timeline',
        responses: {
          200: { description: 'Civic timeline stream' },
        },
      },
    },
    '/audit': {
      get: {
        tags: ['Audit'],
        summary: 'Immutable system audit trail (Super Admin exclusive)',
        responses: {
          200: { description: 'Audit trail records' },
          403: { description: 'Forbidden: Super Admin exclusive' },
        },
      },
    },
  },
};

function setupSwagger(app) {
  // Serve raw JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  // Serve interactive Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'CivicFlow API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
    })
  );
}

module.exports = {
  openApiSpec,
  setupSwagger,
};
