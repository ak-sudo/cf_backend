const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { requireRoles, requireDepartmentScope } = require('../../src/middleware/auth');
const { ROLES } = require('../../src/constants/roles');
const { ForbiddenError, UnauthorizedError } = require('../../src/utils/errors');

describe('RBAC Middleware Unit Tests', () => {
  it('requireRoles should reject if user is not attached to request', () => {
    const middleware = requireRoles(ROLES.ADMIN);
    const req = {};
    const res = {};
    let caughtError = null;

    middleware(req, res, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof UnauthorizedError);
  });

  it('requireRoles should reject with ForbiddenError if user role is not allowed', () => {
    const middleware = requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN);
    const req = { user: { role: ROLES.CITIZEN } };
    const res = {};
    let caughtError = null;

    middleware(req, res, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof ForbiddenError);
    assert.match(caughtError.message, /Access denied/);
  });

  it('requireRoles should call next() without error if user role matches', () => {
    const middleware = requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN);
    const req = { user: { role: ROLES.ADMIN } };
    const res = {};
    let calledNext = false;

    middleware(req, res, (err) => {
      assert.ifError(err);
      calledNext = true;
    });

    assert.equal(calledNext, true);
  });

  it('requireDepartmentScope should permit SUPER_ADMIN regardless of department', () => {
    const middleware = requireDepartmentScope((req) => req.body.department);
    const req = {
      user: { role: ROLES.SUPER_ADMIN, department: null },
      body: { department: 'ROADS' },
    };
    const res = {};
    let calledNext = false;

    middleware(req, res, (err) => {
      assert.ifError(err);
      calledNext = true;
    });

    assert.equal(calledNext, true);
  });

  it('requireDepartmentScope should reject ADMIN attempting to manage different department', () => {
    const middleware = requireDepartmentScope((req) => req.body.department);
    const req = {
      user: { role: ROLES.ADMIN, department: 'SANITATION' },
      body: { department: 'ROADS' },
    };
    const res = {};
    let caughtError = null;

    middleware(req, res, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof ForbiddenError);
    assert.match(caughtError.message, /department 'SANITATION'/);
  });

  it('requireDepartmentScope should permit ADMIN managing their own department', () => {
    const middleware = requireDepartmentScope((req) => req.body.department);
    const req = {
      user: { role: ROLES.ADMIN, department: 'SANITATION' },
      body: { department: 'SANITATION' },
    };
    const res = {};
    let calledNext = false;

    middleware(req, res, (err) => {
      assert.ifError(err);
      calledNext = true;
    });

    assert.equal(calledNext, true);
  });
});
