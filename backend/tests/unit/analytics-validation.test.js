const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  analyticsFilterSchema,
  heatmapQuerySchema,
} = require('../../src/modules/analytics/analytics.validation');

describe('Analytics Validation Schemas Unit Tests', () => {
  it('should accept valid filter params and default timeRange to 30d', () => {
    const valid = { department: 'ROADS' };
    const parsed = analyticsFilterSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.timeRange, '30d');
    assert.equal(parsed.data.department, 'ROADS');
  });

  it('should accept valid heatmap query parameters', () => {
    const validHeatmap = {
      department: 'SANITATION',
      longitude: 77.209,
      latitude: 28.6139,
      radiusMeters: 10000,
      limit: 100,
    };
    const parsed = heatmapQuerySchema.safeParse(validHeatmap);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.radiusMeters, 10000);
    assert.equal(parsed.data.limit, 100);
  });

  it('should reject invalid coordinates in heatmap queries', () => {
    const invalidCoords = {
      longitude: 200, // Invalid: exceeds 180
      latitude: 28.6139,
    };
    const parsed = heatmapQuerySchema.safeParse(invalidCoords);
    assert.equal(parsed.success, false);
  });
});
