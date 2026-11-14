/**
 * verifyFirebaseIdToken / initializeFirebase behaviour.
 *
 * Uses the real firebase-admin SDK. Every case fails before firebase-admin
 * would fetch Google's public keys, so no network access is needed.
 */
process.env.NODE_ENV = 'test';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { getApps, deleteApp } = require('firebase-admin/app');

const ENV_KEYS = ['FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT'];
let savedEnv;

// Fresh copies so the cached Firebase app from one case doesn't leak into the next
function load() {
  delete require.cache[require.resolve('../../src/config/firebase')];
  delete require.cache[require.resolve('../../src/middleware/auth')];
  return {
    firebase: require('../../src/config/firebase'),
    auth: require('../../src/middleware/auth'),
  };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function fakeIdToken({ aud }) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' }),
    b64({ aud, iss: `https://securetoken.google.com/${aud}`, sub: 'uid-1', iat: now, exp: now + 3600, auth_time: now }),
    'c2lnbmF0dXJl',
  ].join('.');
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  ENV_KEYS.forEach((k) => delete process.env[k]);
});

afterEach(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

describe('verifyFirebaseIdToken', () => {
  it('authenticate answers 500 (not a misleading 401) when FIREBASE_PROJECT_ID is missing', async () => {
    const { auth } = load();
    const req = { headers: { authorization: `Bearer ${fakeIdToken({ aud: 'civicflow-test' })}` } };

    const err = await new Promise((resolve) => auth.authenticate(req, {}, resolve));

    assert.equal(err.statusCode, 500);
    assert.match(err.message, /not configured/);
  });

  it('throws FirebaseConfigError when no project ID can be resolved', async () => {
    const { firebase } = load();
    await assert.rejects(
      firebase.verifyFirebaseIdToken(fakeIdToken({ aud: 'civicflow-test' })),
      (e) => e.isFirebaseConfigError === true && /FIREBASE_PROJECT_ID/.test(e.message)
    );
  });

  it('rejects malformed (non-JWT) tokens without touching Firebase', async () => {
    const { firebase } = load();
    await assert.rejects(firebase.verifyFirebaseIdToken('not-a-jwt'), /Malformed/);
    assert.equal(getApps().length, 0);
  });

  it('initializes from FIREBASE_PROJECT_ID and rejects a token for another project (aud check)', async () => {
    process.env.FIREBASE_PROJECT_ID = 'civicflow-test';
    const { firebase } = load();

    await assert.rejects(
      firebase.verifyFirebaseIdToken(fakeIdToken({ aud: 'some-other-project' })),
      (e) => !e.isFirebaseConfigError && e.code === 'auth/argument-error' && /aud/.test(e.message)
    );
    assert.equal(getApps().length, 1);
    assert.equal(getApps()[0].options.projectId, 'civicflow-test');
  });

  it('falls back to FIREBASE_PROJECT_ID when FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON', async () => {
    process.env.FIREBASE_PROJECT_ID = 'civicflow-test';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{not json';
    const { firebase } = load();

    firebase.initializeFirebase();

    assert.equal(getApps()[0].options.projectId, 'civicflow-test');
  });

  it('authenticate answers 401 for a token from the wrong project', async () => {
    process.env.FIREBASE_PROJECT_ID = 'civicflow-test';
    const { auth } = load();
    const req = { headers: { authorization: `Bearer ${fakeIdToken({ aud: 'some-other-project' })}` } };

    const err = await new Promise((resolve) => auth.authenticate(req, {}, resolve));

    assert.equal(err.statusCode, 401);
  });
});
