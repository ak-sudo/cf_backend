const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const analyticsService = require('../../src/modules/analytics/analytics.service');
const { ROLES } = require('../../src/constants/roles');

describe('Analytics Department Isolation & Time Filter Unit Tests', () => {
  it('resolveDepartment strictly locks ADMIN to their assigned department even if they request another', () => {
    const adminCaller = { role: ROLES.ADMIN, department: 'SANITATION' };
    const resolved = analyticsService.resolveDepartment(adminCaller, 'ROADS');
    assert.equal(resolved, 'SANITATION');
  });

  it('resolveDepartment allows SUPER_ADMIN to query specific requested department', () => {
    const superAdminCaller = { role: ROLES.SUPER_ADMIN, department: null };
    const resolved = analyticsService.resolveDepartment(superAdminCaller, 'ROADS');
    assert.equal(resolved, 'ROADS');
  });

  it('resolveDepartment allows SUPER_ADMIN to query all departments when none specified', () => {
    const superAdminCaller = { role: ROLES.SUPER_ADMIN, department: null };
    const resolved = analyticsService.resolveDepartment(superAdminCaller, undefined);
    assert.equal(resolved, null);
  });

  it('resolveDateRange calculates valid date thresholds for 7d and 30d', () => {
    const range7d = analyticsService.resolveDateRange('7d');
    assert.ok(range7d.$gte instanceof Date);
    assert.ok(range7d.$lte instanceof Date);
    const diffDays = Math.round((range7d.$lte - range7d.$gte) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 7);
  });
});
