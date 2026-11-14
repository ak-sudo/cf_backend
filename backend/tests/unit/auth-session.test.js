/**
 * Authentication session tests: Bearer-token verification, user provisioning,
 * the /auth/me + /auth/sync contract, and per-user isolation.
 *
 * MongoDB is not required: the User model's static methods are replaced with
 * in-memory fakes for the duration of each test. Tokens use the existing
 * NODE_ENV=test "test-token:<uid>:<email>:<role>" format from config/firebase.js.
 */
process.env.NODE_ENV = 'test';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const User = require('../../src/modules/users/user.model');
const { authenticate } = require('../../src/middleware/auth');
const userController = require('../../src/modules/users/user.controller');
const userService = require('../../src/modules/users/user.service');
const auditService = require('../../src/modules/audit/audit.service');
const { UnauthorizedError, ForbiddenError } = require('../../src/utils/errors');
const { ROLES } = require('../../src/constants/roles');

// ---------- in-memory fake for the User model ----------
let db;
let createCalls;
const original = {};

function fakeUser(fields) {
  return {
    _id: { toString: () => `oid-${fields.firebaseUid}` },
    isActive: true,
    role: ROLES.CITIZEN,
    department: null,
    async save() { return this; },
    toJSON() {
      const { save, toJSON, _id, ...rest } = this;
      return { id: _id.toString(), ...rest };
    },
    ...fields,
  };
}

function installFakes() {
  db = new Map();
  createCalls = [];
  original.findOne = User.findOne;
  original.create = User.create;
  original.findById = User.findById;
  original.recordAction = auditService.recordAction;

  User.findOne = async (q) => db.get(q.firebaseUid) ?? null;
  User.create = async (doc) => {
    createCalls.push(doc);
    const u = fakeUser(doc);
    db.set(doc.firebaseUid, u);
    return u;
  };
  User.findById = async (id) => [...db.values()].find((u) => u._id.toString() === id) ?? null;
  auditService.recordAction = async () => {};
}

function restoreFakes() {
  User.findOne = original.findOne;
  User.create = original.create;
  User.findById = original.findById;
  auditService.recordAction = original.recordAction;
}

function runAuth(req) {
  return new Promise((resolve) => {
    authenticate(req, {}, (err) => resolve(err ?? null));
  });
}

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = JSON.parse(JSON.stringify(b)); return this; },
  };
}

describe('authenticate middleware', () => {
  beforeEach(installFakes);
  afterEach(restoreFakes);

  it('verifies the Bearer header token and attaches the matching user', async () => {
    db.set('uid-a', fakeUser({ firebaseUid: 'uid-a', email: 'a@x.com', displayName: 'Alice' }));
    const req = { headers: { authorization: 'Bearer test-token:uid-a:a@x.com' }, body: {} };

    const err = await runAuth(req);

    assert.equal(err, null);
    assert.equal(req.user.firebaseUid, 'uid-a');
    assert.equal(req.user.email, 'a@x.com');
  });

  it('works for GET requests with no body (regression: used to read req.body.stsTokenManager)', async () => {
    db.set('uid-a', fakeUser({ firebaseUid: 'uid-a', email: 'a@x.com' }));
    const req = { headers: { authorization: 'Bearer test-token:uid-a:a@x.com' } };

    const err = await runAuth(req);

    assert.equal(err, null);
    assert.equal(req.user.firebaseUid, 'uid-a');
  });

  it('ignores credentials supplied in the request body', async () => {
    db.set('uid-a', fakeUser({ firebaseUid: 'uid-a', email: 'a@x.com' }));
    db.set('uid-b', fakeUser({ firebaseUid: 'uid-b', email: 'b@x.com' }));
    const req = {
      headers: { authorization: 'Bearer test-token:uid-a:a@x.com' },
      body: { stsTokenManager: { accessToken: 'test-token:uid-b:b@x.com' } },
    };

    await runAuth(req);

    assert.equal(req.user.firebaseUid, 'uid-a');
  });

  it('rejects a missing Authorization header with 401', async () => {
    const err = await runAuth({ headers: {}, body: {} });
    assert.ok(err instanceof UnauthorizedError);
    assert.equal(err.statusCode, 401);
  });

  it('rejects an invalid/unverifiable token with 401', async () => {
    const err = await runAuth({ headers: { authorization: 'Bearer not-a-real-jwt' }, body: {} });
    assert.ok(err instanceof UnauthorizedError);
    assert.match(err.message, /Invalid or expired/);
  });

  it('rejects a deactivated account with 403', async () => {
    db.set('uid-d', fakeUser({ firebaseUid: 'uid-d', email: 'd@x.com', isActive: false }));
    const err = await runAuth({ headers: { authorization: 'Bearer test-token:uid-d:d@x.com' }, body: {} });
    assert.ok(err instanceof ForbiddenError);
  });

  it('provisions a new user as CITIZEN even if the token claims another role', async () => {
    const req = { headers: { authorization: 'Bearer test-token:uid-new:new@x.com:SUPER_ADMIN' }, body: {} };

    const err = await runAuth(req);

    assert.equal(err, null);
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].role, ROLES.CITIZEN);
    assert.equal(req.user.role, ROLES.CITIZEN);
  });

  it('recovers when a concurrent request created the same new user first', async () => {
    User.create = async (doc) => {
      db.set(doc.firebaseUid, fakeUser(doc)); // the "other" request won the race
      const e = new Error('E11000 duplicate key'); e.code = 11000; throw e;
    };
    const req = { headers: { authorization: 'Bearer test-token:uid-race:r@x.com' }, body: {} };

    const err = await runAuth(req);

    assert.equal(err, null);
    assert.equal(req.user.firebaseUid, 'uid-race');
  });
});

describe('auth controller contract', () => {
  beforeEach(installFakes);
  afterEach(restoreFakes);

  it('GET /auth/me returns { success, message, data: { user } } for the authenticated user', async () => {
    const req = { user: fakeUser({ firebaseUid: 'uid-a', email: 'a@x.com', displayName: 'Alice' }) };
    const res = fakeRes();

    await userController.getMe(req, res, (e) => { throw e; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.user, 'data.user must be present');
    assert.equal(res.body.data.user.email, 'a@x.com');
    assert.equal(res.body.data.user.role, ROLES.CITIZEN);
  });

  it('POST /auth/sync returns the same envelope and updates lastLoginAt', async () => {
    const req = { user: fakeUser({ firebaseUid: 'uid-a', email: 'a@x.com' }) };
    const res = fakeRes();

    await userController.syncUser(req, res, (e) => { throw e; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.user.email, 'a@x.com');
    assert.ok(res.body.data.user.lastLoginAt);
  });

  it('two different tokens resolve to two different profiles (no cross-user leakage)', async () => {
    db.set('uid-a', fakeUser({ firebaseUid: 'uid-a', email: 'a@x.com' }));
    db.set('uid-b', fakeUser({ firebaseUid: 'uid-b', email: 'b@x.com', role: ROLES.WORKER, department: 'ROADS' }));

    const emails = [];
    for (const t of ['test-token:uid-a:a@x.com', 'test-token:uid-b:b@x.com']) {
      const req = { headers: { authorization: `Bearer ${t}` } };
      await runAuth(req);
      const res = fakeRes();
      await userController.getMe(req, res, (e) => { throw e; });
      emails.push([res.body.data.user.email, res.body.data.user.role]);
    }

    assert.deepEqual(emails, [['a@x.com', ROLES.CITIZEN], ['b@x.com', ROLES.WORKER]]);
  });
});

describe('userService.updateUserStatus', () => {
  beforeEach(installFakes);
  afterEach(restoreFakes);

  it('does not throw a ReferenceError when writing the audit entry', async () => {
    db.set('uid-w', fakeUser({ firebaseUid: 'uid-w', email: 'w@x.com', role: ROLES.WORKER, department: 'ROADS' }));
    const caller = { _id: { toString: () => 'oid-admin' }, role: ROLES.SUPER_ADMIN, email: 's@x.com' };

    const updated = await userService.updateUserStatus(caller, 'oid-uid-w', false);

    assert.equal(updated.isActive, false);
  });
});

// Full HTTP path through Express (requires the backend's installed dependencies).
describe('HTTP: /api/v1/auth/me', () => {
  beforeEach(installFakes);
  afterEach(restoreFakes);

  it('returns 200 with data.user for a valid Bearer token', async () => {
    const request = require('supertest');
    const app = require('../../src/app');
    db.set('uid-h', fakeUser({ firebaseUid: 'uid-h', email: 'h@x.com', displayName: 'Hana' }));

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer test-token:uid-h:h@x.com')
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, 'h@x.com');
    assert.equal(res.body.data.user.displayName, 'Hana');
  });

  it('returns 401 for an invalid token', async () => {
    const request = require('supertest');
    const app = require('../../src/app');

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer garbage')
      .expect(401);

    assert.equal(res.body.success, false);
  });
});
